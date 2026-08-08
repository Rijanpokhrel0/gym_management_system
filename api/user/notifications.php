<?php
/**
 * User: in-app notifications.
 * GET          - my notifications (optionally ?unread=1)
 * POST action  - { action: "read", id } mark one read | { action: "read_all" }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('user');
$userId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $sql = 'SELECT n.*, ad.gym_name FROM notifications n
            LEFT JOIN admins ad ON ad.id = n.admin_id
            WHERE n.user_id = ?';
        $args = [$userId];
        if (($_GET['unread'] ?? '') === '1') {
            $sql .= ' AND n.is_read = 0';
        }
        $sql .= ' ORDER BY n.created_at DESC LIMIT 80';
        $stmt = db()->prepare($sql);
        $stmt->execute($args);
        $rows = $stmt->fetchAll();
        $unread = db()->prepare('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND is_read = 0');
        $unread->execute([$userId]);
        ok(['notifications' => $rows, 'unread_count' => (int)$unread->fetch()['n']]);
        break;

    case 'POST':
        $action = $d['action'] ?? '';
        if ($action === 'read_all') {
            db()->prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?')->execute([$userId]);
            ok(['message' => 'All notifications marked as read.']);
        }
        if ($action === 'read') {
            db()->prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
                ->execute([(int)($d['id'] ?? 0), $userId]);
            ok(['message' => 'Notification marked as read.']);
        }
        fail('Invalid action.');
        break;

    default:
        fail('Method not allowed.', 405);
}
