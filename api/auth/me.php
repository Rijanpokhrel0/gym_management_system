<?php
/**
 * me - restore the session on page load.
 * Returns the signed-in identity and portal-specific extras.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = current_user();
if (!$u) {
    fail('Not signed in.', 401);
}

$extra = [];
if ($u['portal'] === 'admin') {
    $stmt = db()->prepare('SELECT gym_name, phone, address, logo_url, description, status FROM admins WHERE id = ?');
    $stmt->execute([(int)$u['id']]);
    $extra = $stmt->fetch() ?: [];
} elseif ($u['portal'] === 'trainer') {
    $stmt = db()->prepare('SELECT t.admin_id, a.gym_name, a.logo_url, t.specialization, t.phone, t.status
                           FROM trainers t JOIN admins a ON a.id = t.admin_id WHERE t.id = ?');
    $stmt->execute([(int)$u['id']]);
    $row = $stmt->fetch() ?: [];
    $extra = [
        'admin_id'       => $row['admin_id'] ?? null,
        'gym_name'       => $row['gym_name'] ?? '',
        'logo_url'       => $row['logo_url'] ?? '',
        'specialization' => $row['specialization'] ?? '',
        'phone'          => $row['phone'] ?? '',
        'status'         => $row['status'] ?? 'active',
    ];
} elseif ($u['portal'] === 'user') {
    $stmt = db()->prepare('SELECT admin_id, phone, goal FROM users WHERE id = ?');
    $stmt->execute([(int)$u['id']]);
    $row = $stmt->fetch() ?: [];
    $extra = [
        'admin_id' => $row['admin_id'] ?? null,
        'phone'    => $row['phone'] ?? '',
        'goal'     => $row['goal'] ?? null,
    ];
}

ok(array_merge(
    ['id' => $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'portal' => $u['portal']],
    $extra
));
