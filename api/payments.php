<?php
/**
 * /api/payments.php  (Admin only)
 *
 * GET  - List all payments.
 * POST - Record a payment.  Body: { member, plan, amount, method, status }
 */

require_once __DIR__ . '/../config/init.php';

require_role('admin');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = db()->query('SELECT * FROM payments ORDER BY payment_date DESC, id DESC');
    ok(['payments' => $stmt->fetchAll()]);
}

if ($method === 'POST') {
    $d = json_decode(file_get_contents('php://input'), true) ?: [];
    $member = trim((string)($d['member'] ?? ''));
    if ($member === '') {
        fail('Member name is required.');
    }
    $amount = (float)($d['amount'] ?? 0);
    if ($amount <= 0) {
        fail('Amount must be greater than zero.');
    }
    $stmt = db()->prepare(
        'INSERT INTO payments (invoice_no, member, plan, amount, method, payment_date, status)
         VALUES (?, ?, ?, ?, ?, CURDATE(), ?)'
    );
    $stmt->execute([
        'INV-' . random_int(1000, 9999),
        $member,
        (string)($d['plan'] ?? 'Membership Fee'),
        $amount,
        (string)($d['method'] ?? 'Cash'),
        (string)($d['status'] ?? 'Paid'),
    ]);
    ok(['message' => 'Payment recorded successfully.', 'id' => (int)db()->lastInsertId()]);
}

fail('Method not allowed.', 405);
