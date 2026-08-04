<?php
/**
 * POST /api/auth/login.php
 * Body: { email, password, portal }
 * Validates credentials against MySQL, verifies the portal matches the role,
 * and starts a PHP session.
 */

require_once __DIR__ . '/../../config/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}

$data     = json_decode(file_get_contents('php://input'), true) ?: [];
$email    = strtolower(trim($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');
$portal   = (string)($data['portal'] ?? '');

if ($email === '' || $password === '') {
    fail('Email and password are required.');
}
if (!in_array($portal, ['admin', 'user', 'trainer'], true)) {
    fail('Invalid login portal.');
}

$stmt = db()->prepare('SELECT id, name, email, password, role, goal FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    fail('Invalid email or password.', 401);
}
if ($user['role'] !== $portal) {
    fail('No ' . $portal . ' account exists for this email. This account is registered as ' . $user['role'] . '.', 401);
}

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];

unset($user['password']);

$trainer = null;
if ($user['role'] === 'trainer') {
    $stmt = db()->prepare('SELECT id, specialization, experience, shifts, status FROM trainers WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $trainer = $stmt->fetch() ?: null;
    if ($trainer) {
        $trainer['shifts'] = json_decode($trainer['shifts'] ?? '[]', true);
    }
}

ok(['user' => $user, 'trainer' => $trainer]);
