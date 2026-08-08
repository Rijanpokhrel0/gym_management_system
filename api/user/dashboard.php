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

$stmt = db()->prepare('SELECT a.id, a.gym_name, a.logo_url, a.phone, a.address, a.description, a.name AS admin_name,
        (SELECT COUNT(*) FROM products p WHERE p.admin_id = a.id AND p.status = "active") AS product_count,
        (SELECT COUNT(*) FROM equipment e WHERE e.admin_id = a.id AND e.status = "active") AS equipment_count,
        (SELECT COUNT(*) FROM trainers t WHERE t.admin_id = a.id AND t.status = "active") AS trainer_count
    FROM user_gyms ug JOIN admins a ON a.id = ug.admin_id
    WHERE ug.user_id = ? AND a.status = "active"
    ORDER BY ug.selected_at DESC');
$stmt->execute([$userId]);
$selected_gyms = $stmt->fetchAll();

$stmt = db()->prepare('SELECT member_code FROM users WHERE id = ?');
$stmt->execute([$userId]);
$member_code = $stmt->fetchColumn();

ok([
    'selected_gyms' => count($selected_gyms),
    'selected_gyms_list' => $selected_gyms,
    'products_count'=> $cnt('SELECT COUNT(*) FROM products p JOIN user_gyms ug ON ug.admin_id = p.admin_id
                            WHERE ug.user_id = ? AND p.status = "active"', [$userId]),
    'gyms_available'=> $cnt('SELECT COUNT(*) FROM admins a WHERE a.status = "active"', []),
    'home_gym'      => $home,
    'unread_notifications' => $cnt('SELECT COUNT(*) FROM notifications WHERE user_id = ? AND is_read = 0', [$userId]),
    'workout_plans' => $cnt('SELECT COUNT(*) FROM workout_assignments wa JOIN workout_plans wp ON wp.id = wa.plan_id
                            WHERE wa.user_id = ? AND wp.status = "active"', [$userId]),
    'diet_plans'    => $cnt('SELECT COUNT(*) FROM diet_assignments da JOIN diet_plans dp ON dp.id = da.plan_id
                            WHERE da.user_id = ? AND dp.status = "active"', [$userId]),
    'checked_in_today' => $cnt('SELECT COUNT(*) FROM attendance WHERE user_id = ? AND DATE(check_in_at) = CURDATE()', [$userId]),
    'booked_classes'   => $cnt('SELECT COUNT(*) FROM class_bookings cb JOIN gym_classes gc ON gc.id = cb.class_id
                            WHERE cb.user_id = ? AND cb.status = "booked" AND gc.status = "active"', [$userId]),
    'member_code'   => $member_code,
]);
