<?php
/**
 * Trainer: group classes of the trainer's gym (with rosters).
 * GET            - list classes
 * POST           - create class
 * PUT            - update class
 * DELETE         - delete class
 * POST action=roster | action=book | action=cancel
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

$DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

$class_exists = function (int $classId) use ($adminId): bool {
    $s = db()->prepare('SELECT * FROM gym_classes WHERE id = ? AND admin_id = ?');
    $s->execute([$classId, $adminId]);
    return (bool)$s->fetch();
};

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT gc.*, (SELECT COUNT(*) FROM class_bookings cb WHERE cb.class_id = gc.id AND cb.status = "booked") AS booked_count
            FROM gym_classes gc WHERE gc.admin_id = ?
            ORDER BY FIELD(gc.day_of_week, "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"), gc.start_time');
        $stmt->execute([$adminId]);
        ok(['classes' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $action = $d['action'] ?? 'create';
        if ($action === 'roster') {
            $classId = (int)($d['class_id'] ?? 0);
            if (!$class_exists($classId)) {
                fail('Class not found.', 404);
            }
            $stmt = db()->prepare('SELECT cb.*, u.name, u.email, u.member_code FROM class_bookings cb
                JOIN users u ON u.id = cb.user_id WHERE cb.class_id = ? AND cb.status = "booked" ORDER BY u.name');
            $stmt->execute([$classId]);
            ok(['bookings' => $stmt->fetchAll()]);
        }
        if ($action === 'book' || $action === 'cancel') {
            $classId = (int)($d['class_id'] ?? 0);
            if (!$class_exists($classId)) {
                fail('Class not found.', 404);
            }
            $userId = (int)($d['user_id'] ?? 0);
            if ($action === 'book') {
                $dup = db()->prepare('SELECT id FROM class_bookings WHERE class_id = ? AND user_id = ?');
                $dup->execute([$classId, $userId]);
                if (!$dup->fetch()) {
                    db()->prepare('INSERT INTO class_bookings (class_id, user_id, status) VALUES (?, ?, "booked")')
                        ->execute([$classId, $userId]);
                }
            } else {
                db()->prepare('UPDATE class_bookings SET status = "cancelled" WHERE class_id = ? AND user_id = ?')
                    ->execute([$classId, $userId]);
            }
            ok(['message' => 'Booking updated.']);
        }

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
            $adminId, $trainerId, $name,
            trim((string)($d['description'] ?? '')),
            in_array($d['day_of_week'] ?? '', $DAYS, true) ? $d['day_of_week'] : 'Monday',
            $start, $end,
            trim((string)($d['location'] ?? '')),
            (int)($d['capacity'] ?? 15),
            ($d['status'] ?? '') === 'inactive' ? 'inactive' : 'active',
        ]);
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'Class created.']);
        break;

    case 'PUT':
        $classId = (int)($d['id'] ?? 0);
        if (!$class_exists($classId)) {
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
