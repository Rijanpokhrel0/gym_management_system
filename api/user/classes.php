<?php
/**
 * User: group class booking for followed gyms.
 * GET    - ?admin_id=N (optional) => classes with my booking status + capacity
 * POST   - { class_id } book a class
 * DELETE - { class_id } cancel my booking
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('user');
$userId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $sql = 'SELECT gc.*, ad.gym_name, t.name AS trainer_name,
                   (SELECT COUNT(*) FROM class_bookings cb WHERE cb.class_id = gc.id AND cb.status = "booked") AS booked_count
                FROM gym_classes gc
                JOIN admins ad ON ad.id = gc.admin_id
                LEFT JOIN trainers t ON t.id = gc.trainer_id
                WHERE gc.status = "active"
                  AND gc.admin_id IN (SELECT admin_id FROM user_gyms WHERE user_id = ?)';
        $args = [$userId];
        if ((int)($_GET['admin_id'] ?? 0) > 0) {
            $sql .= ' AND gc.admin_id = ?';
            $args[] = (int)$_GET['admin_id'];
        }
        $sql .= ' ORDER BY FIELD(gc.day_of_week, "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"), gc.start_time';
        $stmt = db()->prepare($sql);
        $stmt->execute($args);

        $list = [];
        foreach ($stmt->fetchAll() as $c) {
            $mine = db()->prepare('SELECT status FROM class_bookings WHERE class_id = ? AND user_id = ?');
            $mine->execute([$c['id'], $userId]);
            $myRow = $mine->fetch();
            $c['my_booking'] = $myRow ? $myRow['status'] : null;
            $list[] = $c;
        }
        ok(['classes' => $list]);
        break;

    case 'POST':
        $classId = (int)($d['class_id'] ?? 0);
        $stmt = db()->prepare('SELECT * FROM gym_classes WHERE id = ? AND status = "active"');
        $stmt->execute([$classId]);
        $gymClass = $stmt->fetch();
        if (!$gymClass) {
            fail('Class not found.', 404);
        }
        $dup = db()->prepare('SELECT id FROM class_bookings WHERE class_id = ? AND user_id = ?');
        $dup->execute([$classId, $userId]);
        if ($dup->fetch()) {
            fail('You are already booked into this class.');
        }
        $cnt = db()->prepare('SELECT COUNT(*) AS n FROM class_bookings WHERE class_id = ? AND status = "booked"');
        $cnt->execute([$classId]);
        if ((int)$cnt->fetch()['n'] >= (int)$gymClass['capacity']) {
            fail('This class is already full.');
        }
        db()->prepare('INSERT INTO class_bookings (class_id, user_id, status) VALUES (?, ?, "booked")')
            ->execute([$classId, $userId]);
        ok(['message' => 'Class booked!']);
        break;

    case 'DELETE':
        $classId = (int)($d['class_id'] ?? 0);
        db()->prepare('UPDATE class_bookings SET status = "cancelled" WHERE class_id = ? AND user_id = ?')
            ->execute([$classId, $userId]);
        ok(['message' => 'Booking cancelled.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
