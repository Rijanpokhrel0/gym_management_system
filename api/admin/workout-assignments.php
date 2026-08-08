<?php
/**
 * Admin: assign / unassign workout plans to members (own gym).
 * GET    - ?plan_id=N => assigned members
 * POST   - { plan_id, user_ids: [] } assign
 * DELETE - { plan_id, user_id } unassign
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

$planId = (int)($method === 'GET' ? ($_GET['plan_id'] ?? 0) : ($d['plan_id'] ?? 0));
$stmt = db()->prepare('SELECT id FROM workout_plans WHERE id = ? AND admin_id = ?');
$stmt->execute([$planId, $adminId]);
if (!$stmt->fetch()) {
    fail('Plan not found.', 404);
}

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT wa.user_id, u.name, u.email, u.member_code, wa.assigned_at
            FROM workout_assignments wa
            JOIN users u ON u.id = wa.user_id
            WHERE wa.plan_id = ?
            ORDER BY u.name');
        $stmt->execute([$planId]);
        ok(['assignments' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $userIds = array_filter(array_map('intval', (array)($d['user_ids'] ?? [])));
        if (!$userIds) {
            fail('Select at least one member to assign.');
        }
        $ins = db()->prepare('INSERT IGNORE INTO workout_assignments (admin_id, plan_id, user_id) VALUES (?, ?, ?)');
        foreach ($userIds as $uid) {
            $chk = db()->prepare('SELECT id FROM users WHERE id = ? AND admin_id = ?');
            $chk->execute([$uid, $adminId]);
            if ($chk->fetch()) {
                $ins->execute([$adminId, $planId, $uid]);
            }
        }
        ok(['message' => 'Members assigned.']);
        break;

    case 'DELETE':
        $userId = (int)($d['user_id'] ?? 0);
        db()->prepare('DELETE FROM workout_assignments WHERE plan_id = ? AND user_id = ?')->execute([$planId, $userId]);
        ok(['message' => 'Assignment removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
