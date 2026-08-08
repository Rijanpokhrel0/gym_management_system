<?php
/**
 * Public: browse trainers of a gym - no login required.
 * GET ?gym_id=
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$gymId = (int)($_GET['gym_id'] ?? 0);
if (!$gymId) {
    fail('gym_id is required.');
}

$stmt = db()->prepare('SELECT id, admin_id, name, specialization, experience, phone, certifications, created_at
    FROM trainers WHERE admin_id = ? AND status = "active" ORDER BY name');
$stmt->execute([$gymId]);
ok(['trainers' => $stmt->fetchAll()]);
