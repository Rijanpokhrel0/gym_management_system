<?php
/**
 * Admin: fitness progress records (own gym members).
 * GET    - ?user_id=N (required) => logs for a member
 * POST   - create a progress entry
 * PUT    - update an entry
 * DELETE - remove an entry
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

// Validate that a user belongs to this admin's gym.
function gym_user(int $adminId, int $userId): bool
{
    $stmt = db()->prepare('SELECT id FROM users WHERE id = ? AND admin_id = ?');
    $stmt->execute([$userId, $adminId]);
    return (bool)$stmt->fetch();
}

switch ($method) {
    case 'GET':
        $userId = (int)($_GET['user_id'] ?? 0);
        if ($userId === 0 || !gym_user($adminId, $userId)) {
            fail('Invalid member.', 404);
        }
        $stmt = db()->prepare('SELECT * FROM fitness_progress WHERE user_id = ? AND admin_id = ? ORDER BY recorded_at DESC');
        $stmt->execute([$userId, $adminId]);
        $rows = $stmt->fetchAll();
        $u = db()->prepare('SELECT id, name, email, member_code, goal FROM users WHERE id = ?');
        $u->execute([$userId]);
        ok(['member' => $u->fetch(), 'progress' => $rows]);
        break;

    case 'POST':
        $userId = (int)($d['user_id'] ?? 0);
        $date   = trim((string)($d['recorded_at'] ?? date('Y-m-d')));
        if ($userId === 0 || !gym_user($adminId, $userId)) {
            fail('Invalid member.', 404);
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            fail('recorded_at must be a valid date (YYYY-MM-DD).');
        }
        $dup = db()->prepare('SELECT id FROM fitness_progress WHERE user_id = ? AND recorded_at = ?');
        $dup->execute([$userId, $date]);
        if ($dup->fetch()) {
            fail('A progress entry already exists for this member on that date.');
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

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        $stmt = db()->prepare('SELECT * FROM fitness_progress WHERE id = ? AND admin_id = ?');
        $stmt->execute([$id, $adminId]);
        if (!$stmt->fetch()) {
            fail('Progress entry not found.', 404);
        }
        $set  = [];
        $args = [];
        if (array_key_exists('recorded_at', $d) && preg_match('/^\d{4}-\d{2}-\d{2}$/', (string)$d['recorded_at'])) {
            $set[]  = 'recorded_at = ?';
            $args[] = $d['recorded_at'];
        }
        foreach (['weight', 'body_fat', 'bmi', 'chest', 'waist', 'arms'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = $d[$f] === '' || $d[$f] === null ? null : (float)$d[$f];
            }
        }
        if (array_key_exists('notes', $d)) {
            $set[]  = 'notes = ?';
            $args[] = trim((string)$d['notes']);
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $id;
        db()->prepare('UPDATE fitness_progress SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Progress entry updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM fitness_progress WHERE id = ? AND admin_id = ?')->execute([$id, $adminId]);
        ok(['message' => 'Progress entry removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
