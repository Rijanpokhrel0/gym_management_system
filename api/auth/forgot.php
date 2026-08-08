<?php
/**
 * forgot - self-service password reset is disabled for security.
 * Users who forget their password must contact the Superadmin, who can
 * reset the account for them. POST { email? }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$stmt = db()->query('SELECT name, email FROM superadmins ORDER BY id LIMIT 1');
$sa = $stmt->fetch() ?: ['name' => 'the Superadmin', 'email' => ''];

$name = $sa['name'] ?? 'the Superadmin';
$email = $sa['email'] ?? '';

ok([
    'superadmin_name'  => $name,
    'superadmin_email' => $email,
    'message'          => $email !== ''
        ? "Password resets are handled by the Superadmin ($name). Please contact them at $email to reset your password."
        : 'Password resets are handled by the Superadmin. Please contact them for assistance.',
]);
