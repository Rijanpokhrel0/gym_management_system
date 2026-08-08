<?php
/**
 * Public: read-only overview of a gym (like the admin dashboard, view-only).
 * GET ?gym_id=
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$gymId = (int)($_GET['gym_id'] ?? 0);
if (!$gymId) {
    fail('gym_id is required.');
}

$stmt = db()->prepare('SELECT id, name, gym_name, phone, address, logo_url, description, created_at
    FROM admins WHERE id = ? AND status = "active"');
$stmt->execute([$gymId]);
$gym = $stmt->fetch();
if (!$gym) {
    fail('Gym not found.', 404);
}

$cnt = function (string $sql, array $args = []) {
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    return (int)$stmt->fetchColumn();
};

$gym['stats'] = [
    'products'      => $cnt('SELECT COUNT(*) FROM products WHERE admin_id = ? AND status = "active"', [$gymId]),
    'equipment'     => $cnt('SELECT COUNT(*) FROM equipment WHERE admin_id = ? AND status = "active"', [$gymId]),
    'trainers'      => $cnt('SELECT COUNT(*) FROM trainers WHERE admin_id = ? AND status = "active"', [$gymId]),
    'classes'       => $cnt('SELECT COUNT(*) FROM gym_classes WHERE admin_id = ? AND status = "active"', [$gymId]),
    'workout_plans' => $cnt('SELECT COUNT(*) FROM workout_plans WHERE admin_id = ? AND status = "active"', [$gymId]),
    'diet_plans'    => $cnt('SELECT COUNT(*) FROM diet_plans WHERE admin_id = ? AND status = "active"', [$gymId]),
    'announcements' => $cnt('SELECT COUNT(*) FROM announcements WHERE admin_id = ? AND status = "active"', [$gymId]),
    'users'         => $cnt('SELECT COUNT(*) FROM users WHERE admin_id = ?', [$gymId]),
];

ok(['gym' => $gym]);
