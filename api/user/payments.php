<?php
/**
 * ==========================================================================
 * FITPULSE - MEMBER PAYMENTS & PROOF SUBMISSION API
 * ==========================================================================
 * Allows member to submit payment proof (QR screenshot + transaction ID)
 * for an invoice, and view status of all their payments.
 */

declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$user = require_portal('user');
$userId = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$db = db();

const ALLOWED_PROVIDERS = ['esewa', 'khalti', 'fonepay', 'mobile_banking'];

// GET: View current user's submitted payments & statuses
if ($method === 'GET') {
    $stmt = $db->prepare('
        SELECT 
            p.id, p.invoice_id, p.amount, p.method, p.transaction_id, p.proof_image,
            p.status, p.rejection_reason, p.verified_at, p.created_at,
            i.invoice_no, i.title AS invoice_title, i.due_date,
            a.gym_name
        FROM payments p
        JOIN invoices i ON p.invoice_id = i.id
        JOIN admins a ON p.admin_id = a.id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    ');
    $stmt->execute([$userId]);
    ok([
        'payments' => $stmt->fetchAll()
    ]);
}

// POST: Submit a payment proof for an invoice
if ($method === 'POST') {
    $b = json_body();
    $invoiceId = (int)($b['invoice_id'] ?? 0);
    $provider = trim((string)($b['method'] ?? $b['provider'] ?? ''));
    $transactionId = trim((string)($b['transaction_id'] ?? ''));
    $proofImage = trim((string)($b['proof_image'] ?? ''));
    $amount = isset($b['amount']) ? (float)$b['amount'] : null;

    if ($invoiceId <= 0) fail('Invoice ID is required.');
    if (!in_array($provider, ALLOWED_PROVIDERS, true)) {
        fail('Payment method must be one of: ' . implode(', ', ALLOWED_PROVIDERS));
    }
    if ($transactionId === '' && $proofImage === '') {
        fail('Transaction ID or payment proof screenshot is required.');
    }

    // Verify invoice belongs to user and is pending payment
    $invStmt = $db->prepare('
        SELECT id, admin_id, user_id, invoice_no, title, amount, paid_amount, status
        FROM invoices
        WHERE id = ? AND user_id = ?
    ');
    $invStmt->execute([$invoiceId, $userId]);
    $inv = $invStmt->fetch();

    if (!$inv) {
        fail('Invoice not found or not authorized.', 404);
    }

    if ($inv['status'] === 'paid') {
        fail('This invoice has already been fully paid.', 400);
    }

    // Check if there is already an unreviewed pending payment for this invoice
    $checkPending = $db->prepare('
        SELECT id FROM payments
        WHERE invoice_id = ? AND user_id = ? AND status = "pending"
    ');
    $checkPending->execute([$invoiceId, $userId]);
    if ($checkPending->fetch()) {
        fail('You already have a pending payment verification submitted for this invoice.', 409);
    }

    $dueAmount = (float)$inv['amount'] - (float)$inv['paid_amount'];
    $payAmount = ($amount !== null && $amount > 0) ? min($amount, $dueAmount) : $dueAmount;

    $stmt = $db->prepare('
        INSERT INTO payments (invoice_id, admin_id, user_id, amount, method, transaction_id, proof_image, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, "pending")
    ');
    $stmt->execute([
        $invoiceId,
        (int)$inv['admin_id'],
        $userId,
        $payAmount,
        $provider,
        $transactionId ?: null,
        $proofImage ?: null
    ]);

    $payId = (int)$db->lastInsertId();

    // Push notification to gym admin
    $notif = $db->prepare('
        INSERT INTO notifications (user_id, admin_id, type, title, body)
        VALUES (?, ?, "invoice", "Payment Submitted", ?)
    ');
    $msg = $user['name'] . ' submitted a ' . strtoupper($provider) . ' payment of NPR ' . number_format($payAmount, 2) . ' for ' . ($inv['title'] ?: $inv['invoice_no']) . '. Please verify.';
    $notif->execute([$userId, (int)$inv['admin_id'], $msg]);

    ok([
        'message' => 'Payment submitted successfully. Awaiting gym admin verification.',
        'payment_id' => $payId,
        'status' => 'pending'
    ], 201);
}

fail('Method not allowed.', 405);
