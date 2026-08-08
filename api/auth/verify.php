<?php
/**
 * verify - confirm a user's email address via token from the email link.
 * POST { token }   (frontend calls this when the user opens ?verify=TOKEN)
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$d = body();
$token = trim((string)($d['token'] ?? ''));

if ($token === '') {
    fail('Verification token is missing.');
}

$stmt = db()->prepare('SELECT id FROM users WHERE verification_token = ? AND email_verified_at IS NULL');
$stmt->execute([$token]);
$row = $stmt->fetch();
if (!$row) {
    fail('This verification link is invalid or has already been used.', 400);
}

db()->prepare('UPDATE users SET email_verified_at = NOW(), verification_token = NULL WHERE id = ?')->execute([(int)$row['id']]);
sign_in('user', (int)$row['id']);
ok(['message' => 'Email verified. You are signed in.', 'portal' => 'user']);
