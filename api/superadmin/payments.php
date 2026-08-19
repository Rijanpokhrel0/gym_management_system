<?php
/**
 * Superadmin: view ALL payments across all gyms.
 * GET  - list all payments with user/gym info (optional filter: ?status=pending|verified|rejected)
 * POST - verify or reject any payment (override)
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

require_portal('superadmin');
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

if ($method === 'GET') {
    $status = trim((string)($_GET['status'] ?? ''));
    $allowed = ['pending', 'verified', 'rejected'];

    $sql = '
        SELECT 
            p.id, p.invoice_id, p.user_id, p.amount, p.method, p.transaction_id, p.proof_image,
            p.status, p.rejection_reason, p.verified_by, p.verified_at, p.created_at,
            u.name AS user_name, u.email AS user_email,
            i.invoice_no, i.title AS invoice_title, i.amount AS invoice_total,
            a.id AS admin_id, a.gym_name
        FROM payments p
        JOIN users u ON p.user_id = u.id
        JOIN invoices i ON p.invoice_id = i.id
        JOIN admins a ON p.admin_id = a.id
        WHERE 1=1
    ';
    $params = [];

    if ($status !== '' && in_array($status, $allowed, true)) {
        $sql .= ' AND p.status = ?';
        $params[] = $status;
    }

    $sql .= ' ORDER BY p.created_at DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $payments = $stmt->fetchAll();

    $countsStmt = db()->query('
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = "verified" THEN 1 ELSE 0 END) AS verified,
            SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN status = "verified" THEN amount ELSE 0 END) AS verified_amount
        FROM payments
    ');
    $counts = $countsStmt->fetch();

    ok([
        'payments' => $payments,
        'stats' => [
            'total' => (int)($counts['total'] ?? 0),
            'pending' => (int)($counts['pending'] ?? 0),
            'verified' => (int)($counts['verified'] ?? 0),
            'rejected' => (int)($counts['rejected'] ?? 0),
            'verified_amount' => (float)($counts['verified_amount'] ?? 0),
        ]
    ]);
    exit;
}

if ($method === 'POST') {
    $paymentId = (int)($d['id'] ?? 0);
    $action = trim((string)($d['action'] ?? ''));
    $rejectionReason = trim((string)($d['rejection_reason'] ?? ''));

    if (!$paymentId) fail('Payment ID is required.');
    if (!in_array($action, ['verified', 'rejected'], true)) {
        fail('Action must be verified or rejected.');
    }

    $db = db();
    $db->beginTransaction();
    try {
        $stmt = $db->prepare('
            SELECT p.*, i.amount AS invoice_total, i.paid_amount AS invoice_paid_amount, i.invoice_no, i.title AS invoice_title
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            WHERE p.id = ?
            FOR UPDATE
        ');
        $stmt->execute([$paymentId]);
        $payment = $stmt->fetch();

        if (!$payment) { $db->rollBack(); fail('Payment not found.', 404); }
        if ($payment['status'] !== 'pending') { $db->rollBack(); fail('Payment already processed.'); }

        if ($action === 'verified') {
            $db->prepare('UPDATE payments SET status = "verified", verified_by = "Superadmin", verified_at = NOW(), rejection_reason = NULL, updated_at = NOW() WHERE id = ?')
                ->execute([$paymentId]);

            $newPaid = (float)$payment['invoice_paid_amount'] + (float)$payment['amount'];
            $totalAmount = (float)$payment['invoice_total'];
            $invStatus = $newPaid >= $totalAmount ? 'paid' : ($newPaid > 0 ? 'partial' : 'unpaid');

            $db->prepare('UPDATE invoices SET paid_amount = ?, status = ?, paid_at = CASE WHEN ? = "paid" THEN NOW() ELSE paid_at END, payment_method = ? WHERE id = ?')
                ->execute([$newPaid, $invStatus, $invStatus, strtoupper($payment['method']), (int)$payment['invoice_id']]);

            $db->prepare('INSERT INTO notifications (user_id, admin_id, type, title, body) VALUES (?, ?, "invoice", "Payment Verified", ?)')
                ->execute([(int)$payment['user_id'], (int)$payment['admin_id'], 'Your payment of Rs. ' . number_format((float)$payment['amount'], 2) . ' was verified by the system admin.']);

            $db->commit();
            ok(['message' => 'Payment verified. Invoice marked as ' . $invStatus . '.', 'status' => 'verified']);
        } else {
            $db->prepare('UPDATE payments SET status = "rejected", verified_by = "Superadmin", verified_at = NULL, rejection_reason = ?, updated_at = NOW() WHERE id = ?')
                ->execute([$rejectionReason ?: 'Payment could not be verified.', $paymentId]);

            $db->prepare('INSERT INTO notifications (user_id, admin_id, type, title, body) VALUES (?, ?, "invoice", "Payment Rejected", ?)')
                ->execute([(int)$payment['user_id'], (int)$payment['admin_id'], 'Your payment was rejected. Reason: ' . ($rejectionReason ?: 'Payment could not be verified.')]);

            $db->commit();
            ok(['message' => 'Payment rejected.', 'status' => 'rejected']);
        }
    } catch (\Throwable $e) {
        if ($db->inTransaction()) $db->rollBack();
        throw $e;
    }
    exit;
}

fail('Method not allowed.', 405);
