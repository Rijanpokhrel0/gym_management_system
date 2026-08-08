<?php
/**
 * Superadmin: reset the password of an admin or user account.
 * POST { portal: "admin"|"user", id, password }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

require_portal('superadmin');

$d = body();
$portal = (string)($d['portal'] ?? '');
$id     = (int)($d['id'] ?? 0);
$pass   = (string)($d['password'] ?? '');

if (!in_array($portal, ['admin', 'user'], true)) {
    fail('Please specify a valid account type (admin or user).');
}
if (!$id) {
    fail('Account id is required.');
}
if (strlen($pass) < 6) {
    fail('Password must be at least 6 characters.');
}

$table = $portal === 'admin' ? 'admins' : 'users';
$stmt = db()->prepare("SELECT id FROM `$table` WHERE id = ?");
$stmt->execute([$id]);
if (!$stmt->fetch()) {
    fail('Account not found.', 404);
}

db()->prepare("UPDATE `$table` SET password = ? WHERE id = ?")->execute([password_hash($pass, PASSWORD_BCRYPT), $id]);
ok(['message' => ucfirst($portal) . ' password reset successfully.']);
