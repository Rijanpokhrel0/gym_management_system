<?php
/**
 * Trainer: fitness progress of gym members.
 * GET  - ?user_id=N => member's progress logs
 * POST - add a progress entry
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

function gym_user_check(int $adminId, int $userId): bool
{
    $s = db()->prepare('SELECT id FROM users WHERE id = ? AND admin_id = ?');
    $s->execute([$userId, $adminId]);
    return (bool)$s->fetch();
}

switch ($method) {
    case 'GET':
        $userId = (int)($_GET['user_id'] ?? 0);
        if ($userId === 0 || !gym_user_check($adminId, $userId)) {
            fail('Invalid member.', 404);
        }
        $stmt = db()->prepare('SELECT * FROM fitness_progress WHERE user_id = ? AND admin_id = ? ORDER BY recorded_at DESC');
        $stmt->execute([$userId, $adminId]);
        $m = db()->prepare('SELECT id, name, email, member_code, goal FROM users WHERE id = ?');
        $m->execute([$userId]);
        ok(['member' => $m->fetch(), 'progress' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $userId = (int)($d['user_id'] ?? 0);
        $date   = trim((string)($d['recorded_at'] ?? date('Y-m-d')));
        if ($userId === 0 || !gym_user_check($adminId, $userId)) {
            fail('Invalid member.', 404);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            fail('recorded_at must be a valid date (YYYY-MM-DD).');
        }
        $stmt = db()->prepare('INSERT INTO fitness_progress (user_id, admin_id, recorded_at, weight, body_fat, bmi, chest, waist, arms, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $userId, $adminId, $date,
            ($d['weight']  ?? '') !== '' ? (float)$d['weight']  : null,
            ($d['body_fat'] ?? '') !== '' ? (float)$d['body_fat'] : null,
            ($d['bmi']     ?? '') !== '' ? (float)$d['bmi']     : null,
            ($d['chest']   ?? '') !== '' ? (float)$d['chest']   : null,
            ($d['waist']   ?? '') !== '' ? (float)$d['waist']   : null,
            ($d['arms']    ?? '') !== '' ? (float)$d['arms']    : null,
            trim((string)($d['notes'] ?? '')),
        ]);
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'Progress entry added.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
