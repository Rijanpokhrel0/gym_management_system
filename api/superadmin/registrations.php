<?php
/**
 * Superadmin: manage Owner Registration requests.
 * GET  - list pending registrations
 * POST - approve or reject a registration
 */
declare(strict_types=1);
require_once __DIR__ . '/../../config/init.php';

require_portal('superadmin');
$method = $_SERVER['REQUEST_METHOD'];
$d      = body();

switch ($method) {
    case 'GET':
        $rows = db()->query(
            'SELECT ur.id, ur.amount, ur.transaction_id, ur.payment_screenshot, ur.status, ur.created_at,
                    a.id as admin_id, a.name, a.email, a.gym_name, a.phone, a.verification_status
             FROM owner_registrations ur
             JOIN admins a ON ur.admin_id = a.id
             WHERE ur.status = \'pending\'
             ORDER BY ur.created_at DESC'
        )->fetchAll();
        ok(['registrations' => $rows]);
        break;

    case 'POST':
        $registrationId = (int)($d['registration_id'] ?? 0);
        $action = (string)($d['action'] ?? '');
        $adminNotes = trim((string)($d['admin_notes'] ?? ''));

        if (!$registrationId) {
            fail('Registration ID is required.');
        }
        if (!in_array($action, ['approved', 'rejected'], true)) {
            fail('Action must be approved or rejected.');
        }

        // Get registration
        $stmt = db()->prepare('SELECT id, admin_id, status FROM owner_registrations WHERE id = ?');
        $stmt->execute([$registrationId]);
        $reg = $stmt->fetch();
        if (!$reg) {
            fail('Registration not found.', 404);
        }
        if ($reg['status'] !== 'pending') {
            fail('Registration already processed.');
        }

        $adminId = (int)$reg['admin_id'];

        // Update registration record
        $stmt = db()->prepare(
            'UPDATE owner_registrations 
             SET status = ?, admin_notes = ?, reviewed_by = ?, reviewed_at = NOW(), updated_at = NOW()
             WHERE id = ?'
        );
        $stmt->execute([$action, $adminNotes ?: null, $_SESSION['auth']['id'], $registrationId]);

        // Update admin verification status
        $newStatus = $action === 'approved' ? 'approved' : 'rejected';
        $isActive = $action === 'approved';
        $stmt = db()->prepare('UPDATE admins SET verification_status = ?, status = ? WHERE id = ?');
        $stmt->execute([$newStatus, $isActive ? 'active' : 'suspended', $adminId]);

        ok([
            'message' => "Owner registration {$action}.",
            'verification_status' => $newStatus,
        ]);
        break;

    default:
        fail('Method not allowed.', 405);
}
