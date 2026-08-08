<?php
/**
 * User: fitness progress tracking (own records).
 * GET  - my progress logs (optionally ?admin_id=N to filter gym)
 * POST - add a progress entry { recorded_at, weight, ... } for a followed gym
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('user');
$userId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

function followed_gym(int $userId, ?int $adminId): ?int
{
    $sql = 'SELECT admin_id FROM user_gyms WHERE user_id = ?';
    $args = [$userId];
    if ($adminId) {
        $sql .= ' AND admin_id = ?';
        $args[] = $adminId;
    }
    $sql .= ' ORDER BY selected_at ASC LIMIT 1';
    $s = db()->prepare($sql);
    $s->execute($args);
    $row = $s->fetch();
    return $row ? (int)$row['admin_id'] : null;
}

switch ($method) {
    case 'GET':
        $adminId = followed_gym($userId, (int)($_GET['admin_id'] ?? 0));
        if (!$adminId) {
            ok(['progress' => []]);
        }
        $stmt = db()->prepare('SELECT fp.*, ad.gym_name FROM fitness_progress fp
            JOIN admins ad ON ad.id = fp.admin_id
            WHERE fp.user_id = ? AND fp.admin_id = ?
            ORDER BY fp.recorded_at DESC');
        $stmt->execute([$userId, $adminId]);
        ok(['progress' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $adminId = followed_gym($userId, (int)($d['admin_id'] ?? 0));
        if (!$adminId) {
            fail('Select a gym you follow first to record progress.');
        }
        $date = trim((string)($d['recorded_at'] ?? date('Y-m-d')));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            fail('recorded_at must be a valid date (YYYY-MM-DD).');
        }
        $dup = db()->prepare('SELECT id FROM fitness_progress WHERE user_id = ? AND recorded_at = ?');
        $dup->execute([$userId, $date]);
        if ($dup->fetch()) {
            fail('A progress entry already exists for this date.');
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
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'Progress saved.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
