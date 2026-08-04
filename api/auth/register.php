<?php
/**
 * POST /api/auth/register.php
 * Body: { type: "user" | "trainer", name, email, password, ...fields }
 *  - type "user":    creates a member login account + a members directory record.
 *  - type "trainer": creates a trainer account + pending trainer application.
 * Passwords are hashed with bcrypt.
 */

require_once __DIR__ . '/../../config/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    fail('Method not allowed.', 405);
}

$data     = json_decode(file_get_contents('php://input'), true) ?: [];
$type     = (string)($data['type'] ?? '');
$name     = trim((string)($data['name'] ?? ''));
$email    = strtolower(trim((string)($data['email'] ?? '')));
$password = (string)($data['password'] ?? '');

if (!in_array($type, ['user', 'trainer'], true)) {
    fail('Invalid registration type.');
}
if ($name === '' || $email === '' || $password === '') {
    fail('Name, email and password are required.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Please enter a valid email address.');
}
if (strlen($password) < 6) {
    fail('Password must be at least 6 characters long.');
}

$stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    fail('An account with this email already exists. Please log in instead.');
}

$hash = password_hash($password, PASSWORD_BCRYPT);

// ---------------- MEMBER / USER REGISTRATION ----------------
if ($type === 'user') {
    $goal = (string)($data['goal'] ?? 'General Fitness');

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role, goal) VALUES (?, ?, ?, "user", ?)');
        $stmt->execute([$name, $email, $hash, $goal]);

        // Keep the members directory in sync with new login accounts.
        $stmt = $pdo->prepare(
            'INSERT INTO members (name, email, phone, plan, status, join_date, expiry_date)
             VALUES (?, ?, "", "Standard Fitness", "Active", CURDATE(), DATE_ADD(CURDATE(), INTERVAL 1 YEAR))'
        );
        $stmt->execute([$name, $email]);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        fail('Registration failed: ' . $e->getMessage(), 500);
    }

    ok(['message' => 'Member account created successfully. You can now log in.']);
}

// ---------------- TRAINER REGISTRATION ----------------
$spec = trim((string)($data['specialization'] ?? ''));
$exp  = (int)($data['experience'] ?? 0);
$shift = (string)($data['shift'] ?? '');

if ($spec === '' || $shift === '') {
    fail('Specialization and preferred shift are required.');
}

$pdo = db();
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "trainer")');
    $stmt->execute([$name, $email, $hash]);
    $userId = (int)$pdo->lastInsertId();

    $stmt = $pdo->prepare(
        'INSERT INTO trainers (user_id, specialization, experience, shifts, status)
         VALUES (?, ?, ?, ?, "pending")'
    );
    $stmt->execute([$userId, $spec, $exp, json_encode([$shift])]);

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    fail('Registration failed: ' . $e->getMessage(), 500);
}

ok(['message' => 'Trainer application submitted. The admin will verify your credentials soon.']);
