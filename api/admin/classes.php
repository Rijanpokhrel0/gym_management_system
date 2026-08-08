<?php
/**
 * Admin: group classes / sessions (own gym).
 * GET    - list classes (with booking counts + booked user ids)
 * POST   - create class
 * PUT    - update class
 * DELETE - delete class
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

$DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function fetch_class(int $adminId, int $classId): ?array
{
    $stmt = db()->prepare('SELECT * FROM gym_classes WHERE id = ? AND admin_id = ?');
    $stmt->execute([$classId, $adminId]);
    return $stmt->fetch() ?: null;
}

function class_counts(int $classId): array
{
    $c = db()->prepare('SELECT COUNT(*) AS n FROM class_bookings WHERE class_id = ? AND status = "booked"');
    $c->execute([$classId]);
    $booked = (int)$c->fetch()['n'];
    $ids = db()->prepare('SELECT user_id FROM class_bookings WHERE class_id = ? AND status = "booked"');
    $ids->execute([$classId]);
    return ['booked_count' => $booked, 'booked_user_ids' => array_map('intval', array_column($ids->fetchAll(), 'user_id'))];
}

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT gc.*, t.name AS trainer_name
            FROM gym_classes gc
            LEFT JOIN trainers t ON t.id = gc.trainer_id
            WHERE gc.admin_id = ?
            ORDER BY FIELD(gc.day_of_week, "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"), gc.start_time');
        $stmt->execute([$adminId]);
        $list = [];
        foreach ($stmt->fetchAll() as $c) {
            $list[] = array_merge($c, class_counts((int)$c['id']));
        }
        ok(['classes' => $list]);
        break;

    case 'POST':
        $name = trim((string)($d['name'] ?? ''));
        if ($name === '') {
            fail('Class name is required.');
        }
        $start = trim((string)($d['start_time'] ?? ''));
        $end   = trim((string)($d['end_time'] ?? ''));
        if (!preg_match('/^\d{2}:\d{2}/', $start) || !preg_match('/^\d{2}:\d{2}/', $end)) {
            fail('Start and end times are required (HH:MM).');
        }
        $stmt = db()->prepare('INSERT INTO gym_classes (admin_id, trainer_id, name, description, day_of_week, start_time, end_time, location, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId,
            (int)($d['trainer_id'] ?? 0) ?: null,
            $name,
            trim((string)($d['description'] ?? '')),
            in_array($d['day_of_week'] ?? '', $DAYS, true) ? $d['day_of_week'] : 'Monday',
            $start,
            $end,
            trim((string)($d['location'] ?? '')),
            (int)($d['capacity'] ?? 15),
            ($d['status'] ?? '') === 'inactive' ? 'inactive' : 'active',
        ]);
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'Class created.']);
        break;

    case 'PUT':
        $classId = (int)($d['id'] ?? 0);
        if (!fetch_class($adminId, $classId)) {
            fail('Class not found.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['name', 'description', 'location'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        if (array_key_exists('trainer_id', $d)) {
            $set[]  = 'trainer_id = ?';
            $args[] = (int)$d['trainer_id'] ?: null;
        }
        if (array_key_exists('day_of_week', $d) && in_array($d['day_of_week'], $DAYS, true)) {
            $set[]  = 'day_of_week = ?';
            $args[] = $d['day_of_week'];
        }
        foreach (['start_time', 'end_time'] as $f) {
            if (array_key_exists($f, $d) && preg_match('/^\d{2}:\d{2}/', (string)$d[$f])) {
                $set[]  = "`$f` = ?";
                $args[] = $d[$f];
            }
        }
        if (array_key_exists('capacity', $d)) {
            $set[]  = 'capacity = ?';
            $args[] = (int)$d['capacity'];
        }
        if (array_key_exists('status', $d)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'] === 'inactive' ? 'inactive' : 'active';
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $classId;
        db()->prepare('UPDATE gym_classes SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Class updated.']);
        break;

    case 'DELETE':
        $classId = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM gym_classes WHERE id = ? AND admin_id = ?')->execute([$classId, $adminId]);
        ok(['message' => 'Class removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
