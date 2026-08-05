<?php
/**
 * /api/plans.php
 *
 * GET    - List membership plans (public - pricing cards on the user portal).
 * POST   - Admin creates a plan.    Body: { name, price, duration, features, popular }
 * PUT    - Admin updates a plan.    Body: { id, ...same fields }
 * DELETE - Admin deletes a plan.    Query: ?id=
 */

require_once __DIR__ . '/../config/init.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->query('SELECT * FROM membership_plans ORDER BY price');
    ok(['plans' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    require_role('admin');

    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $name = trim((string)($d['name'] ?? ''));
    if ($name === '') {
        fail('Plan name is required.');
    }
    $stmt = db()->prepare(
        'INSERT INTO membership_plans (name, price, duration, features, popular)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $name,
        (float)($d['price'] ?? 0),
        (string)($d['duration'] ?? 'Monthly'),
        trim((string)($d['features'] ?? '')),
        (int)($d['popular'] ?? 0),
    ]);
    ok(['message' => 'Membership plan created.', 'id' => (int)db()->lastInsertId()]);
}

if ($method === 'PUT') {
    require_role('admin');

    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($d['id'] ?? 0);
    if (!$id) {
        fail('Plan id is required.');
    }
    $name = trim((string)($d['name'] ?? ''));
    if ($name === '') {
        fail('Plan name is required.');
    }
    $stmt = db()->prepare(
        'UPDATE membership_plans SET name=?, price=?, duration=?, features=?, popular=? WHERE id=?'
    );
    $stmt->execute([
        $name,
        (float)($d['price'] ?? 0),
        (string)($d['duration'] ?? 'Monthly'),
        trim((string)($d['features'] ?? '')),
        (int)($d['popular'] ?? 0),
        $id,
    ]);
    ok(['message' => 'Membership plan updated.']);
}

if ($method === 'DELETE') {
    require_role('admin');

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        fail('Plan id is required.');
    }
    db()->prepare('DELETE FROM membership_plans WHERE id = ?')->execute([$id]);
    ok(['message' => 'Membership plan removed.']);
}

fail('Method not allowed.', 405);
