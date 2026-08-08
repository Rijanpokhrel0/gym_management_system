<?php
/**
 * Login - detects the portal (superadmin / admin / trainer / user) automatically.
 * POST { email, password }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$d = body();
$email    = trim((string)($d['email'] ?? ''));
$password = (string)($d['password'] ?? '');

if ($email === '' || $password === '') {
    fail('Email and password are required.');
}

// Portal order: superadmin -> admin -> trainer -> user
$checks = [
    ['superadmins', 'superadmin', 'SELECT id, name, email, password, NULL AS status FROM superadmins WHERE email = ?'],
    ['admins',      'admin',      'SELECT id, name, email, password, status FROM admins WHERE email = ?'],
    ['trainers',    'trainer',    'SELECT id, name, email, password, status FROM trainers WHERE email = ?'],
    ['users',       'user',       'SELECT id, name, email, password, email_verified_at, NULL AS status FROM users WHERE email = ?'],
];

foreach ($checks as [$table, $portal, $sql]) {
    $stmt = db()->prepare($sql);
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row) {
        continue;
    }
    if (!password_verify($password, $row['password'])) {
        fail('Incorrect email or password.', 401);
    }
    if ($portal === 'user' && empty($row['email_verified_at'])) {
        fail('Please verify your email first. Check your inbox for the verification link, or request a new one.', 403);
    }
    if (($row['status'] ?? '') === 'suspended' || ($row['status'] ?? '') === 'inactive') {
        fail('This account has been deactivated. Contact your gym administrator.', 403);
    }
    sign_in($portal, (int)$row['id']);
    ok([
        'portal' => $portal,
        'name'   => $row['name'],
        'email'  => $row['email'],
    ]);
}

fail('No account found for that email. Check the portal you are signing in to.', 404);
