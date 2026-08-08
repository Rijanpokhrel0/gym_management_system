<?php
/**
 * Public: browse active workout plans of a gym - no login required.
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

$plans = db()->prepare('SELECT * FROM workout_plans WHERE admin_id = ? AND status = "active" ORDER BY created_at DESC');
$plans->execute([$gymId]);
$list = [];
foreach ($plans->fetchAll() as $p) {
    $ex = db()->prepare('SELECT * FROM workout_exercises WHERE plan_id = ? ORDER BY day_label, sort_order');
    $ex->execute([(int)$p['id']]);
    $p['exercises'] = $ex->fetchAll();
    $list[] = $p;
}
ok(['plans' => $list]);
