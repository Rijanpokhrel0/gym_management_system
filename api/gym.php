<?php
/**
 * /api/gym.php
 *
 * GET - Return the gym profile (about, location, hours, contact) - public.
 * PUT - Admin updates the gym profile.
 *       Body: { name, about, address, phone, email, hours, map_url }
 */

require_once __DIR__ . '/../config/init.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->query('SELECT * FROM gym_info ORDER BY id LIMIT 1');
    $row = $stmt->fetch();
    if (!$row) {
        fail('Gym profile not configured yet.', 404);
    }
    ok(['gym' => $row]);
}

if ($method === 'PUT') {
    require_role('admin');

    $d = json_decode(file_get_contents('php://input'), true) ?: [];

    $stmt = db()->query('SELECT id FROM gym_info ORDER BY id LIMIT 1');
    $existing = $stmt->fetch();

    $fields = [
        trim((string)($d['name'] ?? 'FitPulse Gym')),
        trim((string)($d['about'] ?? '')),
        trim((string)($d['address'] ?? '')),
        trim((string)($d['phone'] ?? '')),
        trim((string)($d['email'] ?? '')),
        trim((string)($d['hours'] ?? '')),
        trim((string)($d['map_url'] ?? '')),
    ];

    if ($existing) {
        $stmt = db()->prepare(
            'UPDATE gym_info SET name=?, about=?, address=?, phone=?, email=?, hours=?, map_url=? WHERE id=?'
        );
        $stmt->execute([...$fields, (int)$existing['id']]);
    } else {
        $stmt = db()->prepare(
            'INSERT INTO gym_info (name, about, address, phone, email, hours, map_url) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $stmt->execute($fields);
    }

    ok(['message' => 'Gym profile updated successfully.']);
}

fail('Method not allowed.', 405);
