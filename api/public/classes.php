<?php
/**
 * Public: browse active group classes of a gym - no login required.
 * GET ?gym_id=
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$gymId = (int)($_GET['gym_id'] ?? 0);
if (!$gymId) {
    fail('gym_id is required.');
}

$stmt = db()->prepare('SELECT id FROM admins WHERE id = ? AND status = "active"');
$stmt->execute([$gymId]);
if (!$stmt->fetch()) {
    fail('Gym not found.', 404);
}

$stmt = db()->prepare('SELECT gc.*, t.name AS trainer_name
    FROM gym_classes gc
    LEFT JOIN trainers t ON t.id = gc.trainer_id
    WHERE gc.admin_id = ? AND gc.status = "active"
    ORDER BY FIELD(gc.day_of_week, "Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"), gc.start_time');
$stmt->execute([$gymId]);
$list = [];
foreach ($stmt->fetchAll() as $c) {
    $cnt = db()->prepare('SELECT COUNT(*) AS n FROM class_bookings WHERE class_id = ? AND status = "booked"');
    $cnt->execute([(int)$c['id']]);
    $c['booked_count'] = (int)$cnt->fetch()['n'];
    $list[] = $c;
}
ok(['classes' => $list]);
