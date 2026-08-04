<?php
/**
 * ==========================================================================
 * FITPULSE GYM MANAGEMENT SYSTEM - BACKEND BOOTSTRAP
 * ==========================================================================
 * Central configuration: database credentials, session handling, CORS,
 * PDO connection and shared helpers. Every API endpoint requires this file.
 *
 * Default XAMPP credentials are root / (empty password). If your MySQL
 * uses a different username or password, change them here.
 * ==========================================================================
 */

declare(strict_types=1);

// ---- Database credentials (edit for your MySQL setup) ----
const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'fitpulse';
const DB_USER = 'root';
const DB_PASS = '';

// ---- CORS: allow the frontend to run from any localhost port ----
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $host = parse_url($origin, PHP_URL_HOST) ?? '';
    if (in_array($host, ['localhost', '127.0.0.1'], true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type');
    }
}
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---- PHP session (httpOnly cookie, Lax) ----
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_name('FITPULSE_SESSID');
session_start();

// ---- PDO connection (optional database name, used by the seeder) ----
function db(?string $dbname = DB_NAME): PDO
{
    static $pdo = [];
    $key = $dbname ?? 'server';
    if (!isset($pdo[$key])) {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT
            . ($dbname !== null ? ';dbname=' . $dbname : '')
            . ';charset=utf8mb4';
        $pdo[$key] = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo[$key];
}

// ---- JSON response helpers ----
function json_response($data, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($data);
    exit;
}

function ok($data = []): void
{
    json_response(array_merge(['ok' => true], $data));
}

function fail(string $message, int $code = 400): void
{
    json_response(['ok' => false, 'message' => $message], $code);
}

// ---- Auth helpers ----
function current_user(): ?array
{
    if (empty($_SESSION['user_id'])) {
        return null;
    }
    static $user = null;
    if ($user === null) {
        $stmt = db()->prepare('SELECT id, name, email, role, goal, created_at FROM users WHERE id = ?');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch() ?: null;
    }
    return $user;
}

function require_role(string $role): array
{
    $u = current_user();
    if (!$u) {
        fail('Authentication required. Please log in.', 401);
    }
    if ($u['role'] !== $role) {
        fail('Access denied. This action is restricted to the ' . $role . ' portal.', 403);
    }
    return $u;
}
