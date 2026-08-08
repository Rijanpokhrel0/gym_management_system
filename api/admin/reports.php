<?php
/**
 * Admin: analytics & reports (own gym).
 * GET ?report=overview|revenue|members|attendance|classes  (&format=csv)
 *
 * - overview  : KPI cards + revenue/attendance/member trend series (for charts)
 * - revenue   : monthly revenue collected (invoice payments)
 * - members   : monthly new member signups + totals
 * - attendance: daily check-in counts (last 30 days)
 * - classes   : per-class booking occupancy
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];

$report = $_GET['report'] ?? 'overview';
$format = ($_GET['format'] ?? 'json') === 'csv' ? 'csv' : 'json';

$data = match ($report) {
    'revenue' => revenue_report($adminId),
    'members' => member_report($adminId),
    'attendance' => attendance_report($adminId),
    'classes' => class_report($adminId),
    default => overview_report($adminId),
};

if ($format === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . $report . '-report.csv"');
    $out = fopen('php://output', 'w');
    fputcsv($out, array_keys($data['rows'][0] ?? ['no' => 'data']));
    foreach ($data['rows'] as $row) {
        fputcsv($out, $row);
    }
    fclose($out);
    exit;
}

ok($data);

/* ------------------------- report builders ------------------------- */

function overview_report(int $adminId): array
{
    $pdo = db();
    $g = function (string $sql, array $args = []) use ($pdo) {
        $s = $pdo->prepare($sql);
        $s->execute($args);
        return $s->fetch();
    };
    $members   = $g('SELECT COUNT(*) AS n FROM users WHERE admin_id = ? OR id IN (SELECT user_id FROM user_gyms WHERE admin_id = ?)', [$adminId, $adminId])['n'];
    $attToday  = $g('SELECT COUNT(*) AS n FROM attendance WHERE admin_id = ? AND DATE(check_in_at) = CURDATE()', [$adminId])['n'];
    $revenue   = $g('SELECT COALESCE(SUM(paid_amount),0) AS n FROM invoices WHERE admin_id = ?', [$adminId])['n'];
    $dueAmt    = $g('SELECT COALESCE(SUM(amount - paid_amount),0) AS n FROM invoices WHERE admin_id = ? AND status IN ("unpaid","partial")', [$adminId])['n'];
    $plans     = $g('SELECT COUNT(*) AS n FROM workout_plans WHERE admin_id = ?', [$adminId])['n'];
    $diets     = $g('SELECT COUNT(*) AS n FROM diet_plans WHERE admin_id = ?', [$adminId])['n'];
    $classes   = $g('SELECT COUNT(*) AS n FROM gym_classes WHERE admin_id = ?', [$adminId])['n'];
    $announce  = $g('SELECT COUNT(*) AS n FROM announcements WHERE admin_id = ?', [$adminId])['n'];

    $monthlyRevenue = series($pdo, 'SELECT DATE_FORMAT(paid_at, "%Y-%m") AS m, SUM(paid_amount) AS v
        FROM invoices WHERE admin_id = ? AND paid_at IS NOT NULL GROUP BY m ORDER BY m DESC LIMIT 6', $adminId);
    $attendanceTrend = series($pdo, 'SELECT DATE(check_in_at) AS m, COUNT(*) AS v
        FROM attendance WHERE admin_id = ? GROUP BY DATE(check_in_at) ORDER BY m DESC LIMIT 14', $adminId, true);
    $memberGrowth = series($pdo, 'SELECT DATE_FORMAT(created_at, "%Y-%m") AS m, COUNT(*) AS v
        FROM users WHERE admin_id = ? GROUP BY m ORDER BY m DESC LIMIT 6', $adminId);

    return [
        'report' => 'overview',
        'kpis' => [
            'members' => (int)$members,
            'attendance_today' => (int)$attToday,
            'revenue_collected' => (float)$revenue,
            'outstanding' => (float)$dueAmt,
            'workout_plans' => (int)$plans,
            'diet_plans' => (int)$diets,
            'classes' => (int)$classes,
            'announcements' => (int)$announce,
        ],
        'monthly_revenue' => array_reverse($monthlyRevenue),
        'attendance_trend' => array_reverse($attendanceTrend),
        'member_growth' => array_reverse($memberGrowth),
        'rows' => $monthlyRevenue,
    ];
}

function revenue_report(int $adminId): array
{
    $rows = series(db(), 'SELECT DATE_FORMAT(paid_at, "%Y-%m") AS month, COUNT(*) AS invoices,
        SUM(paid_amount) AS collected
        FROM invoices WHERE admin_id = ? AND paid_at IS NOT NULL
        GROUP BY month ORDER BY month', $adminId);
    $total = 0.0;
    foreach ($rows as $r) {
        $total += (float)$r['collected'];
    }
    return ['report' => 'revenue', 'total' => $total, 'rows' => $rows];
}

function member_report(int $adminId): array
{
    $rows = series(db(), 'SELECT DATE_FORMAT(created_at, "%Y-%m") AS month, COUNT(*) AS new_members
        FROM users WHERE admin_id = ?
        GROUP BY month ORDER BY month', $adminId);
    $total = 0;
    foreach ($rows as $r) {
        $total += (int)$r['new_members'];
    }
    return ['report' => 'members', 'total' => $total, 'rows' => $rows];
}

function attendance_report(int $adminId): array
{
    $rows = series(db(), 'SELECT DATE(check_in_at) AS date, COUNT(*) AS check_ins,
        COUNT(DISTINCT user_id) AS unique_members
        FROM attendance WHERE admin_id = ? AND check_in_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
        GROUP BY DATE(check_in_at) ORDER BY date', $adminId, true);
    return ['report' => 'attendance', 'rows' => $rows];
}

function class_report(int $adminId): array
{
    $s = db()->prepare('SELECT gc.name, gc.day_of_week, gc.start_time, gc.capacity,
        (SELECT COUNT(*) FROM class_bookings cb WHERE cb.class_id = gc.id AND cb.status = "booked") AS booked
        FROM gym_classes gc WHERE gc.admin_id = ? ORDER BY gc.day_of_week, gc.start_time');
    $s->execute([$adminId]);
    return ['report' => 'classes', 'rows' => $s->fetchAll()];
}

/** Run a grouped query and normalise label/value series. */
function series(PDO $pdo, string $sql, int $adminId, bool $isDate = false): array
{
    $s = $pdo->prepare($sql);
    $s->execute([$adminId]);
    $out = [];
    foreach ($s->fetchAll() as $r) {
        $label = $isDate ? (string)$r['m'] : (string)$r['m'];
        $out[] = ['label' => $label] + array_map(fn($v) => is_numeric($v) ? (float)$v : $v, $r);
    }
    return $out;
}
