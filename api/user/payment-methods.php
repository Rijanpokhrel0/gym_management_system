<?php
/**
 * ==========================================================================
 * FITPULSE - MEMBER PAYMENT METHODS (PUBLIC/MEMBER VIEW)
 * ==========================================================================
 * Fetches active QR payment methods for the member's linked gym.
 */

declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$user = require_portal('user');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$db = db();

if ($method !== 'GET') {
    fail('Method not allowed.', 405);
}

$gymId = (int)($_GET['gym_id'] ?? $user['admin_id'] ?? 0);
if ($gymId <= 0) {
    fail('No gym linked to your account.', 400);
}

$stmt = $db->prepare('
    SELECT pm.id, pm.admin_id, pm.provider, pm.account_name, pm.account_number, pm.qr_image_url, pm.is_active,
           a.gym_name
    FROM payment_methods pm
    JOIN admins a ON pm.admin_id = a.id
    WHERE pm.admin_id = ? AND pm.is_active = 1
    ORDER BY pm.id ASC
');
$stmt->execute([$gymId]);
$methods = $stmt->fetchAll();

ok([
    'payment_methods' => $methods,
    'count' => count($methods)
]);
