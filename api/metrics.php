<?php
/**
 * GET /api/metrics.php
 * Dashboard statistics used by the System Overview tab.
 * Requires a signed-in user (any role).
 */

require_once __DIR__ . '/../config/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed.', 405);
}

current_user() ?: fail('Authentication required.', 401);

$pdo = db();

$metrics = [
    'users'            => (int)$pdo->query('SELECT COUNT(*) FROM users WHERE role = "user"')->fetchColumn(),
    'approvedTrainers' => (int)$pdo->query('SELECT COUNT(*) FROM trainers WHERE status = "approved"')->fetchColumn(),
    'pendingTrainers'  => (int)$pdo->query('SELECT COUNT(*) FROM trainers WHERE status = "pending"')->fetchColumn(),
    'bookings'         => (int)$pdo->query('SELECT COUNT(*) FROM bookings')->fetchColumn(),
    'members'          => (int)$pdo->query('SELECT COUNT(*) FROM members')->fetchColumn(),
    'classes'          => (int)$pdo->query('SELECT COUNT(*) FROM classes')->fetchColumn(),
    'payments'         => (int)$pdo->query('SELECT COUNT(*) FROM payments')->fetchColumn(),
];

ok(['metrics' => $metrics]);
