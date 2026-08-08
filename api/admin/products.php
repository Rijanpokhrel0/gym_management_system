<?php
/**
 * Admin: product management (own gym only).
 * Products = supplements / merchandise / memberships / services.
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

$ctx = require_portal('admin');
$adminId = (int)$ctx['id'];
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $stmt = db()->prepare('SELECT * FROM products WHERE admin_id = ? ORDER BY created_at DESC');
        $stmt->execute([$adminId]);
        ok(['products' => $stmt->fetchAll()]);
        break;

    case 'POST':
        $name = trim((string)($d['name'] ?? ''));
        if ($name === '') {
            fail('Product name is required.');
        }
        $stmt = db()->prepare('INSERT INTO products (admin_id, name, category, price, stock, description, image_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $adminId,
            $name,
            in_array($d['category'] ?? '', ['Supplement', 'Merchandise', 'Membership', 'Service'], true) ? $d['category'] : 'Supplement',
            (float)($d['price'] ?? 0),
            (int)($d['stock'] ?? 0),
            trim((string)($d['description'] ?? '')),
            trim((string)($d['image_url'] ?? '')),
            ($d['status'] ?? '') === 'inactive' ? 'inactive' : 'active',
        ]);
        ok(['id' => (int)db()->lastInsertId(), 'message' => 'Product added.']);
        break;

    case 'PUT':
        $id = (int)($d['id'] ?? 0);
        $stmt = db()->prepare('SELECT * FROM products WHERE id = ? AND admin_id = ?');
        $stmt->execute([$id, $adminId]);
        if (!$stmt->fetch()) {
            fail('Product not found.', 404);
        }
        $set  = [];
        $args = [];
        foreach (['name', 'description', 'image_url'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = trim((string)$d[$f]);
            }
        }
        foreach (['price', 'stock'] as $f) {
            if (array_key_exists($f, $d)) {
                $set[]  = "`$f` = ?";
                $args[] = (float)$d[$f];
            }
        }
        if (array_key_exists('category', $d) && in_array($d['category'], ['Supplement', 'Merchandise', 'Membership', 'Service'], true)) {
            $set[]  = 'category = ?';
            $args[] = $d['category'];
        }
        if (array_key_exists('status', $d)) {
            $set[]  = 'status = ?';
            $args[] = $d['status'] === 'inactive' ? 'inactive' : 'active';
        }
        if (!$set) {
            fail('Nothing to update.');
        }
        $args[] = $id;
        db()->prepare('UPDATE products SET ' . implode(', ', $set) . ' WHERE id = ?')->execute($args);
        ok(['message' => 'Product updated.']);
        break;

    case 'DELETE':
        $id = (int)($d['id'] ?? 0);
        db()->prepare('DELETE FROM products WHERE id = ? AND admin_id = ?')->execute([$id, $adminId]);
        ok(['message' => 'Product removed.']);
        break;

    default:
        fail('Method not allowed.', 405);
}
