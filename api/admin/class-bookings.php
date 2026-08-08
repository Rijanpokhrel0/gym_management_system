<?php
/**
 * Admin: class bookings (own gym).
 * GET    - ?class_id=N => roster of booked members
 * POST   - { class_id, user_id } book a member (respects capacity)
 * DELETE - { class_id, user_id } cancel a booking
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

$classId = (int)($method === 'GET' ? ($_GET['class_id'] ?? 0) : ($d['class_id'] ?? 0));
$stmt = db()->prepare('SELECT * FROM gym_classes WHERE id = ? AND admin_id = ?');
$stmt->execute([$classId, $adminId]);
$gymClass = $stmt->fetch();
if (!$gymClass) {
    fail('Class not found.', 404);
}

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT cb.*, u.name, u.email, u.member_code
            FROM class_bookings cb
            JOIN users u ON u.id = cb.user_id
            WHERE cb.class_id = ? AND cb.status = "booked"
            ORDER BY u.name');
        $stmt->execute([$classId]);
        ok(['bookings' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $userId = (int)($d['user_id'] ?? 0);
        $chk = db()->prepare('SELECT id FROM users WHERE id = ? AND admin_id = ?');
        $chk->execute([$userId, $adminId]);
        if (!$chk->fetch()) {
            fail('Member not found in your gym.', 404);
        }
        $dup = db()->prepare('SELECT id FROM class_bookings WHERE class_id = ? AND user_id = ?');
        $dup->execute([$classId, $userId]);
        if ($dup->fetch()) {
            fail('This member is already booked into the class.');
        }
        $cnt = db()->prepare('SELECT COUNT(*) AS n FROM class_bookings WHERE class_id = ? AND status = "booked"');
        $cnt->execute([$classId]);
        if ((int)$cnt->fetch()['n'] >= (int)$gymClass['capacity']) {
            fail('This class is already full.');
        }
        db()->prepare('INSERT INTO class_bookings (class_id, user_id, status) VALUES (?, ?, "booked")')
            ->execute([$classId, $userId]);
        db()->prepare('INSERT INTO notifications (user_id, admin_id, type, title, body) VALUES (?, ?, "class", ?, ?)')
            ->execute([$userId, $adminId, 'Class booked', "You are booked for {$gymClass['name']} on {$gymClass['day_of_week']} at {$gymClass['start_time']}."]);
        ok(['message' => 'Member booked into class.']);
        break;

    case 'DELETE':
        $userId = (int)($d['user_id'] ?? 0);
        db()->prepare('UPDATE class_bookings SET status = "cancelled" WHERE class_id = ? AND user_id = ?')
            ->execute([$classId, $userId]);
        ok(['message' => 'Booking cancelled.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
