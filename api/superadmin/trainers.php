<?php
/**
 * Superadmin: manage ALL trainers across all gyms.
 * GET  - list all trainers with gym info
 * PUT  - update any trainer (name, email, specialization, status, password, admin_id)
 * DELETE - remove a trainer
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

require_portal('superadmin');
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $rows = db()->query(
            'SELECT t.id, t.name, t.email, t.specialization, t.experience, t.phone, t.salary, t.status, t.created_at,
                    a.id AS admin_id, a.gym_name
             FROM trainers t
             LEFT JOIN admins a ON t.admin_id = a.id
             ORDER BY t.created_at DESC'
        )->fetchAll();
        ok(['trainers' => $rows]);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        if (!$id) fail('Trainer id is required.');
        $trainer = db()->prepare('SELECT * FROM trainers WHERE id = ?');
        $trainer->execute([$id]);
        if (!$trainer->fetch()) fail('Trainer not found.', 404);

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
            if ($dup->fetch()) fail('That email is already used by another trainer.');
            $set[]  = 'email = ?';
            $args[] = $email;
        }
        if (array_key_exists('admin_id', $d)) {
            $set[]  = 'admin_id = ?';
            $args[] = (int)$d['admin_id'];
        }
        if (array_key_exists('password', $d) && trim((string)$d['password']) !== '') {
            $pass = (string)$d['password'];
            if (strlen($pass) < 6) fail('Password must be at least 6 characters.');
            $set[]  = 'password = ?';
            $args[] = password_hash($pass, PASSWORD_BCRYPT);
        }
        if (array_key_exists('status', $d)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'] === 'inactive' ? 'inactive' : 'active';
        }
        if (!$set) fail('Nothing to update.');
        $args[] = $id;
        db()->prepare('UPDATE trainers SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Trainer updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        if (!$id) fail('Trainer id is required.');
        db()->prepare('DELETE FROM trainers WHERE id = ?')->execute([$id]);
        ok(['message' => 'Trainer removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
