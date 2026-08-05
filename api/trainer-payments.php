<?php
/**
 * /api/trainer-payments.php
 *
 * GET  - Salary payments.
 *        admin   -> all payments with trainer names.
 *        trainer -> only their own payments.
 * POST - Admin records a salary payment.  Body: { trainer_id, amount, month, status, payment_date, method, notes }
 * PUT  - Admin updates a payment status.  Body: { id, status }
 */

require_once __DIR__ . '/../config/init.php';

$method = $_SERVER['REQUEST_METHOD'];
$u = current_user();

if ($method === 'GET') {
    if (!$u) {
        fail('Authentication required. Please log in.', 401);
    }

    if ($u['role'] === 'trainer') {
        $stmt = db()->prepare('SELECT id FROM trainers WHERE user_id = ?');
        $stmt->execute([$u['id']]);
        $trainer = $stmt->fetch();
        if (!$trainer) {
            fail('Trainer profile not found.', 404);
        }
        $stmt = db()->prepare(
            'SELECT tp.*, u.name AS trainer_name
             FROM trainer_payments tp
             JOIN trainers t ON t.id = tp.trainer_id
             JOIN users u ON u.id = t.user_id
             WHERE tp.trainer_id = ?
             ORDER BY tp.month DESC, tp.id DESC'
        );
        $stmt->execute([(int)$trainer['id']]);
        ok(['payments' => $stmt->fetchAll()]);
    }

    require_role('admin');
    $stmt = db()->query(
        'SELECT tp.*, u.name AS trainer_name
         FROM trainer_payments tp
         JOIN trainers t ON t.id = tp.trainer_id
         JOIN users u ON u.id = t.user_id
         ORDER BY tp.month DESC, tp.id DESC'
    );
    ok(['payments' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    require_role('admin');

    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $trainerId = (int)($d['trainer_id'] ?? 0);
    $amount = (float)($d['amount'] ?? 0);
    $month = trim((string)($d['month'] ?? ''));

    if (!$trainerId) {
        fail('Trainer is required.');
    }
    if ($amount <= 0) {
        fail('Amount must be greater than zero.');
    }
    if ($month === '') {
        fail('Salary month is required.');
    }

    $stmt = db()->prepare('SELECT id FROM trainers WHERE id = ?');
    $stmt->execute([$trainerId]);
    if (!$stmt->fetch()) {
        fail('Trainer not found.', 404);
    }

    $stmt = db()->prepare(
        'INSERT INTO trainer_payments (trainer_id, amount, month, status, payment_date, method, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $trainerId,
        $amount,
        $month,
        (string)($d['status'] ?? 'Pending'),
        (string)($d['payment_date'] ?? date('Y-m-d')),
        (string)($d['method'] ?? 'Cash'),
        trim((string)($d['notes'] ?? '')),
    ]);
    ok(['message' => 'Trainer salary payment recorded.', 'id' => (int)db()->lastInsertId()]);
}

if ($method === 'PUT') {
    require_role('admin');

    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = (int)($d['id'] ?? 0);
    $status = (string)($d['status'] ?? '');
    if (!$id) {
        fail('Payment id is required.');
    }
    if (!in_array($status, ['Paid', 'Pending'], true)) {
        fail('Invalid payment status.');
    }
    $stmt = db()->prepare('UPDATE trainer_payments SET status = ? WHERE id = ?');
    $stmt->execute([$status, $id]);
    ok(['message' => 'Payment status updated.']);
}

fail('Method not allowed.', 405);
