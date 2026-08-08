<?php
/**
 * Public: browse active gyms - no login required.
 * If the visitor happens to be signed in as a user, `selected` lists the
 * gyms they follow so the UI can render the correct button state.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$gyms = db()->query('SELECT a.id, a.name, a.gym_name, a.phone, a.address, a.logo_url, a.description, a.created_at
    FROM admins a
    WHERE a.status = "active"
    ORDER BY a.gym_name')->fetchAll();

$selected = [];
$u = current_user();
if ($u && $u['portal'] === 'user') {
    $stmt = db()->prepare('SELECT admin_id FROM user_gyms WHERE user_id = ?');
    $stmt->execute([(int)$u['id']]);
    $selected = array_map(fn($r) => (int)$r['admin_id'], $stmt->fetchAll());
}

ok(['gyms' => $gyms, 'selected' => $selected, 'authed' => (bool)$u]);
