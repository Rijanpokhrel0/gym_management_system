<?php
/**
 * User: my assigned workout plans (with exercises, grouped by gym).
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('user');
$userId = (int)$ctx['id'];

$stmt = db()->prepare('SELECT wp.*, ad.gym_name, wa.assigned_at
    FROM workout_assignments wa
    JOIN workout_plans wp ON wp.id = wa.plan_id
    JOIN admins ad ON ad.id = wp.admin_id
    WHERE wa.user_id = ? AND wp.status = "active"
    ORDER BY wa.assigned_at DESC');
$stmt->execute([$userId]);

$plans = [];
foreach ($stmt->fetchAll() as $p) {
    $ex = db()->prepare('SELECT * FROM workout_exercises WHERE plan_id = ? ORDER BY day_label, sort_order');
    $ex->execute([$p['id']]);
    $p['exercises'] = $ex->fetchAll();
    $plans[] = $p;
}
ok(['plans' => $plans]);
