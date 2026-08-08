<?php
/**
 * Admin: announcements (own gym). Posting one pushes a notification to every
 * member of the gym.
 * GET    - list announcements
 * POST   - create announcement (notifies all gym members)
 * PUT    - update announcement
 * DELETE - delete announcement
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

$PRIORITY = ['normal', 'important', 'urgent'];

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT * FROM announcements WHERE admin_id = ? ORDER BY created_at DESC');
        $stmt->execute([$adminId]);
        ok(['announcements' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $title = trim((string)($d['title'] ?? ''));
        if ($title === '') {
            fail('Announcement title is required.');
        }
        $priority = in_array($d['priority'] ?? '', $PRIORITY, true) ? $d['priority'] : 'normal';
        $stmt = db()->prepare('INSERT INTO announcements (admin_id, title, body, priority, status) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId, $title, trim((string)($d['body'] ?? '')), $priority,
            ($d['status'] ?? '') === 'inactive' ? 'inactive' : 'active',
        ]);
        $annId = (int)db()->lastInsertId();

        if (($d['notify'] ?? true)) {
            $users = db()->prepare('SELECT id FROM users WHERE admin_id = ? OR id IN (SELECT user_id FROM user_gyms WHERE admin_id = ?)');
            $users->execute([$adminId, $adminId]);
            $ins = db()->prepare('INSERT INTO notifications (user_id, admin_id, type, title, body) VALUES (?, ?, "announcement", ?, ?)');
            foreach ($users->fetchAll() as $u) {
                $ins->execute([(int)$u['id'], $adminId, $title, trim((string)($d['body'] ?? ''))]);
            }
        }
        ok(['id' => $annId, 'message' => 'Announcement posted' . ($d['notify'] ?? true ? ' and members notified.' : '.')]);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        $stmt = db()->prepare('SELECT id FROM announcements WHERE id = ? AND admin_id = ?');
        $stmt->execute([$id, $adminId]);
        if (!$stmt->fetch()) {
            fail('Announcement not found.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['title', 'body'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        if (array_key_exists('priority', $d) && in_array($d['priority'], $PRIORITY, true)) {
            $set[]  = 'priority = ?';
            $args[] = $d['priority'];
        }
        if (array_key_exists('status', $d)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'] === 'inactive' ? 'inactive' : 'active';
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $id;
        db()->prepare('UPDATE announcements SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Announcement updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM announcements WHERE id = ? AND admin_id = ?')->execute([$id, $adminId]);
        ok(['message' => 'Announcement removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
