<?php
/**
 * /api/bookings.php
 *
 * GET  - List bookings depending on role:
 *        user    -> own bookings (member view)
 *        trainer -> bookings where they are the assigned trainer (client roster)
 *        admin   -> all bookings
 *
 * POST - Member books a verified trainer.
 *        Body: { trainer_id, shift, notes }
 */

require_once __DIR__ . '/../config/init.php';

$method = $_SERVER['REQUEST_METHOD'];
$u = current_user();

if ($method === 'GET') {
    if (!$u) {
        fail('Authentication required. Please log in.', 401);
    }

    if ($u['role'] === 'user') {
        $stmt = db()->prepare(
            'SELECT b.id, b.shift, b.notes, b.booking_date,
                    t.id AS trainer_id, t.specialization, u2.name AS trainer_name
             FROM bookings b
             JOIN trainers t ON t.id = b.trainer_id
             JOIN users u2 ON u2.id = t.user_id
             WHERE b.user_id = ?
             ORDER BY b.booking_date DESC, b.id DESC'
        );
        $stmt->execute([$u['id']]);
        ok(['bookings' => $stmt->fetchAll()]);
    }

    if ($u['role'] === 'trainer') {
        $stmt = db()->prepare('SELECT id FROM trainers WHERE user_id = ?');
        $stmt->execute([$u['id']]);
        $trainer = $stmt->fetch();
        if (!$trainer) {
            fail('Trainer profile not found.', 404);
        }
        $stmt = db()->prepare(
            'SELECT b.id, b.shift, b.notes, b.booking_date,
                    u2.name AS member_name, u2.email AS member_email
             FROM bookings b
             JOIN users u2 ON u2.id = b.user_id
             WHERE b.trainer_id = ?
             ORDER BY b.booking_date DESC, b.id DESC'
        );
        $stmt->execute([$trainer['id']]);
        ok(['bookings' => $stmt->fetchAll()]);
    }

    // Admin: everything.
    $stmt = db()->query(
        'SELECT b.id, b.shift, b.notes, b.booking_date,
                u2.name AS member_name, u3.name AS trainer_name
         FROM bookings b
         JOIN users u2 ON u2.id = b.user_id
         JOIN trainers t ON t.id = b.trainer_id
         JOIN users u3 ON u3.id = t.user_id
         ORDER BY b.booking_date DESC, b.id DESC'
    );
    ok(['bookings' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    require_role('user');

    $data      = json_decode(file_get_contents('php://input'), true) ?: [];
    $trainerId = (int)($data['trainer_id'] ?? 0);
    $shift     = (string)($data['shift'] ?? '');
    $notes     = trim((string)($data['notes'] ?? ''));

    if (!$trainerId || $shift === '') {
        fail('Trainer and shift are required.');
    }

    $stmt = db()->prepare('SELECT id FROM trainers WHERE id = ? AND status = "approved"');
    $stmt->execute([$trainerId]);
    if (!$stmt->fetch()) {
        fail('This trainer is not currently available.', 404);
    }

    $stmt = db()->prepare(
        'INSERT INTO bookings (user_id, trainer_id, shift, notes, booking_date)
         VALUES (?, ?, ?, ?, CURDATE())'
    );
    $stmt->execute([$u['id'], $trainerId, $shift, $notes]);

    ok(['message' => 'Booking confirmed. See you at the gym!']);
}

fail('Method not allowed.', 405);
