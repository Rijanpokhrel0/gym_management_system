<?php
/**
 * forgot - send a password reset link.
 * POST { email }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';
require_once __DIR__ . '/../../config/mailer.php';

$d = body();
$email = strtolower(trim((string)($d['email'] ?? '')));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Please enter a valid email address.');
}

$tables = [
    'superadmins' => 'superadmin',
    'admins'      => 'admin',
    'trainers'    => 'trainer',
    'users'       => 'user',
];
$found = false;
foreach ($tables as $table => $portal) {
    $stmt = db()->prepare("SELECT id FROM `$table` WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        $found = true;
        break;
    }
}

// Always behave the same to avoid leaking which emails have accounts.
if (!$found) {
    ok(['message' => 'If an account exists for that email, a reset link has been sent.']);
}

$wait = email_cooldown_left('password_resets', 'email = ?', [$email]);
if ($wait > 0) {
    fail("Please wait {$wait} seconds before requesting another reset email.", 429);
}

$token = bin2hex(random_bytes(32));

// Invalidate previous unused tokens for this email.
$stmt = db()->prepare('UPDATE password_resets SET used_at = NOW() WHERE email = ? AND used_at IS NULL');
$stmt->execute([$email]);

$stmt = db()->prepare('INSERT INTO password_resets (email, token_hash, expires_at) VALUES (?, ?, ?)');
$stmt->execute([$email, hash('sha256', $token), date('Y-m-d H:i:s', time() + 3600)]);

$link = APP_URL . '/index.html?reset=' . $token;
$sent = mail_send($email, 'Reset your FitPulse password', reset_email($link));

ok(['message' => $sent[0]
    ? 'Reset link sent. Check your inbox (valid for 1 hour).'
    : 'Could not send the email: ' . $sent[1]]);
