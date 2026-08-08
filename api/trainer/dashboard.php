<?php
/**
 * Trainer: dashboard metrics, gym info and member list.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('trainer');
$trainerId = (int)$u['id'];

$stmt = db()->prepare('SELECT t.*, a.gym_name, a.logo_url, a.address, a.description AS gym_description
    FROM trainers t JOIN admins a ON a.id = t.admin_id WHERE t.id = ?');
$stmt->execute([$trainerId]);
$trainer = $stmt->fetch();
if (!$trainer) {
    fail('Trainer not found.', 404);
}

$adminId = (int)$trainer['admin_id'];
$cnt = function (string $sql, array $args) {
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    return (int)$stmt->fetchColumn();
};

$members = db()->prepare('SELECT id, name, email, phone, goal, created_at FROM users WHERE admin_id = ? ORDER BY created_at DESC');
$members->execute([$adminId]);

ok([
    'gym_name' => $trainer['gym_name'],
    'logo_url' => $trainer['logo_url'],
    'address'  => $trainer['address'],
    'gym_description' => $trainer['gym_description'],
    'metrics' => [
        'members'      => $cnt('SELECT COUNT(*) FROM users WHERE admin_id = ?', [$adminId]),
        'products'     => $cnt('SELECT COUNT(*) FROM products WHERE admin_id = ? AND status = "active"', [$adminId]),
        'member_gyms'  => $cnt('SELECT COUNT(*) FROM user_gyms WHERE admin_id = ?', [$adminId]),
    ],
    'members' => $members->fetchAll(),
]);
