<?php
/**
 * Admin: dashboard metrics.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('admin');
$adminId = (int)$u['id'];

$cnt = function (string $sql, array $args) {
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    return (int)$stmt->fetchColumn();
};

// Get trial and verification status
$adminStmt = db()->prepare('SELECT verification_status, trial_ends_at FROM admins WHERE id = ?');
$adminStmt->execute([$adminId]);
$adminInfo = $adminStmt->fetch();

$trialEndsAt = null;
$daysRemaining = null;
$verificationStatus = $adminInfo['verification_status'] ?? 'approved';

if (!empty($adminInfo['trial_ends_at'])) {
    $trialEndsAt = $adminInfo['trial_ends_at'];
    $trialEnd = new DateTime($trialEndsAt);
    $now = new DateTime();
    if ($trialEnd > $now) {
        $daysRemaining = (int)$now->diff($trialEnd)->days;
    }
}

ok([
    'products'        => $cnt('SELECT COUNT(*) FROM products WHERE admin_id = ?', [$adminId]),
    'active_products' => $cnt('SELECT COUNT(*) FROM products WHERE admin_id = ? AND status = "active"', [$adminId]),
    'users'           => $cnt('SELECT COUNT(*) FROM users WHERE admin_id = ?', [$adminId]),
    'trainers'        => $cnt('SELECT COUNT(*) FROM trainers WHERE admin_id = ?', [$adminId]),
    'active_trainers' => $cnt('SELECT COUNT(*) FROM trainers WHERE admin_id = ? AND status = "active"', [$adminId]),
    'equipment'       => $cnt('SELECT COUNT(*) FROM equipment WHERE admin_id = ?', [$adminId]),
    'active_equipment'=> $cnt('SELECT COUNT(*) FROM equipment WHERE admin_id = ? AND status = "active"', [$adminId]),
    'inventory_value' => (float)$cnt('SELECT COALESCE(SUM(price * stock), 0) FROM products WHERE admin_id = ?', [$adminId]),
    'verification_status' => $verificationStatus,
    'trial_ends_at'   => $trialEndsAt,
    'days_remaining'  => $daysRemaining,
]);
