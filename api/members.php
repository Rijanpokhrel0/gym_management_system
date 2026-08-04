<?php
/**
 * /api/members.php  (Admin only)
 *
 * GET    - List all member directory records.
 * POST   - Create a member.  Body: { name, email, phone, plan, status, join_date, expiry_date }
 * PUT    - Update a member.  Body: { id, ...same fields }
 * DELETE - Delete a member.  Query: ?id=
 */

require_once __DIR__ . '/../config/init.php';

require_role('admin');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->query('SELECT * FROM members ORDER BY join_date DESC, id DESC');
    ok(['members' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $name = trim((string)($d['name'] ?? ''));
    if ($name === '') {
        fail('Member name is required.');
    }
    $stmt = db()->prepare(
        'INSERT INTO members (name, email, phone, plan, status, join_date, expiry_date)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $name,
        trim((string)($d['email'] ?? '')),
        trim((string)($d['phone'] ?? '')),
        (string)($d['plan'] ?? 'Standard Fitness'),
        (string)($d['status'] ?? 'Active'),
        (string)($d['join_date'] ?? date('Y-m-d')),
        (string)($d['expiry_date'] ?? ''),
    ]);
    ok(['message' => 'Member added successfully.', 'id' => (int)db()->lastInsertId()]);
}

if ($method === 'PUT') {
    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($d['id'] ?? 0);
    if (!$id) {
        fail('Member id is required.');
    }
    $name = trim((string)($d['name'] ?? ''));
    if ($name === '') {
        fail('Member name is required.');
    }
    $stmt = db()->prepare(
        'UPDATE members SET name=?, email=?, phone=?, plan=?, status=?, join_date=?, expiry_date=? WHERE id=?'
    );
    $stmt->execute([
        $name,
        trim((string)($d['email'] ?? '')),
        trim((string)($d['phone'] ?? '')),
        (string)($d['plan'] ?? 'Standard Fitness'),
        (string)($d['status'] ?? 'Active'),
        (string)($d['join_date'] ?? date('Y-m-d')),
        (string)($d['expiry_date'] ?? ''),
        $id,
    ]);
    ok(['message' => 'Member updated successfully.']);
}

if ($method === 'DELETE') {
    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        fail('Member id is required.');
    }
    db()->prepare('DELETE FROM members WHERE id = ?')->execute([$id]);
    ok(['message' => 'Member deleted.']);
}

fail('Method not allowed.', 405);
