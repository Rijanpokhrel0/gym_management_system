<?php
/**
 * Trainer: attendance for the trainer's gym.
 * GET  - check-ins (filter: ?date=YYYY-MM-DD&user_id=N)
 * POST - manual check-in { user_id } or { member_code }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('trainer');
$trainerId = (int)$u['id'];
$t = db()->prepare('SELECT admin_id FROM trainers WHERE id = ?');
$t->execute([$trainerId]);
$row = $t->fetch();
if (!$row) {
    fail('Trainer not found.', 404);
}
$adminId = (int)$row['admin_id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $where = 'WHERE a.admin_id = ?';
        $args  = [$adminId];
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)($_GET['date'] ?? ''))) {
            $where .= ' AND DATE(a.check_in_at) = ?';
            $args[] = $_GET['date'];
        }
        if ((int)($_GET['user_id'] ?? 0) > 0) {
            $where .= ' AND a.user_id = ?';
            $args[] = (int)$_GET['user_id'];
        }
        $stmt = db()->prepare("SELECT a.*, u.name AS user_name, u.member_code
            FROM attendance a JOIN users u ON u.id = a.user_id
            $where ORDER BY a.check_in_at DESC LIMIT 500");
        $stmt->execute($args);
        ok(['attendance' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $userId = (int)($d['user_id'] ?? 0);
        $code   = strtoupper(trim((string)($d['member_code'] ?? '')));
        if ($userId === 0 && $code === '') {
            fail('Provide either a user or a member code.');
        }
        if ($userId > 0) {
            $stmt = db()->prepare('SELECT id FROM users WHERE id = ? AND admin_id = ?');
            $stmt->execute([$userId, $adminId]);
        } else {
            $stmt = db()->prepare('SELECT id FROM users WHERE UPPER(member_code) = ? AND admin_id = ?');
            $stmt->execute([$code, $adminId]);
        }
        $user = $stmt->fetch();
        if (!$user) {
            fail('Member not found in this gym.');
        }
        $userId = (int)$user['id'];
        $dup = db()->prepare('SELECT id FROM attendance WHERE user_id = ? AND DATE(check_in_at) = CURDATE()');
        $dup->execute([$userId]);
        if ($dup->fetch()) {
            fail('This member has already checked in today.');
        }
        db()->prepare('INSERT INTO attendance (admin_id, user_id, checked_in_by, check_in_at) VALUES (?, ?, "trainer", NOW())')
            ->execute([$adminId, $userId]);
        ok(['message' => 'Check-in recorded.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
