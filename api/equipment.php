<?php
/**
 * /api/equipment.php
 *
 * GET    - List gym equipment (public - visible to users and admins).
 * POST   - Admin adds equipment.      Body: { name, category, quantity, equipment_status, last_maintenance, notes }
 * PUT    - Admin updates equipment.   Body: { id, ...same fields }
 * DELETE - Admin deletes equipment.   Query: ?id=
 */

require_once __DIR__ . '/../config/init.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $category = (string)($_GET['category'] ?? '');
    if ($category !== '') {
        $stmt = db()->prepare('SELECT * FROM equipment WHERE category = ? ORDER BY name');
        $stmt->execute([$category]);
        ok(['equipment' => $stmt->fetchAll()]);
    }
    $stmt = db()->query('SELECT * FROM equipment ORDER BY category, name');
    ok(['equipment' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    require_role('admin');

    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $name = trim((string)($d['name'] ?? ''));
    if ($name === '') {
        fail('Equipment name is required.');
    }
    $stmt = db()->prepare(
        'INSERT INTO equipment (name, category, quantity, equipment_status, last_maintenance, notes)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $name,
        trim((string)($d['category'] ?? 'Strength')),
        max(1, (int)($d['quantity'] ?? 1)),
        (string)($d['equipment_status'] ?? 'Good'),
        (string)($d['last_maintenance'] ?? ''),
        trim((string)($d['notes'] ?? '')),
    ]);
    ok(['message' => 'Equipment added successfully.', 'id' => (int)db()->lastInsertId()]);
}

if ($method === 'PUT') {
    require_role('admin');

    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($d['id'] ?? 0);
    if (!$id) {
        fail('Equipment id is required.');
    }
    $name = trim((string)($d['name'] ?? ''));
    if ($name === '') {
        fail('Equipment name is required.');
    }
    $stmt = db()->prepare(
        'UPDATE equipment SET name=?, category=?, quantity=?, equipment_status=?, last_maintenance=?, notes=? WHERE id=?'
    );
    $stmt->execute([
        $name,
        trim((string)($d['category'] ?? 'Strength')),
        max(1, (int)($d['quantity'] ?? 1)),
        (string)($d['equipment_status'] ?? 'Good'),
        (string)($d['last_maintenance'] ?? ''),
        trim((string)($d['notes'] ?? '')),
        $id,
    ]);
    ok(['message' => 'Equipment updated successfully.']);
}

if ($method === 'DELETE') {
    require_role('admin');

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        fail('Equipment id is required.');
    }
    db()->prepare('DELETE FROM equipment WHERE id = ?')->execute([$id]);
    ok(['message' => 'Equipment removed.']);
}

fail('Method not allowed.', 405);
