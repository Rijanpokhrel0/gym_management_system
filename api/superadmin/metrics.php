<?php
/**
 * Superadmin: dashboard metrics.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

require_portal('superadmin');

$count = fn(string $sql) => (int)db()->query($sql)->fetchColumn();

ok([
    'admins'          => $count('SELECT COUNT(*) FROM admins'),
    'active_admins'   => $count('SELECT COUNT(*) FROM admins WHERE status = "active"'),
    'pending_admins'  => $count('SELECT COUNT(*) FROM admins WHERE verification_status = "pending"'),
    'products'        => $count('SELECT COUNT(*) FROM products'),
    'trainers'        => $count('SELECT COUNT(*) FROM trainers'),
    'users'           => $count('SELECT COUNT(*) FROM users'),
    'equipment'       => $count('SELECT COUNT(*) FROM equipment'),
    'total_revenue'   => (float)db()->query('SELECT COALESCE(SUM(paid_amount),0) FROM invoices')->fetchColumn(),
    'pending_payments'=> $count('SELECT COUNT(*) FROM payments WHERE status = "pending"'),
    'attendance_today'=> $count('SELECT COUNT(*) FROM attendance WHERE DATE(check_in_at) = CURDATE()'),
]);
