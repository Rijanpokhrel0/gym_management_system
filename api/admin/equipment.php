<?php
/**
 * Admin: equipment management (own gym only).
 * Equipment = gym machines / tools / facilities shown to users.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT * FROM equipment WHERE admin_id = ? ORDER BY created_at DESC');
        $stmt->execute([$adminId]);
        ok(['equipment' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $name = trim((string)($d['name'] ?? ''));
        if ($name === '') {
            fail('Equipment name is required.');
        }
        $stmt = db()->prepare('INSERT INTO equipment (admin_id, name, category, quantity, description, status) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId,
            $name,
            trim((string)($d['category'] ?? '')),
            max(1, (int)($d['quantity'] ?? 1)),
            trim((string)($d['description'] ?? '')),
            ($d['status'] ?? '') === 'inactive' ? 'inactive' : 'active',
        ]);
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'Equipment added.']);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        $stmt = db()->prepare('SELECT * FROM equipment WHERE id = ? AND admin_id = ?');
        $stmt->execute([$id, $adminId]);
        if (!$stmt->fetch()) {
            fail('Equipment not found in your gym.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['name', 'category', 'description'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        if (array_key_exists('quantity', $d)) {
            $set[]  = 'quantity = ?';
            $args[] = max(1, (int)$d['quantity']);
        }
        if (array_key_exists('status', $d)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'] === 'inactive' ? 'inactive' : 'active';
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $id;
        db()->prepare('UPDATE equipment SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Equipment updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM equipment WHERE id = ? AND admin_id = ?')->execute([$id, $adminId]);
        ok(['message' => 'Equipment removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
