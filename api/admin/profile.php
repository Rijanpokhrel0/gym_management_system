<?php
/**
 * Admin: update own gym profile (name, phone, address, logo_url, description).
 * PUT { name?, phone?, address?, logo_url?, description? }
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$u = require_portal('admin');
$adminId = (int)$u['id'];

if ($_SERVER['REQUEST_METHOD'] !== 'PUT') {
    fail('Method not allowed.', 405);
}

$d = body();
$set  = [];
$args = [];
foreach (['gym_name', 'phone', 'address', 'logo_url', 'description'] as $f) {
    if (array_key_exists($f, $d)) {
        $set[]  = "`$f` = ?";
        $args[] = trim((string)$d[$f]);
    }
}
if (array_key_exists('name', $d)) {
    $set[]  = 'name = ?';
    $args[] = trim((string)$d['name']);
}
if (!$set) {
    fail('Nothing to update.');
}
$args[] = $adminId;
db()->prepare('UPDATE admins SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
ok(['message' => 'Gym profile updated.']);
