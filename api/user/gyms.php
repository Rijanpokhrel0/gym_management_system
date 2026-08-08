<?php
/**
 * User: browse gyms and manage gym selections.
 * GET          - list of active gyms + ids the user follows
 * POST         - { admin_id } follow/select a gym
 * DELETE       - { admin_id } unfollow
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('user');
$userId = (int)$u['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $gyms = db()->query('SELECT a.id, a.name, a.gym_name, a.phone, a.address, a.logo_url, a.description, a.created_at
            FROM admins a
            WHERE a.status = "active"
            ORDER BY a.gym_name')->fetchAll();
        $stmt = db()->prepare('SELECT admin_id FROM user_gyms WHERE user_id = ?');
        $stmt->execute([$userId]);
        $selected = array_map(fn($r) => (int)$r['admin_id'], $stmt->fetchAll());
        ok(['gyms' => $gyms, 'selected' => $selected]);
        break;

    case 'POST':
        $adminId = (int)($d['admin_id'] ?? 0);
        $stmt = db()->prepare('SELECT a.id FROM admins a
            WHERE a.id = ? AND a.status = "active"');
        $stmt->execute([$adminId]);
        if (!$stmt->fetch()) {
            fail('Gym not found or not available.', 404);
        }
        db()->prepare('INSERT IGNORE INTO user_gyms (user_id, admin_id) VALUES (?, ?)')->execute([$userId, $adminId]);
        ok(['message' => 'Gym selected.']);
        break;

    case 'DELETE':
        $adminId = (int)($d['admin_id'] ?? 0);
        db()->prepare('DELETE FROM user_gyms WHERE user_id = ? AND admin_id = ?')->execute([$userId, $adminId]);
        ok(['message' => 'Gym removed from your selection.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
