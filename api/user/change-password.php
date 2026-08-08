<?php
/**
 * user/change-password - change password verified through Gmail.
 * POST {} (requires an active user session)
 *
 * Sends a verification email with a single-use link (?reset=TOKEN). The user
 * opens the link in Gmail, sets a new password, and the change is complete.
 * Rate-limited: max one email per address every 120 seconds.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';
require_once __DIR__ . '/../../config/mailer.php';

$u = require_portal('user');
$userId = (int)$u['id'];
$email = $u['email'];

$wait = email_cooldown_left('password_resets', 'email = ?', [$email]);
if ($wait > 0) {
    fail("A verification email was sent recently. Please wait {$wait} seconds before requesting another.", 429);
}

$token = bin2hex(random_bytes(32));

// Invalidate previous unused tokens for this email.
db()->prepare('UPDATE password_resets SET used_at = NOW() WHERE email = ? AND used_at IS NULL')->execute([$email]);
db()->prepare('INSERT INTO password_resets (email, token_hash, expires_at) VALUES (?, ?, ?)')
    ->execute([$email, hash('sha256', $token), date('Y-m-d H:i:s', time() + 3600)]);

$link = APP_URL . '/index.html?reset=' . $token;
$sent = mail_send($email, 'Change your FitPulse password', reset_email($link));

$data = [
    'message' => $sent[0]
        ? "A verification link was sent to $email. Open it in your inbox to set a new password (valid for 1 hour)."
        : 'Could not send the email: ' . $sent[1],
];
if (SMTP_DEMO && $sent[0]) {
    $data['demo_reset_url'] = $link;
    $data['message'] = $data['message'] . ' [Demo mode] Your reset link: ' . $link;
}
ok($data);
