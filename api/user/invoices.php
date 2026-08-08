<?php
/**
 * User: my invoices (billing).
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('user');
$userId = (int)$ctx['id'];

$stmt = db()->prepare('SELECT i.*, ad.gym_name FROM invoices i
    JOIN admins ad ON ad.id = i.admin_id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC');
$stmt->execute([$userId]);
$rows = $stmt->fetchAll();

$totals = ['total' => 0.0, 'paid' => 0.0, 'outstanding' => 0.0];
foreach ($rows as $r) {
    if ($r['status'] === 'cancelled') {
        continue;
    }
    $totals['total'] += (float)$r['amount'];
    $totals['paid'] += (float)$r['paid_amount'];
    $totals['outstanding'] += (float)$r['amount'] - (float)$r['paid_amount'];
}
ok(['invoices' => $rows, 'totals' => $totals]);
