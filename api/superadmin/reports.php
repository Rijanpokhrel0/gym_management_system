<?php
/**
 * Superadmin: system-wide analytics & reports.
 * GET ?report=overview|revenue|members|attendance
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

require_portal('superadmin');

$report = $_GET['report'] ?? 'overview';

$data = match ($report) {
    'revenue'    => revenue_report(),
    'members'    => member_report(),
    'attendance' => attendance_report(),
    default      => overview_report(),
};

ok($data);

function overview_report(): array
{
    $pdo = db();
    $g = function (string $sql) use ($pdo) { return $pdo->query($sql)->fetch(); };

    $admins      = (int)$g('SELECT COUNT(*) FROM admins')['COUNT(*)'] ?? 0;
    $activeAdmins= (int)$g('SELECT COUNT(*) FROM admins WHERE status = "active"')['COUNT(*)'] ?? 0;
    $users       = (int)$g('SELECT COUNT(*) FROM users')['COUNT(*)'] ?? 0;
    $trainers    = (int)$g('SELECT COUNT(*) FROM trainers')['COUNT(*)'] ?? 0;
    $products    = (int)$g('SELECT COUNT(*) FROM products')['COUNT(*)'] ?? 0;
    $revenue     = (float)$g('SELECT COALESCE(SUM(paid_amount),0) FROM invoices')['SUM(paid_amount)'] ?? 0;
    $pending     = (int)$g('SELECT COUNT(*) FROM payments WHERE status = "pending"')['COUNT(*)'] ?? 0;
    $attendance  = (int)$g('SELECT COUNT(*) FROM attendance WHERE DATE(check_in_at) = CURDATE()')['COUNT(*)'] ?? 0;
    $classes     = (int)$g('SELECT COUNT(*) FROM gym_classes')['COUNT(*)'] ?? 0;

    $monthlyRevenue = [];
    $s = $pdo->query('SELECT DATE_FORMAT(paid_at, "%Y-%m") AS m, SUM(paid_amount) AS v FROM invoices WHERE paid_at IS NOT NULL GROUP BY m ORDER BY m DESC LIMIT 6');
    foreach ($s->fetchAll() as $r) $monthlyRevenue[] = ['label' => $r['m'], 'value' => (float)$r['v']];
    $monthlyRevenue = array_reverse($monthlyRevenue);

    $memberGrowth = [];
    $s = $pdo->query('SELECT DATE_FORMAT(created_at, "%Y-%m") AS m, COUNT(*) AS v FROM users GROUP BY m ORDER BY m DESC LIMIT 6');
    foreach ($s->fetchAll() as $r) $memberGrowth[] = ['label' => $r['m'], 'value' => (int)$r['v']];
    $memberGrowth = array_reverse($memberGrowth);

    return [
        'report' => 'overview',
        'kpis' => [
            'admins' => $admins,
            'active_admins' => $activeAdmins,
            'users' => $users,
            'trainers' => $trainers,
            'products' => $products,
            'revenue' => $revenue,
            'pending_payments' => $pending,
            'attendance_today' => $attendance,
            'classes' => $classes,
        ],
        'monthly_revenue' => $monthlyRevenue,
        'member_growth' => $memberGrowth,
    ];
}

function revenue_report(): array
{
    $rows = [];
    $s = db()->query('SELECT DATE_FORMAT(paid_at, "%Y-%m") AS month, COUNT(*) AS invoices, SUM(paid_amount) AS collected FROM invoices WHERE paid_at IS NOT NULL GROUP BY month ORDER BY month');
    foreach ($s->fetchAll() as $r) $rows[] = $r;
    $total = 0.0;
    foreach ($rows as $r) $total += (float)$r['collected'];
    return ['report' => 'revenue', 'total' => $total, 'rows' => $rows];
}

function member_report(): array
{
    $rows = [];
    $s = db()->query('SELECT DATE_FORMAT(created_at, "%Y-%m") AS month, COUNT(*) AS new_members FROM users GROUP BY month ORDER BY month');
    foreach ($s->fetchAll() as $r) $rows[] = $r;
    $total = 0;
    foreach ($rows as $r) $total += (int)$r['new_members'];
    return ['report' => 'members', 'total' => $total, 'rows' => $rows];
}

function attendance_report(): array
{
    $rows = [];
    $s = db()->query('SELECT DATE(check_in_at) AS date, COUNT(*) AS check_ins, COUNT(DISTINCT user_id) AS unique_members FROM attendance WHERE check_in_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) GROUP BY DATE(check_in_at) ORDER BY date');
    foreach ($s->fetchAll() as $r) $rows[] = $r;
    return ['report' => 'attendance', 'rows' => $rows];
}
