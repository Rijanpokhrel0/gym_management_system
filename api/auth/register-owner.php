<?php
/**
 * Owner Registration - allows gym owners to self-register with 14-day free trial.
 * POST { name, email, password, phone, gym_name, address, description }
 *
 * Creates a pending admin account with 14-day trial. Owner must submit payment
 * proof after registration. Superadmin approves/rejects the registration.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';
require_once __DIR__ . '/../../config/mailer.php';

$d = body();
$name     = trim((string)($d['name'] ?? ''));
$email    = strtolower(trim((string)($d['email'] ?? '')));
$password = (string)($d['password'] ?? '');
$phone    = trim((string)($d['phone'] ?? ''));
$gymName  = trim((string)($d['gym_name'] ?? ''));
$address  = trim((string)($d['address'] ?? ''));
$description = trim((string)($d['description'] ?? ''));

if ($name === '' || $email === '' || $password === '') {
    fail('Name, email and password are required.');
}
if (strlen($password) < 6) {
    fail('Password must be at least 6 characters.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    fail('Please enter a valid email address.');
}
if ($gymName === '') {
    fail('Gym name is required.');
}

// Check if email already exists
$stmt = db()->prepare('SELECT id FROM admins WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    fail('An account with that email already exists.', 409);
}

// Create admin with 14-day trial
$trialEnd = date('Y-m-d H:i:s', strtotime('+14 days'));
$stmt = db()->prepare(
    'INSERT INTO admins (name, email, password, gym_name, phone, address, description, status, verification_status, trial_ends_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $name,
    $email,
    password_hash($password, PASSWORD_BCRYPT),
    $gymName,
    $phone,
    $address,
    $description,
    'active',
    'pending',
    $trialEnd
]);
$adminId = (int)db()->lastInsertId();

// Create registration record
$stmt = db()->prepare(
    'INSERT INTO owner_registrations (admin_id, amount, status) VALUES (?, ?, ?)'
);
$stmt->execute([$adminId, 500, 'pending']);

// Auto sign-in
sign_in('admin', $adminId);

ok([
    'id'          => $adminId,
    'email'       => $email,
    'portal'      => 'admin',
    'name'        => $name,
    'trial_ends_at' => $trialEnd,
    'message'     => 'Registration successful! You have a 14-day free trial to set up your gym. Please submit payment proof to continue after the trial.',
]);
