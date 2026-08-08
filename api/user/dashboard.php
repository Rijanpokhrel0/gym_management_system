<?php
/**
 * User: dashboard metrics.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('user');
$userId = (int)$u['id'];

$cnt = function (string $sql, array $args) {
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    return (int)$stmt->fetchColumn();
};

$stmt = db()->prepare('SELECT u.admin_id, a.gym_name, a.logo_url, a.name AS admin_name, a.address
    FROM users u LEFT JOIN admins a ON a.id = u.admin_id WHERE u.id = ?');
$stmt->execute([$userId]);
$home = $stmt->fetch();

ok([
    'selected_gyms' => $cnt('SELECT COUNT(*) FROM user_gyms WHERE user_id = ?', [$userId]),
    'products_count'=> $cnt('SELECT COUNT(*) FROM products p JOIN user_gyms ug ON ug.admin_id = p.admin_id
                            WHERE ug.user_id = ? AND p.status = "active"', [$userId]),
    'gyms_available'=> $cnt('SELECT COUNT(*) FROM admins a WHERE a.status = "active"', []),
    'home_gym'      => $home,
]);
