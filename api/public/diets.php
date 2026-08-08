<?php
/**
 * Public: browse active diet plans of a gym - no login required.
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

$plans = db()->prepare('SELECT * FROM diet_plans WHERE admin_id = ? AND status = "active" ORDER BY created_at DESC');
$plans->execute([$gymId]);
$list = [];
foreach ($plans->fetchAll() as $p) {
    $meal = db()->prepare('SELECT * FROM diet_meals WHERE plan_id = ? ORDER BY day_label, sort_order');
    $meal->execute([(int)$p['id']]);
    $p['meals'] = $meal->fetchAll();
    $list[] = $p;
}
ok(['plans' => $list]);
