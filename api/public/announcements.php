<?php
/**
 * Public: browse active announcements of a gym - no login required.
 * GET ?gym_id=
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$gymId = (int)($_GET['gym_id'] ?? 0);
if (!$gymId) {
    fail('gym_id is required.');
}

$stmt = db()->prepare('SELECT id FROM admins WHERE id = ? AND status = "active"');
$stmt->execute([$gymId]);
if (!$stmt->fetch()) {
    fail('Gym not found.', 404);
}

$stmt = db()->prepare('SELECT id, title, body, priority, status, created_at
    FROM announcements WHERE admin_id = ? AND status = "active" ORDER BY created_at DESC');
$stmt->execute([$gymId]);
ok(['announcements' => $stmt->fetchAll()]);
