<?php
/**
 * register - self-registration for gym members (User portal).
 * POST { name, email, password, phone, goal, admin_id? }
 *
 * Creates the account, then emails a verification link. The user must
 * verify their email before they can sign in.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';
require_once __DIR__ . '/../../config/mailer.php';

$d = body();
$name     = trim((string)($d['name'] ?? ''));
$email    = strtolower(trim((string)($d['email'] ?? '')));
$password = (string)($d['password'] ?? '');
$phone    = trim((string)($d['phone'] ?? ''));
$goal     = trim((string)($d['goal'] ?? '')) ?: null;
$adminId  = isset($d['admin_id']) ? (int)$d['admin_id'] : null;

if ($name === '' || $email === '' || $password === '') {
    fail('Name, email and password are required.');
}
if (strlen($password) < 6) {
    fail('Password must be at least 6 characters.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Please enter a valid email address.');
}

$stmt = db()->prepare('SELECT id, email_verified_at, verification_sent_at FROM users WHERE email = ?');
$stmt->execute([$email]);
$existing = $stmt->fetch();
if ($existing) {
    if (!empty($existing['email_verified_at'])) {
        fail('An account with that email already exists.', 409);
    }
    $wait = email_cooldown_left('users', 'id = ?', [(int)$existing['id']], 'verification_sent_at');
    if ($wait > 0) {
        fail("A verification email was sent recently. Please wait {$wait} seconds before requesting another.", 429);
    }
    // Unverified account: regenerate the token and resend.
    $token = bin2hex(random_bytes(32));
    db()->prepare('UPDATE users SET verification_token = ?, verification_sent_at = NOW(), name = ?, password = ?, phone = ?, goal = ? WHERE id = ?')
        ->execute([$token, $name, password_hash($password, PASSWORD_BCRYPT), $phone, $goal, (int)$existing['id']]);
    $id = (int)$existing['id'];
} else {
    if ($adminId) {
        $stmt = db()->prepare('SELECT id FROM admins WHERE id = ?');
        $stmt->execute([$adminId]);
        if (!$stmt->fetch()) {
            fail('The selected gym is invalid.');
        }
    }
    $token = bin2hex(random_bytes(32));
    $stmt = db()->prepare('INSERT INTO users (name, email, password, phone, goal, admin_id, verification_token, verification_sent_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())');
    $stmt->execute([$name, $email, password_hash($password, PASSWORD_BCRYPT), $phone, $goal, $adminId, $token]);
    $id = (int)db()->lastInsertId();
}

$link = APP_URL . '/index.html?verify=' . $token;
$sent = mail_send($email, 'Verify your FitPulse account', verification_email($link));

if (SMTP_DEMO) {
    // Demo mode: no real SMTP configured, so auto-verify so the account works.
    db()->prepare('UPDATE users SET email_verified_at = NOW(), verification_token = NULL WHERE id = ?')->execute([$id]);
    sign_in('user', $id);
    ok([
        'id'          => $id,
        'email'       => $email,
        'portal'      => 'user',
        'name'        => $name,
        'verify_sent' => false,
        'message'     => 'Account created. (Demo mode: email verification is skipped and you are signed in automatically.)',
    ]);
}

ok([
    'id'          => $id,
    'email'       => $email,
    'verify_sent' => $sent[0],
    'message'     => $sent[0]
        ? 'Account created. Check your email to verify, then sign in.'
        : 'Account created. (Email could not be sent: ' . $sent[1] . ')',
]);
