<?php
/**
 * ==========================================================================
 * FITPULSE - ADMIN PAYMENT METHODS (QR CODES) API
 * ==========================================================================
 * Providers: esewa, khalti, fonepay, mobile_banking
 * Admin uploads and manages their own QR codes and payment details.
 */

declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$user = require_portal('admin');
$adminId = (int)$user['id'];
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$db = db();

const ALLOWED_PROVIDERS = ['esewa', 'khalti', 'fonepay', 'mobile_banking'];

// GET: List all payment methods for the logged-in gym admin
if ($method === 'GET') {
    $stmt = $db->prepare('
        SELECT id, admin_id, provider, account_name, account_number, qr_image_url, is_active, created_at, updated_at
        FROM payment_methods
        WHERE admin_id = ?
        ORDER BY id ASC
    ');
    $stmt->execute([$adminId]);
    ok(['payment_methods' => $stmt->fetchAll()]);
}

// POST: Add new payment method (QR code)
if ($method === 'POST') {
    $b = json_body();
    $provider = trim((string)($b['provider'] ?? ''));
    $accountName = trim((string)($b['account_name'] ?? ''));
    $accountNumber = trim((string)($b['account_number'] ?? ''));
    $qrImageUrl = trim((string)($b['qr_image_url'] ?? ''));

    if (!in_array($provider, ALLOWED_PROVIDERS, true)) {
        fail('Provider must be one of: ' . implode(', ', ALLOWED_PROVIDERS));
    }
    if ($qrImageUrl === '') {
        fail('QR code image URL is required.');
    }

    try {
        $stmt = $db->prepare('
            INSERT INTO payment_methods (admin_id, provider, account_name, account_number, qr_image_url, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        ');
        $stmt->execute([$adminId, $provider, $accountName ?: null, $accountNumber ?: null, $qrImageUrl]);
        $id = (int)$db->lastInsertId();

        $fetch = $db->prepare('SELECT * FROM payment_methods WHERE id = ?');
        $fetch->execute([$id]);
        ok(['message' => 'Payment method added successfully.', 'payment_method' => $fetch->fetch()], 201);
    } catch (PDOException $e) {
        if ($e->getCode() === '23000') {
            fail('A payment method already exists for provider: ' . $provider, 409);
        }
        throw $e;
    }
}

// PUT: Update a payment method (toggle active, update account name/number, update QR)
if ($method === 'PUT') {
    $b = json_body();
    $id = (int)($b['id'] ?? 0);
    if ($id <= 0) fail('Invalid payment method ID.');

    // Check ownership
    $check = $db->prepare('SELECT id FROM payment_methods WHERE id = ? AND admin_id = ?');
    $check->execute([$id, $adminId]);
    if (!$check->fetch()) fail('Payment method not found or not owned by you.', 404);

    $fields = [];
    $params = [];

    if (isset($b['provider'])) {
        $provider = trim((string)$b['provider']);
        if (!in_array($provider, ALLOWED_PROVIDERS, true)) {
            fail('Provider must be one of: ' . implode(', ', ALLOWED_PROVIDERS));
        }
        $fields[] = 'provider = ?';
        $params[] = $provider;
    }
    if (isset($b['account_name'])) {
        $fields[] = 'account_name = ?';
        $params[] = trim((string)$b['account_name']) ?: null;
    }
    if (isset($b['account_number'])) {
        $fields[] = 'account_number = ?';
        $params[] = trim((string)$b['account_number']) ?: null;
    }
    if (isset($b['qr_image_url'])) {
        $qr = trim((string)$b['qr_image_url']);
        if ($qr === '') fail('QR image URL cannot be empty.');
        $fields[] = 'qr_image_url = ?';
        $params[] = $qr;
    }
    if (isset($b['is_active'])) {
        $fields[] = 'is_active = ?';
        $params[] = $b['is_active'] ? 1 : 0;
    }

    if (empty($fields)) fail('No fields provided to update.');

    $params[] = $id;
    $params[] = $adminId;

    $stmt = $db->prepare('UPDATE payment_methods SET ' . implode(', ', $fields) . ' WHERE id = ? AND admin_id = ?');
    $stmt->execute($params);

    $fetch = $db->prepare('SELECT * FROM payment_methods WHERE id = ?');
    $fetch->execute([$id]);
    ok(['message' => 'Payment method updated successfully.', 'payment_method' => $fetch->fetch()]);
}

// DELETE: Delete a payment method
if ($method === 'DELETE') {
    $b = json_body();
    $id = (int)($b['id'] ?? 0);
    if ($id <= 0) fail('Invalid payment method ID.');

    $stmt = $db->prepare('DELETE FROM payment_methods WHERE id = ? AND admin_id = ?');
    $stmt->execute([$id, $adminId]);

    if ($stmt->rowCount() === 0) {
        fail('Payment method not found or already deleted.', 404);
    }
    ok(['message' => 'Payment method deleted successfully.']);
}

fail('Method not allowed.', 405);
