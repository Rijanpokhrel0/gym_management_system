<?php
/**
 * Trainer: diet plans of the trainer's gym (with meals + assignments).
 * GET    - list plans
 * POST   - create plan (+ meals[])
 * PUT    - update plan (+ meals[])
 * DELETE - delete plan
 * POST action=assign | action=unassign manage member assignments
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

$MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-Workout', 'Post-Workout'];

$plan_exists = function (int $planId) use ($adminId): bool {
    $s = db()->prepare('SELECT id FROM diet_plans WHERE id = ? AND admin_id = ?');
    $s->execute([$planId, $adminId]);
    return (bool)$s->fetch();
};

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT * FROM diet_plans WHERE admin_id = ? ORDER BY created_at DESC');
        $stmt->execute([$adminId]);
        $list = [];
        foreach ($stmt->fetchAll() as $p) {
            $meals = db()->prepare('SELECT * FROM diet_meals WHERE plan_id = ? ORDER BY day_label, sort_order');
            $meals->execute([$p['id']]);
            $p['meals'] = $meals->fetchAll();
            $list[] = $p;
        }
        ok(['plans' => $list]);
        break;

    case 'POST':
        if (($d['action'] ?? '') === 'assign' || ($d['action'] ?? '') === 'unassign') {
            $planId = (int)($d['plan_id'] ?? 0);
            if (!$plan_exists($planId)) {
                fail('Plan not found.', 404);
            }
            $userIds = array_filter(array_map('intval', (array)($d['user_ids'] ?? [])));
            if ($d['action'] === 'assign') {
                $ins = db()->prepare('INSERT IGNORE INTO diet_assignments (admin_id, plan_id, user_id) VALUES (?, ?, ?)');
                foreach ($userIds as $uid) {
                    $chk = db()->prepare('SELECT id FROM users WHERE id = ? AND admin_id = ?');
                    $chk->execute([$uid, $adminId]);
                    if ($chk->fetch()) {
                        $ins->execute([$adminId, $planId, $uid]);
                    }
                }
                ok(['message' => 'Members assigned.']);
            }
            db()->prepare('DELETE FROM diet_assignments WHERE plan_id = ? AND user_id IN (' . implode(',', $userIds ?: [0]) . ')')
                ->execute([$planId]);
            ok(['message' => 'Assignment removed.']);
        }

        $title = trim((string)($d['title'] ?? ''));
        if ($title === '') {
            fail('Plan title is required.');
        }
        $stmt = db()->prepare('INSERT INTO diet_plans (admin_id, trainer_id, title, description, goal, target_calories, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId, $trainerId, $title,
            trim((string)($d['description'] ?? '')),
            trim((string)($d['goal'] ?? '')),
            (int)($d['target_calories'] ?? 0),
            ($d['status'] ?? '') === 'inactive' ? 'inactive' : 'active',
        ]);
        $planId = (int)db()->lastInsertId();
        save_meals($planId, $d['meals'] ?? []);
        ok(['id' => $planId, 'message' => 'Diet plan created.']);
        break;

    case 'PUT':
        $planId = (int)($d['id'] ?? 0);
        if (!$plan_exists($planId)) {
            fail('Plan not found.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['title', 'description', 'goal'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        if (array_key_exists('target_calories', $d)) {
            $set[]  = 'target_calories = ?';
            $args[] = (int)$d['target_calories'];
        }
        if (array_key_exists('status', $d)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'] === 'inactive' ? 'inactive' : 'active';
        }
        if ($set) {
            $args[] = $planId;
            db()->prepare('UPDATE diet_plans SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        }
        if (array_key_exists('meals', $d)) {
            db()->prepare('DELETE FROM diet_meals WHERE plan_id = ?')->execute([$planId]);
            save_meals($planId, $d['meals']);
        }
        ok(['message' => 'Diet plan updated.']);
        break;

    case 'DELETE':
        $planId = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM diet_plans WHERE id = ? AND admin_id = ?')->execute([$planId, $adminId]);
        ok(['message' => 'Diet plan removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}

function save_meals(int $planId, array $meals): void
{
    global $MEAL_TYPES;
    $stmt = db()->prepare('INSERT INTO diet_meals (plan_id, day_label, meal_type, name, description, calories, protein, carbs, fat, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    $i = 1;
    foreach ($meals as $m) {
        if (trim((string)($m['name'] ?? '')) === '') {
            continue;
        }
        $stmt->execute([
            $planId,
            trim((string)($m['day_label'] ?? '')),
            in_array($m['meal_type'] ?? '', $MEAL_TYPES, true) ? $m['meal_type'] : 'Breakfast',
            trim((string)$m['name']),
            trim((string)($m['description'] ?? '')),
            (int)($m['calories'] ?? 0),
            (float)($m['protein'] ?? 0),
            (float)($m['carbs'] ?? 0),
            (float)($m['fat'] ?? 0),
            $i++,
        ]);
    }
}
