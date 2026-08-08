<?php
/**
 * User: my assigned diet plans (with meals, grouped by gym).
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('user');
$userId = (int)$ctx['id'];

$stmt = db()->prepare('SELECT dp.*, ad.gym_name, da.assigned_at
    FROM diet_assignments da
    JOIN diet_plans dp ON dp.id = da.plan_id
    JOIN admins ad ON ad.id = dp.admin_id
    WHERE da.user_id = ? AND dp.status = "active"
    ORDER BY da.assigned_at DESC');
$stmt->execute([$userId]);

$plans = [];
foreach ($stmt->fetchAll() as $p) {
    $meals = db()->prepare('SELECT * FROM diet_meals WHERE plan_id = ? ORDER BY day_label, sort_order');
    $meals->execute([$p['id']]);
    $p['meals'] = $meals->fetchAll();
    $plans[] = $p;
}
ok(['plans' => $plans]);
