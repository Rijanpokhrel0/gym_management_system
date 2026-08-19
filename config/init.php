<?php
/**
 * ==========================================================================
 * FITPULSE MULTI-ADMIN GYM MANAGEMENT SYSTEM - BACKEND BOOTSTRAP
 * ==========================================================================
 */

declare(strict_types=1);

// ---- Load .env file ----
function loadEnv(string $path): void {
    if (!file_exists($path)) return;
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (str_starts_with(trim($line), '#')) continue;
        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            if (!array_key_exists($key, $_ENV)) {
                $_ENV[$key] = $value;
                putenv("$key=$value");
            }
        }
    }
}
loadEnv(__DIR__ . '/../.env');

// ---- Database credentials (from .env or defaults) ----
const DB_HOST = 'DB_HOST';
const DB_PORT = 'DB_PORT';
const DB_NAME = 'DB_NAME';
const DB_USER = 'DB_USER';
const DB_PASS = 'DB_PASS';

function env(string $key, $default = null) {
    return $_ENV[$key] ?? getenv($key) ?: $default;
}

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

// ---- PDO connection ----
function db(?string $dbname = null): PDO
{
    static $pdo = [];
    $dbname = $dbname ?? env('DB_NAME', 'fitpulse');
    $key = $dbname;
    if (!isset($pdo[$key])) {
        $dsn = 'mysql:host=' . env('DB_HOST', '127.0.0.1')
            . ';port=' . env('DB_PORT', '3306')
            . ';dbname=' . $dbname
            . ';charset=utf8mb4';
        $pdo[$key] = new PDO($dsn, env('DB_USER', 'root'), env('DB_PASS', ''), [
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

function body(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
const PORTAL_TABLES = ['superadmin' => 'superadmins', 'admin' => 'admins', 'trainer' => 'trainers', 'user' => 'users'];

/** @return array{portal:string,id:int,name:string,email:string}|null */
function current_user(): ?array
{
    if (empty($_SESSION['auth']['portal']) || empty($_SESSION['auth']['id'])) {
        return null;
    }
    $portal = $_SESSION['auth']['portal'];
    $table  = PORTAL_TABLES[$portal] ?? null;
    if (!$table) {
        return null;
    }
    static $cache = [];
    $key = $portal . ':' . (int)$_SESSION['auth']['id'];
    if (isset($cache[$key])) {
        return $cache[$key];
    }
    $stmt = db()->prepare("SELECT id, name, email, created_at FROM `$table` WHERE id = ?");
    $stmt->execute([(int)$_SESSION['auth']['id']]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    $row['portal'] = $portal;
    $row['id'] = (int)$row['id'];
    return $cache[$key] = $row;
}

function sign_in(string $portal, int $id): void
{
    session_regenerate_id(true);
    $_SESSION['auth'] = ['portal' => $portal, 'id' => $id];
}

function require_portal(string $portal): array
{
    $u = current_user();
    if (!$u) {
        fail('Authentication required. Please log in.', 401);
    }
    if ($u['portal'] !== $portal) {
        fail('Access denied. This action is restricted to the ' . $portal . ' portal.', 403);
    }
    return $u;
}

function p_date($value): ?string
{
    return $value ? (is_string($value) ? $value : null) : null;
}

// ---------------------------------------------------------------------------
// CSRF Token Helpers
// ---------------------------------------------------------------------------
function csrf_token(): string
{
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function csrf_field(): string
{
    return '<input type="hidden" name="_csrf_token" value="' . csrf_token() . '">';
}

function verify_csrf(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') return;
    $token = $_POST['_csrf_token'] ?? (json_decode(file_get_contents('php://input'), true)['_csrf_token'] ?? '');
    if (empty($token) || !hash_equals($_SESSION['csrf_token'] ?? '', $token)) {
        fail('Invalid or missing CSRF token.', 403);
    }
}

// ---------------------------------------------------------------------------
// Rate Limiting (file-based, per IP)
// ---------------------------------------------------------------------------
function rate_limit(string $action, int $maxAttempts = 10, int $windowSeconds = 60): void
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
    $dir = sys_get_temp_dir() . '/fitpulse_ratelimit';
    if (!is_dir($dir)) mkdir($dir, 0700);
    $file = $dir . '/' . md5($action . ':' . $ip) . '.json';

    $data = ['attempts' => 0, 'window_start' => time()];
    if (file_exists($file)) {
        $data = json_decode(file_get_contents($file), true) ?: $data;
    }

    // Reset window if expired
    if ((time() - ($data['window_start'] ?? 0)) > $windowSeconds) {
        $data = ['attempts' => 0, 'window_start' => time()];
    }

    $data['attempts']++;
    file_put_contents($file, json_encode($data));

    if ($data['attempts'] > $maxAttempts) {
        $retryAfter = $windowSeconds - (time() - $data['window_start']);
        header('Retry-After: ' . $retryAfter);
        fail('Too many attempts. Please try again in ' . $retryAfter . ' seconds.', 429);
    }
}

// ---------------------------------------------------------------------------
// JSON body helper (alias for body())
// ---------------------------------------------------------------------------
function json_body(): array
{
    return body();
}
