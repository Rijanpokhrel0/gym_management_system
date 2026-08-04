<?php
/**
 * /api/trainers.php
 *
 * GET  - List trainers.
 *        Admin may filter with ?status=pending|approved|rejected.
 *        Everyone else receives only the approved (public catalog) trainers.
 *
 * POST - Admin verifies a trainer application.
 *        Body: { id, action: "approve" | "reject" }
 */

require_once __DIR__ . '/../config/init.php';

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $u = current_user();

    if ($u && $u['role'] === 'admin') {
        $status = (string)($_GET['status'] ?? '');
        $sql = 'SELECT t.id, t.user_id, t.specialization, t.experience, t.shifts, t.status, t.registered_at,
                       u.name, u.email
                FROM trainers t
                JOIN users u ON u.id = t.user_id';
        $params = [];
        if (in_array($status, ['pending', 'approved', 'rejected'], true)) {
            $sql .= ' WHERE t.status = ?';
            $params[] = $status;
        }
        $sql .= ' ORDER BY t.registered_at DESC';

        $stmt = db()->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        foreach ($rows as &$r) {
            $r['shifts'] = json_decode($r['shifts'] ?? '[]', true);
        }
        ok(['trainers' => $rows]);
    }

    // Public / member catalog: verified trainers only.
    $stmt = db()->query(
        'SELECT t.id, t.specialization, t.experience, t.shifts, u.name, u.email
         FROM trainers t
         JOIN users u ON u.id = t.user_id
         WHERE t.status = "approved"
         ORDER BY u.name'
    );
    $rows = $stmt->fetchAll();
    foreach ($rows as &$r) {
        $r['shifts'] = json_decode($r['shifts'] ?? '[]', true);
    }
    ok(['trainers' => $rows]);
}

if ($method === 'POST') {
    require_role('admin');

    $data   = json_decode(file_get_contents('php://input'), true) ?: [];
    $id     = (int)($data['id'] ?? 0);
    $action = (string)($data['action'] ?? '');

    if (!in_array($action, ['approve', 'reject'], true)) {
        fail('Invalid action.');
    }

    $status = $action === 'approve' ? 'approved' : 'rejected';
    $stmt = db()->prepare('UPDATE trainers SET status = ? WHERE id = ?');
    $stmt->execute([$status, $id]);

    ok(['message' => $action === 'approve' ? 'Trainer approved and published to the catalog.' : 'Trainer application rejected.']);
}

fail('Method not allowed.', 405);
