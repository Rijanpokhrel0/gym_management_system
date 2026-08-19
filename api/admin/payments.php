<?php
/**
 * ==========================================================================
 * FITPULSE - ADMIN PAYMENTS VERIFICATION API
 * ==========================================================================
 * Allows gym owner (admin) to list pending/verified/rejected payments,
 * verify payment proof submissions, and auto-settle member invoices.
 */

declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$user = require_portal('admin');
$adminId = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$db = db();

// GET: List payments for this gym (optional filter: ?status=pending|verified|rejected)
if ($method === 'GET') {
    $status = trim((string)($_GET['status'] ?? ''));
    $allowed = ['pending', 'verified', 'rejected'];

    $sql = '
        SELECT 
            p.id, p.invoice_id, p.user_id, p.amount, p.method, p.transaction_id, p.proof_image,
            p.status, p.rejection_reason, p.verified_by, p.verified_at, p.created_at, p.updated_at,
            u.name AS user_name, u.email AS user_email, u.phone AS user_phone, u.member_code,
            i.invoice_no, i.title AS invoice_title, i.amount AS invoice_total, i.paid_amount AS invoice_paid
        FROM payments p
        JOIN users u ON p.user_id = u.id
        JOIN invoices i ON p.invoice_id = i.id
        WHERE p.admin_id = ?
    ';
    $params = [$adminId];

    if ($status !== '' && in_array($status, $allowed, true)) {
        $sql .= ' AND p.status = ?';
        $params[] = $status;
    }

    $sql .= ' ORDER BY p.created_at DESC';

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $payments = $stmt->fetchAll();

    // Summary counts
    $countsStmt = $db->prepare('
        SELECT 
            COUNT(*) AS total,
            SUM(CASE WHEN status = "pending" THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = "verified" THEN 1 ELSE 0 END) AS verified,
            SUM(CASE WHEN status = "rejected" THEN 1 ELSE 0 END) AS rejected,
            SUM(CASE WHEN status = "verified" THEN amount ELSE 0 END) AS verified_amount
        FROM payments
        WHERE admin_id = ?
    ');
    $countsStmt->execute([$adminId]);
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
}

// POST: Verify or Reject a member payment submission
if ($method === 'POST') {
    $b = json_body();
    $paymentId = (int)($b['id'] ?? $b['payment_id'] ?? 0);
    $action = trim((string)($b['action'] ?? $b['status'] ?? ''));
    $rejectionReason = trim((string)($b['rejection_reason'] ?? $b['reason'] ?? ''));

    if ($paymentId <= 0) fail('Invalid payment ID.');
    if (!in_array($action, ['verified', 'rejected'], true)) {
        fail('Action/Status must be verified or rejected.');
    }

    $db->beginTransaction();
    try {
        // Fetch payment with ownership check
        $stmt = $db->prepare('
            SELECT p.*, i.amount AS invoice_total, i.paid_amount AS invoice_paid_amount, i.invoice_no, i.title AS invoice_title, a.gym_name
            FROM payments p
            JOIN invoices i ON p.invoice_id = i.id
            JOIN admins a ON p.admin_id = a.id
            WHERE p.id = ? AND p.admin_id = ?
            FOR UPDATE
        ');
        $stmt->execute([$paymentId, $adminId]);
        $payment = $stmt->fetch();

        if (!$payment) {
            $db->rollBack();
            fail('Payment not found or does not belong to your gym.', 404);
        }

        if ($payment['status'] !== 'pending') {
            $db->rollBack();
            fail('Payment has already been ' . $payment['status'] . '.', 400);
        }

        if ($action === 'verified') {
            // Update payment record
            $upPay = $db->prepare('
                UPDATE payments 
                SET status = "verified",
                    verified_by = ?,
                    verified_at = NOW(),
                    rejection_reason = NULL,
                    updated_at = NOW()
                WHERE id = ?
            ');
            $upPay->execute([$user['name'] . ' (Admin)', $paymentId]);

            // Settle invoice
            $newPaid = (float)$payment['invoice_paid_amount'] + (float)$payment['amount'];
            $totalAmount = (float)$payment['invoice_total'];
            $invStatus = $newPaid >= $totalAmount ? 'paid' : ($newPaid > 0 ? 'partial' : 'unpaid');

            $upInv = $db->prepare('
                UPDATE invoices
                SET paid_amount = ?,
                    status = ?,
                    paid_at = CASE WHEN ? = "paid" THEN NOW() ELSE paid_at END,
                    payment_method = ?
                WHERE id = ?
            ');
            $upInv->execute([$newPaid, $invStatus, $invStatus, strtoupper($payment['method']), (int)$payment['invoice_id']]);

            // Send notification to member
            $notif = $db->prepare('
                INSERT INTO notifications (user_id, admin_id, type, title, body)
                VALUES (?, ?, "invoice", "Payment Verified", ?)
            ');
            $msg = 'Your payment of NPR ' . number_format((float)$payment['amount'], 2) . ' for ' . ($payment['invoice_title'] ?: $payment['invoice_no']) . ' was verified and approved by ' . ($payment['gym_name'] ?: 'your gym') . '.';
            $notif->execute([(int)$payment['user_id'], $adminId, $msg]);

            $db->commit();
            ok([
                'message' => 'Payment verified successfully. Invoice marked as ' . $invStatus . '.',
                'status' => 'verified'
            ]);
        } else {
            // Rejected
            $upPay = $db->prepare('
                UPDATE payments 
                SET status = "rejected",
                    verified_by = ?,
                    verified_at = NULL,
                    rejection_reason = ?,
                    updated_at = NOW()
                WHERE id = ?
            ');
            $upPay->execute([$user['name'] . ' (Admin)', $rejectionReason ?: 'Payment details could not be verified.', $paymentId]);

            // Send notification to member
            $notif = $db->prepare('
                INSERT INTO notifications (user_id, admin_id, type, title, body)
                VALUES (?, ?, "invoice", "Payment Rejected", ?)
            ');
            $msg = 'Your payment of NPR ' . number_format((float)$payment['amount'], 2) . ' for ' . ($payment['invoice_title'] ?: $payment['invoice_no']) . ' was rejected. Reason: ' . ($rejectionReason ?: 'Payment could not be verified.');
            $notif->execute([(int)$payment['user_id'], $adminId, $msg]);

            $db->commit();
            ok([
                'message' => 'Payment rejected.',
                'status' => 'rejected'
            ]);
        }
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        throw $e;
    }
}

fail('Method not allowed.', 405);
