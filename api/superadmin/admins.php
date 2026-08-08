<?php
/**
 * Superadmin: manage Admin (gym owner) accounts.
 * GET  - list all admins + current subscription status
 * POST - create admin (with optional initial subscription plan)
 * PUT  - update name/gym/phone/address/description or status (suspend/activate)
 * DELETE - remove an admin
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

require_portal('superadmin');
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $rows = db()->query('SELECT id, name, email, gym_name, phone, address, logo_url, description, status, created_at
            FROM admins
            ORDER BY created_at DESC')->fetchAll();
        ok(['admins' => $rows]);
        break;

    case 'POST':
        $name  = trim((string)($d['name'] ?? ''));
        $email = strtolower(trim((string)($d['email'] ?? '')));
        $pass  = (string)($d['password'] ?? '');
        $logo  = trim((string)($d['logo_url'] ?? ''));
        if ($name === '' || $email === '' || $pass === '') {
            fail('Name, email and password are required.');
        }
        if ($logo === '') {
            fail('A gym logo is required. Upload the gym logo image.');
        }
        if (strlen($pass) < 6) {
            fail('Password must be at least 6 characters.');
        }
        $stmt = db()->prepare('SELECT id FROM admins WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            fail('An admin with that email already exists.', 409);
        }
        $stmt = db()->prepare('INSERT INTO admins (name, email, password, gym_name, phone, address, logo_url, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $name,
            $email,
            password_hash($pass, PASSWORD_BCRYPT),
            trim((string)($d['gym_name'] ?? '')),
            trim((string)($d['phone'] ?? '')),
            trim((string)($d['address'] ?? '')),
            trim((string)($d['logo_url'] ?? '')),
            trim((string)($d['description'] ?? '')),
        ]);
        $id = (int)db()->lastInsertId();
        ok(['id' => $id, 'message' => 'Admin account created.']);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        if (!$id) {
            fail('Admin id is required.');
        }
        $admin = db()->prepare('SELECT * FROM admins WHERE id = ?');
        $admin->execute([$id]);
        if (!$admin->fetch()) {
            fail('Admin not found.', 404);
        }
        $fields = ['gym_name', 'phone', 'address', 'logo_url', 'description'];
        $set  = [];
        $args = [];
        foreach ($fields as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        if (array_key_exists('name', $d)) {
            $set[]  = 'name = ?';
            $args[] = trim((string)$d['name']);
        }
        if (array_key_exists('status', $d)) {
            $v = $d['status'];
            if (!in_array($v, ['active', 'suspended'], true)) {
                fail('Invalid status.');
            }
            $set[]  = 'status = ?';
            $args[] = $v;
        }
        if (array_key_exists('password', $d) && trim((string)$d['password']) !== '') {
            $set[]  = 'password = ?';
            $args[] = password_hash($d['password'], PASSWORD_BCRYPT);
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $id;
        db()->prepare('UPDATE admins SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Admin updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        if (!$id) {
            fail('Admin id is required.');
        }
        db()->prepare('DELETE FROM admins WHERE id = ?')->execute([$id]);
        ok(['message' => 'Admin removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
