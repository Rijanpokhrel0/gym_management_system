<?php
/**
 * User: products of a gym (admin_id). Public to signed-in users.
 * GET ?gym_id=&category=
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('user');
$gymId = (int)($_GET['gym_id'] ?? 0);
if (!$gymId) {
    fail('gym_id is required.');
}

$stmt = db()->prepare('SELECT id FROM admins WHERE id = ?');
$stmt->execute([$gymId]);
if (!$stmt->fetch()) {
    fail('Gym not found.', 404);
}

$sql = 'SELECT p.*, a.gym_name FROM products p JOIN admins a ON a.id = p.admin_id
        WHERE p.admin_id = ? AND p.status = "active"';
$args = [$gymId];
if (!empty($_GET['category'])) {
    $sql .= ' AND p.category = ?';
    $args[] = $_GET['category'];
}
$sql .= ' ORDER BY p.created_at DESC';
$stmt = db()->prepare($sql);
$stmt->execute($args);
ok(['products' => $stmt->fetchAll()]);
