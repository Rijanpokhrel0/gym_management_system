<?php
/**
 * Trainer: workout plans of the trainer's gym (with exercises + assignments).
 * GET    - list plans
 * POST   - create plan (+ exercises[])
 * PUT    - update plan (+ exercises[])
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

$plan_exists = function (int $planId) use ($adminId): bool {
    $s = db()->prepare('SELECT id FROM workout_plans WHERE id = ? AND admin_id = ?');
    $s->execute([$planId, $adminId]);
    return (bool)$s->fetch();
};

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT * FROM workout_plans WHERE admin_id = ? ORDER BY created_at DESC');
        $stmt->execute([$adminId]);
        $list = [];
        foreach ($stmt->fetchAll() as $p) {
            $ex = db()->prepare('SELECT * FROM workout_exercises WHERE plan_id = ? ORDER BY day_label, sort_order');
            $ex->execute([$p['id']]);
            $p['exercises'] = $ex->fetchAll();
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
                $ins = db()->prepare('INSERT IGNORE INTO workout_assignments (admin_id, plan_id, user_id) VALUES (?, ?, ?)');
                foreach ($userIds as $uid) {
                    $chk = db()->prepare('SELECT id FROM users WHERE id = ? AND admin_id = ?');
                    $chk->execute([$uid, $adminId]);
                    if ($chk->fetch()) {
                        $ins->execute([$adminId, $planId, $uid]);
                    }
                }
                ok(['message' => 'Members assigned.']);
            }
            db()->prepare('DELETE FROM workout_assignments WHERE plan_id = ? AND user_id IN (' . implode(',', $userIds ?: [0]) . ')')
                ->execute([$planId]);
            ok(['message' => 'Assignment removed.']);
        }

        $title = trim((string)($d['title'] ?? ''));
        if ($title === '') {
            fail('Plan title is required.');
        }
        $stmt = db()->prepare('INSERT INTO workout_plans (admin_id, trainer_id, title, description, difficulty, days_per_week, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId, $trainerId, $title,
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
        if (!$plan_exists($planId)) {
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
