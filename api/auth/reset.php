<?php
/**
 * reset - set a new password using a reset token from the email link.
 * POST { token, password }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$d = body();
$token = trim((string)($d['token'] ?? ''));
$password = (string)($d['password'] ?? '');

if ($token === '') {
    fail('Reset token is missing.');
}
if (strlen($password) < 6) {
    fail('Password must be at least 6 characters.');
}

$stmt = db()->prepare('SELECT id, email, expires_at FROM password_resets
    WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()');
$stmt->execute([hash('sha256', $token)]);
$reset = $stmt->fetch();
if (!$reset) {
    fail('This reset link is invalid or has expired. Please request a new one.', 400);
}

$tables = [
    'superadmins' => 'superadmin',
    'admins'      => 'admin',
    'trainers'    => 'trainer',
    'users'       => 'user',
];
$updated = false;
foreach ($tables as $table => $portal) {
    $stmt = db()->prepare("UPDATE `$table` SET password = ? WHERE email = ?");
    $stmt->execute([password_hash($password, PASSWORD_BCRYPT), $reset['email']]);
    if ($stmt->rowCount() > 0) {
        $updated = true;
    }
}
if (!$updated) {
    fail('No account is linked to that email anymore.', 400);
}

db()->prepare('UPDATE password_resets SET used_at = NOW() WHERE id = ?')->execute([(int)$reset['id']]);
ok(['message' => 'Password updated. You can now sign in with your new password.']);
