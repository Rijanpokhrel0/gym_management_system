<?php
/**
 * User: self check-in to a gym.
 * GET  - my attendance history
 * POST - check in now (optionally specify admin_id = gym to check into)
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('user');
$userId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

function primary_gym(int $userId): ?int
{
    $u = db()->prepare('SELECT admin_id FROM users WHERE id = ?');
    $u->execute([$userId]);
    $adminId = $u->fetch()['admin_id'] ?? null;
    if ($adminId) {
        return (int)$adminId;
    }
    $g = db()->prepare('SELECT admin_id FROM user_gyms WHERE user_id = ? ORDER BY selected_at ASC LIMIT 1');
    $g->execute([$userId]);
    $row = $g->fetch();
    return $row ? (int)$row['admin_id'] : null;
}

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT a.*, ad.gym_name FROM attendance a
            JOIN admins ad ON ad.id = a.admin_id
            WHERE a.user_id = ?
            ORDER BY a.check_in_at DESC
            LIMIT 60');
        $stmt->execute([$userId]);
        ok(['attendance' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $adminId = (int)($d['admin_id'] ?? primary_gym($userId));
        $stmt = db()->prepare('SELECT id, gym_name FROM admins WHERE id = ? AND status = "active"');
        $stmt->execute([$adminId]);
        $gym = $stmt->fetch();
        if (!$gym) {
            fail('Gym not found or unavailable.', 404);
        }
        $member = db()->prepare('SELECT id FROM users WHERE id = ?');
        $member->execute([$userId]);
        if (!$member->fetch()) {
            fail('Member not found.', 404);
        }
        $dup = db()->prepare('SELECT id FROM attendance WHERE user_id = ? AND DATE(check_in_at) = CURDATE() AND admin_id = ?');
        $dup->execute([$userId, $adminId]);
        if ($dup->fetch()) {
            fail('You have already checked in to this gym today.');
        }
        db()->prepare('INSERT INTO attendance (admin_id, user_id, checked_in_by, check_in_at) VALUES (?, ?, "user", NOW())')
            ->execute([$adminId, $userId]);
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'Checked in to ' . $gym['gym_name'] . '.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
