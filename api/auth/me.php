<?php
/**
 * GET /api/auth/me.php
 * Returns the currently signed-in user (and trainer profile if applicable),
 * or user: null when logged out. Used to restore the session on page load.
 */

require_once __DIR__ . '/../../config/init.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    fail('Method not allowed.', 405);
}

$u = current_user();

if (!$u) {
    ok(['user' => null, 'trainer' => null]);
}

$trainer = null;
if ($u['role'] === 'trainer') {
    $stmt = db()->prepare('SELECT id, specialization, experience, shifts, status, salary_expectation, certifications, rating FROM trainers WHERE user_id = ?');
    $stmt->execute([$u['id']]);
    $trainer = $stmt->fetch() ?: null;
    if ($trainer) {
        $trainer['shifts'] = json_decode($trainer['shifts'] ?? '[]', true);
    }
}

ok(['user' => $u, 'trainer' => $trainer]);
