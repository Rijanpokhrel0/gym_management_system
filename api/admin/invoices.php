<?php
/**
 * Admin: member billing / invoices (own gym).
 * GET    - list invoices (with member names)
 * POST   - create invoice
 * PUT    - update invoice
 * POST action=pay - record a payment (paid_amount, payment_method)
 * DELETE - delete invoice
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

function fetch_invoice(int $adminId, int $id): ?array
{
    $stmt = db()->prepare('SELECT * FROM invoices WHERE id = ? AND admin_id = ?');
    $stmt->execute([$id, $adminId]);
    return $stmt->fetch() ?: null;
}

function next_invoice_no(PDO $pdo, int $adminId): string
{
    $stmt = $pdo->prepare('SELECT COUNT(*) AS n FROM invoices WHERE admin_id = ?');
    $stmt->execute([$adminId]);
    return 'INV-' . date('Y') . '-' . str_pad((string)((int)$stmt->fetch()['n'] + 1), 4, '0', STR_PAD_LEFT);
}

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT i.*, u.name AS user_name, u.email AS user_email
            FROM invoices i
            JOIN users u ON u.id = i.user_id
            WHERE i.admin_id = ?
            ORDER BY i.created_at DESC');
        $stmt->execute([$adminId]);
        ok(['invoices' => $stmt->fetchAll()]);
        break;

    case 'POST':
        if (($d['action'] ?? '') === 'pay') {
            $id = (int)($d['id'] ?? 0);
            $inv = fetch_invoice($adminId, $id);
            if (!$inv) {
                fail('Invoice not found.', 404);
            }
            if ($inv['status'] === 'cancelled') {
                fail('This invoice was cancelled.');
            }
            $amount = (float)($d['paid_amount'] ?? $inv['amount']);
            if ($amount <= 0) {
                fail('Payment amount must be greater than zero.');
            }
            $paid = (float)$inv['paid_amount'] + $amount;
            if ($paid > (float)$inv['amount']) {
                fail('Payment exceeds the invoice total.');
            }
            $status = $paid >= (float)$inv['amount'] ? 'paid' : 'partial';
            db()->prepare('UPDATE invoices SET paid_amount = ?, status = ?, payment_method = ?, paid_at = IF(? >= amount, NOW(), paid_at) WHERE id = ?')
                ->execute([$paid, $status, trim((string)($d['payment_method'] ?? '')), $paid, $id]);
            $new = fetch_invoice($adminId, $id);
            db()->prepare('INSERT INTO notifications (user_id, admin_id, type, title, body) VALUES (?, ?, "invoice", ?, ?)')
                ->execute([$new['user_id'], $adminId, 'Payment received',
                    "Payment of NPR " . number_format($amount, 2) . " received for {$new['invoice_no']}."]);
            ok(['message' => 'Payment recorded.', 'invoice' => $new]);
        }
        $userId = (int)($d['user_id'] ?? 0);
        $chk = db()->prepare('SELECT id FROM users WHERE id = ? AND admin_id = ?');
        $chk->execute([$userId, $adminId]);
        if (!$chk->fetch()) {
            fail('Member not found in your gym.', 404);
        }
        $title = trim((string)($d['title'] ?? ''));
        $amount = (float)($d['amount'] ?? 0);
        if ($title === '' || $amount <= 0) {
            fail('Invoice title and amount (greater than 0) are required.');
        }
        $stmt = db()->prepare('INSERT INTO invoices (admin_id, user_id, invoice_no, title, description, amount, due_date, status) VALUES (?, ?, ?, ?, ?, ?, ?, "unpaid")');
        $stmt->execute([
            $adminId, $userId, next_invoice_no(db(), $adminId), $title,
            trim((string)($d['description'] ?? '')), $amount,
            ($d['due_date'] ?? '') !== '' ? trim((string)$d['due_date']) : null,
        ]);
        $newId = (int)db()->lastInsertId();
        db()->prepare('INSERT INTO notifications (user_id, admin_id, type, title, body) VALUES (?, ?, "invoice", ?, ?)')
            ->execute([$userId, $adminId, 'invoice', 'New invoice ' . next_invoice_no(db(), $adminId),
                "An invoice of NPR " . number_format($amount, 2) . " was issued to you."]);
        ok(['id' => $newId, 'message' => 'Invoice created.']);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        if (!fetch_invoice($adminId, $id)) {
            fail('Invoice not found.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['title', 'description', 'payment_method'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        if (array_key_exists('user_id', $d)) {
            $set[]  = 'user_id = ?';
            $args[] = (int)$d['user_id'];
        }
        if (array_key_exists('amount', $d)) {
            $set[]  = 'amount = ?';
            $args[] = (float)$d['amount'];
        }
        if (array_key_exists('due_date', $d)) {
            $set[]  = 'due_date = ?';
            $args[] = ($d['due_date'] ?? '') !== '' ? trim((string)$d['due_date']) : null;
        }
        if (array_key_exists('status', $d) && in_array($d['status'], ['unpaid', 'partial', 'paid', 'cancelled'], true)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'];
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $id;
        db()->prepare('UPDATE invoices SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Invoice updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM invoices WHERE id = ? AND admin_id = ?')->execute([$id, $adminId]);
        ok(['message' => 'Invoice removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
