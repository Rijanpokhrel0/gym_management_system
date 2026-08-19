<?php
/**
 * Superadmin: manage ALL users across all gyms.
 * GET  - list all users with gym info
 * PUT  - update any user (name, email, phone, goal, password, admin_id)
 * DELETE - remove a user
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

require_portal('superadmin');
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $rows = db()->query(
            'SELECT u.id, u.name, u.email, u.phone, u.goal, u.member_code, u.email_verified_at, u.created_at,
                    a.id AS admin_id, a.gym_name
             FROM users u
             LEFT JOIN admins a ON u.admin_id = a.id
             ORDER BY u.created_at DESC'
        )->fetchAll();
        ok(['users' => $rows]);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        if (!$id) fail('User id is required.');
        $user = db()->prepare('SELECT * FROM users WHERE id = ?');
        $user->execute([$id]);
        if (!$user->fetch()) fail('User not found.', 404);

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
        if (array_key_exists('admin_id', $d)) {
            $set[]  = 'admin_id = ?';
            $args[] = (int)$d['admin_id'] ?: null;
        }
        if (array_key_exists('password', $d) && trim((string)$d['password']) !== '') {
            $set[]  = 'password = ?';
            $args[] = password_hash($d['password'], PASSWORD_BCRYPT);
        }
        if (!$set) fail('Nothing to update.');
        $args[] = $id;
        db()->prepare('UPDATE users SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'User updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        if (!$id) fail('User id is required.');
        db()->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
        ok(['message' => 'User removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
