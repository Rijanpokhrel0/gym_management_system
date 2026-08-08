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
    'products'        => $count('SELECT COUNT(*) FROM products'),
    'trainers'        => $count('SELECT COUNT(*) FROM trainers'),
    'users'           => $count('SELECT COUNT(*) FROM users'),
]);
