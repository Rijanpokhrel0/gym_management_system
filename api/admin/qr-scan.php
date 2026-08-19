<?php
/**
 * Admin: scan a member's QR code to check them in.
 * POST - { qr_data: "JSON string from QR code" } or { member_code: "..." }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
rate_limit('qr-scan', 30, 60);

$d = body();
$memberCode = null;

if (!empty($d['qr_data'])) {
    $qr = json_decode($d['qr_data'], true);
    if (!$qr || ($qr['type'] ?? '') !== 'fitpulse_checkin') {
        fail('Invalid QR code. Please scan a valid FitPulse check-in code.');
    }
    if (($qr['admin_id'] ?? 0) != $adminId) {
        fail('This QR code belongs to a different gym.');
    }
    $memberCode = strtoupper(trim($qr['member_code'] ?? ''));
} elseif (!empty($d['member_code'])) {
    $memberCode = strtoupper(trim($d['member_code']));
} else {
    fail('Provide qr_data or member_code.');
}

$stmt = db()->prepare('SELECT id, name FROM users WHERE UPPER(member_code) = ? AND admin_id = ?');
$stmt->execute([$memberCode, $adminId]);
$user = $stmt->fetch();
if (!$user) {
    fail('Member not found in your gym.');
}

$userId = (int)$user['id'];
$dup = db()->prepare('SELECT id FROM attendance WHERE user_id = ? AND DATE(check_in_at) = CURDATE()');
$dup->execute([$userId]);
if ($dup->fetch()) {
    fail($user['name'] . ' has already checked in today.');
}

db()->prepare('INSERT INTO attendance (admin_id, user_id, checked_in_by, check_in_at) VALUES (?, ?, "admin", NOW())')
    ->execute([$adminId, $userId]);

ok([
    'id' => (int)db()->lastInsertId(),
    'member_name' => $user['name'],
    'message' => $user['name'] . ' checked in successfully.',
]);
