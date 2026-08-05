<?php
/**
 * POST /api/auth/login.php
 * Body: { email, password }
 * Validates credentials against MySQL. The account role is read straight from
 * the database - no portal selection needed. The user is routed to the
 * correct portal automatically.
 */

require_once __DIR__ . '/../../config/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}

$data     = json_decode(file_get_contents('php://input'), true) ?: [];
$email    = strtolower(trim($data['email'] ?? ''));
$password = (string)($data['password'] ?? '');

if ($email === '' || $password === '') {
    fail('Email and password are required.');
}

$stmt = db()->prepare('SELECT id, name, email, password, role, goal, phone, bio FROM users WHERE email = ?');
$stmt->execute([$email]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, $user['password'])) {
    fail('Invalid email or password.', 401);
}

session_regenerate_id(true);
$_SESSION['user_id'] = $user['id'];

unset($user['password']);

$trainer = null;
if ($user['role'] === 'trainer') {
    $stmt = db()->prepare('SELECT id, specialization, experience, shifts, status, salary_expectation, certifications, rating FROM trainers WHERE user_id = ?');
    $stmt->execute([$user['id']]);
    $trainer = $stmt->fetch() ?: null;
    if ($trainer) {
        $trainer['shifts'] = json_decode($trainer['shifts'] ?? '[]', true);
    }
}

ok(['user' => $user, 'trainer' => $trainer]);
