<?php
/**
 * Admin: trainers of their own gym (each trainer gets a login account).
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT * FROM trainers WHERE admin_id = ? ORDER BY created_at DESC');
        $stmt->execute([$adminId]);
        ok(['trainers' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $name = trim((string)($d['name'] ?? ''));
        $email = strtolower(trim((string)($d['email'] ?? '')));
        $pass = (string)($d['password'] ?? '');
        if ($name === '') {
            fail('Trainer name is required.');
        }
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            fail('A valid login email is required.');
        }
        if (strlen($pass) < 6) {
            fail('Password must be at least 6 characters.');
        }
        $dup = db()->prepare('SELECT id FROM trainers WHERE email = ?');
        $dup->execute([$email]);
        if ($dup->fetch()) {
            fail('That email is already used by another trainer.');
        }
        $stmt = db()->prepare('INSERT INTO trainers (admin_id, name, email, password, specialization, experience, phone, certifications, salary, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId,
            $name,
            $email,
            password_hash($pass, PASSWORD_BCRYPT),
            trim((string)($d['specialization'] ?? '')),
            (int)($d['experience'] ?? 0),
            trim((string)($d['phone'] ?? '')),
            trim((string)($d['certifications'] ?? '')),
            (float)($d['salary'] ?? 0),
            ($d['status'] ?? '') === 'inactive' ? 'inactive' : 'active',
        ]);
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'Trainer added with login access.']);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        $stmt = db()->prepare('SELECT * FROM trainers WHERE id = ? AND admin_id = ?');
        $stmt->execute([$id, $adminId]);
        if (!$stmt->fetch()) {
            fail('Trainer not found in your gym.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['name', 'specialization', 'phone', 'certifications'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        foreach (['experience', 'salary'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = (float)$d[$f];
            }
        }
        if (array_key_exists('email', $d) && trim((string)$d['email']) !== '') {
            $email = strtolower(trim((string)$d['email']));
            $dup = db()->prepare('SELECT id FROM trainers WHERE email = ? AND id != ?');
            $dup->execute([$email, $id]);
            if ($dup->fetch()) {
                fail('That email is already used by another trainer.');
            }
            $set[]  = 'email = ?';
            $args[] = $email;
        }
        if (array_key_exists('password', $d) && trim((string)$d['password']) !== '') {
            $pass = (string)$d['password'];
            if (strlen($pass) < 6) {
                fail('Password must be at least 6 characters.');
            }
            $set[]  = 'password = ?';
            $args[] = password_hash($pass, PASSWORD_BCRYPT);
        }
        if (array_key_exists('status', $d)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'] === 'inactive' ? 'inactive' : 'active';
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $id;
        db()->prepare('UPDATE trainers SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Trainer updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM trainers WHERE id = ? AND admin_id = ?')->execute([$id, $adminId]);
        ok(['message' => 'Trainer removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
