<?php
/**
 * upload - accept an image file (multipart/form-data) and store it in /uploads.
 * POST with field name "logo" (any signed-in portal may upload a gym logo).
 *
 * Returns the stored relative URL, e.g. { url: "uploads/logo_1712345678_ab12.png" }
 */
declare(strict_types=1);
require_once __DIR__ . '/../config/init.php';

if (!current_user()) {
    fail('Authentication required.', 401);
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail('Method not allowed.', 405);
}

$file = null;
foreach (['file', 'image', 'screenshot', 'logo', 'qr'] as $key) {
    if (!empty($_FILES[$key]) && ($_FILES[$key]['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $file = $_FILES[$key];
        break;
    }
}
if (!$file && !empty($_FILES)) {
    $first = reset($_FILES);
    if (($first['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        $file = $first;
    }
}

if (!$file) {
    fail('Please choose an image file to upload.');
}
if ($file['error'] !== UPLOAD_ERR_OK) {
    fail('The upload failed (error code ' . (int)$file['error'] . ').');
}
if ($file['size'] <= 0 || $file['size'] > 2 * 1024 * 1024) {
    fail('Image must be smaller than 2 MB.');
}

$info = @getimagesize($file['tmp_name']);
if ($info === false) {
    fail('Uploaded file is not a valid image.');
}
$allowed = [
    'image/png'  => 'png',
    'image/jpeg' => 'jpg',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
];
$mime = $info['mime'];
if (!isset($allowed[$mime])) {
    fail('Only PNG, JPG, WEBP and GIF images are allowed.');
}

$dir = realpath(__DIR__ . '/../uploads');
if ($dir === false || !is_writable($dir)) {
    fail('Uploads directory is not writable.', 500);
}

$name = 'logo_' . date('Ymd_His') . '_' . bin2hex(random_bytes(4)) . '.' . $allowed[$mime];
if (!move_uploaded_file($file['tmp_name'], $dir . DIRECTORY_SEPARATOR . $name)) {
    fail('Could not save the uploaded image.', 500);
}

ok(['url' => 'uploads/' . $name]);
