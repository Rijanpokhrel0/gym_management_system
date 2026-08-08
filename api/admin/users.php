<?php
/**
 * Admin: manage the users of their own gym.
 * The admin can create users; optional email + password for direct login.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT id, name, email, phone, goal, created_at FROM users WHERE admin_id = ? ORDER BY created_at DESC');
        $stmt->execute([$adminId]);
        ok(['users' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $name  = trim((string)($d['name'] ?? ''));
        $email = strtolower(trim((string)($d['email'] ?? '')));
        $pass  = (string)($d['password'] ?? '');
        if ($name === '' || $email === '') {
            fail('User name and email are required.');
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail('Please enter a valid email address.');
        }
        $stmt = db()->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            fail('A user with that email already exists.', 409);
        }
        $stmt = db()->prepare('INSERT INTO users (admin_id, name, email, password, phone, goal) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId,
            $name,
            $email,
            $pass !== '' ? password_hash($pass, PASSWORD_BCRYPT) : password_hash(bin2hex(random_bytes(4)), PASSWORD_BCRYPT),
            trim((string)($d['phone'] ?? '')),
            trim((string)($d['goal'] ?? '')) ?: null,
        ]);
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'User created.']);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        $stmt = db()->prepare('SELECT * FROM users WHERE id = ? AND admin_id = ?');
        $stmt->execute([$id, $adminId]);
        if (!$stmt->fetch()) {
            fail('User not found in your gym.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['name', 'phone', 'goal'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]) ?: null;
            }
        }
        if (array_key_exists('email', $d) && filter_var($d['email'], FILTER_VALIDATE_EMAIL)) {
            $set[]  = 'email = ?';
            $args[] = strtolower(trim((string)$d['email']));
        }
        if (array_key_exists('password', $d) && trim((string)$d['password']) !== '') {
            $set[]  = 'password = ?';
            $args[] = password_hash($d['password'], PASSWORD_BCRYPT);
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $id;
        db()->prepare('UPDATE users SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'User updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM users WHERE id = ? AND admin_id = ?')->execute([$id, $adminId]);
        ok(['message' => 'User removed from your gym.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
