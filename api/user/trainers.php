<?php
/**
 * User: trainers of a gym (public to signed-in users).
 * GET ?gym_id=
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('user');
$gymId = (int)($_GET['gym_id'] ?? 0);
if (!$gymId) {
    fail('gym_id is required.');
}

$stmt = db()->prepare('SELECT * FROM trainers WHERE admin_id = ? AND status = "active" ORDER BY name');
$stmt->execute([$gymId]);
ok(['trainers' => $stmt->fetchAll()]);
