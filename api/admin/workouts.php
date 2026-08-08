<?php
/**
 * Admin: workout plans (own gym). Exercises are nested under each plan.
 * GET    - list plans (exercises + assignment count + assigned member ids)
 * POST   - create plan (+ exercises[])
 * PUT    - update plan (+ exercises[] replaces the whole list)
 * DELETE - delete plan
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

function fetch_plan(int $adminId, int $planId): ?array
{
    $stmt = db()->prepare('SELECT * FROM workout_plans WHERE id = ? AND admin_id = ?');
    $stmt->execute([$planId, $adminId]);
    return $stmt->fetch() ?: null;
}

function plan_exercises(int $planId): array
{
    $stmt = db()->prepare('SELECT * FROM workout_exercises WHERE plan_id = ? ORDER BY day_label, sort_order');
    $stmt->execute([$planId]);
    return $stmt->fetchAll();
}

switch ($method) {
    case 'GET':
        $plans = db()->prepare('SELECT * FROM workout_plans WHERE admin_id = ? ORDER BY created_at DESC');
        $plans->execute([$adminId]);
        $list = [];
        foreach ($plans->fetchAll() as $p) {
            $p['exercises'] = plan_exercises((int)$p['id']);
            $cnt = db()->prepare('SELECT COUNT(*) AS n FROM workout_assignments WHERE plan_id = ?');
            $cnt->execute([$p['id']]);
            $p['assigned_count'] = (int)$cnt->fetch()['n'];
            $ids = db()->prepare('SELECT user_id FROM workout_assignments WHERE plan_id = ?');
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
        $stmt = db()->prepare('INSERT INTO workout_plans (admin_id, title, description, difficulty, days_per_week, status) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId,
            $title,
            trim((string)($d['description'] ?? '')),
            in_array($d['difficulty'] ?? '', ['Beginner', 'Intermediate', 'Advanced'], true) ? $d['difficulty'] : 'Beginner',
            (int)($d['days_per_week'] ?? 3),
            ($d['status'] ?? '') === 'inactive' ? 'inactive' : 'active',
        ]);
        $planId = (int)db()->lastInsertId();
        save_exercises($planId, $d['exercises'] ?? []);
        ok(['id' => $planId, 'message' => 'Workout plan created.']);
        break;

    case 'PUT':
        $planId = (int)($d['id'] ?? 0);
        if (!fetch_plan($adminId, $planId)) {
            fail('Plan not found.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['title', 'description'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        if (array_key_exists('difficulty', $d) && in_array($d['difficulty'], ['Beginner', 'Intermediate', 'Advanced'], true)) {
            $set[]  = 'difficulty = ?';
            $args[] = $d['difficulty'];
        }
        if (array_key_exists('days_per_week', $d)) {
            $set[]  = 'days_per_week = ?';
            $args[] = (int)$d['days_per_week'];
        }
        if (array_key_exists('status', $d)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'] === 'inactive' ? 'inactive' : 'active';
        }
        if ($set) {
            $args[] = $planId;
            db()->prepare('UPDATE workout_plans SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        }
        if (array_key_exists('exercises', $d)) {
            db()->prepare('DELETE FROM workout_exercises WHERE plan_id = ?')->execute([$planId]);
            save_exercises($planId, $d['exercises']);
        }
        ok(['message' => 'Workout plan updated.']);
        break;

    case 'DELETE':
        $planId = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM workout_plans WHERE id = ? AND admin_id = ?')->execute([$planId, $adminId]);
        ok(['message' => 'Workout plan removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}

function save_exercises(int $planId, array $exercises): void
{
    $stmt = db()->prepare('INSERT INTO workout_exercises (plan_id, day_label, name, sets, reps, rest, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $i = 1;
    foreach ($exercises as $e) {
        if (trim((string)($e['name'] ?? '')) === '') {
            continue;
        }
        $stmt->execute([
            $planId,
            trim((string)($e['day_label'] ?? '')),
            trim((string)$e['name']),
            ($e['sets'] ?? '') !== '' ? (int)$e['sets'] : null,
            trim((string)($e['reps'] ?? '')),
            trim((string)($e['rest'] ?? '')),
            trim((string)($e['notes'] ?? '')),
            $i++,
        ]);
    }
}
