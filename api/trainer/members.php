<?php
/**
 * Trainer: members of the trainer's gym (used for plan assignment etc).
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('trainer');
$trainerId = (int)$u['id'];

$t = db()->prepare('SELECT admin_id FROM trainers WHERE id = ?');
$t->execute([$trainerId]);
$row = $t->fetch();
if (!$row) {
    fail('Trainer not found.', 404);
}
$adminId = (int)$row['admin_id'];

$stmt = db()->prepare('SELECT id, name, email, phone, goal, member_code, created_at
    FROM users WHERE admin_id = ?
    ORDER BY created_at DESC');
$stmt->execute([$adminId]);
ok(['members' => $stmt->fetchAll()]);
