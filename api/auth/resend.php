<?php
/**
 * resend - resend the email verification link.
 * POST { email }
 *
 * Rate-limited: max one verification email per address every 120 seconds.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';
require_once __DIR__ . '/../../config/mailer.php';

$d = body();
$email = strtolower(trim((string)($d['email'] ?? '')));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Please enter a valid email address.');
}

$stmt = db()->prepare('SELECT id, email_verified_at FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

// Don't reveal whether the account exists.
if (!$user) {
    ok(['message' => 'If an account exists for that email, a new verification link has been sent.']);
}
if (!empty($user['email_verified_at'])) {
    ok(['message' => 'That email is already verified. You can sign in directly.']);
}

$wait = email_cooldown_left('users', 'id = ?', [(int)$user['id']], 'verification_sent_at');
if ($wait > 0) {
    fail("Please wait {$wait} seconds before requesting another verification email.", 429);
}

$token = bin2hex(random_bytes(32));
db()->prepare('UPDATE users SET verification_token = ?, verification_sent_at = NOW() WHERE id = ?')
    ->execute([$token, (int)$user['id']]);
$link = APP_URL . '/index.html?verify=' . $token;
$sent = mail_send($email, 'Verify your FitPulse account', verification_email($link));

ok(['message' => $sent[0]
    ? 'Verification link sent. Check your inbox.'
    : 'Could not send the email: ' . $sent[1]]);
