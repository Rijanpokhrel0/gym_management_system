<?php
/**
 * User: get personal QR code for check-in.
 * GET - returns a QR code image URL for the member's check-in
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';
require_once __DIR__ . '/../../vendor/phpqrcode/phpqrcode.php';

$ctx = require_portal('user');
$userId = (int)$ctx['id'];

// Get member code and primary gym
$stmt = db()->prepare('SELECT member_code, admin_id FROM users WHERE id = ?');
$stmt->execute([$userId]);
$user = $stmt->fetch();
if (!$user) fail('User not found.', 404);

$memberCode = $user['member_code'];
$adminId = $user['admin_id'];

// Generate QR code as base64 PNG
$qrData = json_encode([
    'type' => 'fitpulse_checkin',
    'user_id' => $userId,
    'member_code' => $memberCode,
    'admin_id' => $adminId,
    'timestamp' => time(),
]);

ob_start();
QRcode::png($qrData, null, QR_ECLEVEL_M, 8, 2);
$qrImage = ob_get_clean();
$qrBase64 = 'data:image/png;base64,' . base64_encode($qrImage);

ok([
    'qr_code' => $qrBase64,
    'member_code' => $memberCode,
    'gym_id' => $adminId,
]);
