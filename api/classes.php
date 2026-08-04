<?php
/**
 * /api/classes.php
 *
 * GET    - List all fitness classes (public).
 * POST   - Admin creates a class.  Body: { title, trainer, day, time, capacity, category }
 * DELETE - Admin deletes a class.  Query: ?id=
 */

require_once __DIR__ . '/../config/init.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->query('SELECT * FROM classes ORDER BY day, time');
    ok(['classes' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    require_role('admin');

    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $title = trim((string)($d['title'] ?? ''));
    if ($title === '') {
        fail('Class title is required.');
    }
    $stmt = db()->prepare(
        'INSERT INTO classes (title, trainer, day, time, capacity, category)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $title,
        trim((string)($d['trainer'] ?? '')),
        (string)($d['day'] ?? 'Monday'),
        (string)($d['time'] ?? ''),
        (int)($d['capacity'] ?? 20),
        (string)($d['category'] ?? 'Fitness'),
    ]);
    ok(['message' => 'Class scheduled successfully.', 'id' => (int)db()->lastInsertId()]);
}

if ($method === 'DELETE') {
    require_role('admin');

    $id = (int)($_GET['id'] ?? 0);
    if (!$id) {
        fail('Class id is required.');
    }
    db()->prepare('DELETE FROM classes WHERE id = ?')->execute([$id]);
    ok(['message' => 'Class removed.']);
}

fail('Method not allowed.', 405);
