<?php
/**
 * Admin: diet / nutrition plans (own gym). Meals are nested under each plan.
 * GET    - list plans (meals + assignment count + assigned member ids)
 * POST   - create plan (+ meals[])
 * PUT    - update plan (+ meals[] replaces the whole list)
 * DELETE - delete plan
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

function fetch_diet(int $adminId, int $planId): ?array
{
    $stmt = db()->prepare('SELECT * FROM diet_plans WHERE id = ? AND admin_id = ?');
    $stmt->execute([$planId, $adminId]);
    return $stmt->fetch() ?: null;
}

function diet_meals(int $planId): array
{
    $stmt = db()->prepare('SELECT * FROM diet_meals WHERE plan_id = ? ORDER BY day_label, sort_order');
    $stmt->execute([$planId]);
    return $stmt->fetchAll();
}

$MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Pre-Workout', 'Post-Workout'];

switch ($method) {
    case 'GET':
        $plans = db()->prepare('SELECT * FROM diet_plans WHERE admin_id = ? ORDER BY created_at DESC');
        $plans->execute([$adminId]);
        $list = [];
        foreach ($plans->fetchAll() as $p) {
            $p['meals'] = diet_meals((int)$p['id']);
            $cnt = db()->prepare('SELECT COUNT(*) AS n FROM diet_assignments WHERE plan_id = ?');
            $cnt->execute([$p['id']]);
            $p['assigned_count'] = (int)$cnt->fetch()['n'];
            $ids = db()->prepare('SELECT user_id FROM diet_assignments WHERE plan_id = ?');
            $ids->execute([$p['id']]);
            $p['assigned_user_ids'] = array_map('intval', array_column($ids->fetchAll(), 'user_id'));
            $list[] = $p;
        }
        ok(['plans' => $list]);
        break;

    case 'POST':
        $title = trim((string)($d['title'] ?? ''));
        if ($title === '') {
            fail('Plan title is required.');
        }
        $stmt = db()->prepare('INSERT INTO diet_plans (admin_id, title, description, goal, target_calories, status) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId,
            $title,
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
        if (!fetch_diet($adminId, $planId)) {
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
