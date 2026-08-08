<?php
/**
 * ==========================================================================
 * FITPULSE - EMAIL (SMTP) SETTINGS + LIGHTWEIGHT MAILER
 * ==========================================================================
 * Sends verification / password-reset emails. No external libraries required.
 *
 * HOW TO CONFIGURE:
 *  1. Open https://myaccount.google.com/security and enable 2-Step Verification,
 *     then create an "App password" for Mail (16 characters, no spaces).
 *  2. Set SMTP_USER to your Gmail address and SMTP_PASS to that app password.
 *     Works with any SMTP server (Outlook, Zoho, SendGrid, Mailtrap for testing).
 *  3. Set APP_URL to the public URL of this app (used in email links).
 *     For local testing with XAMPP it can stay as http://localhost/gym/
 *
 * Test with:  php config/test-mail.php  (optional file, delete after testing)
 * ==========================================================================
 */

declare(strict_types=1);

// ---- App base URL used inside email links (no trailing slash) ----
if (!defined('APP_URL')) {
    define('APP_URL', 'http://localhost/gym');
}

// ---- SMTP credentials ----
const SMTP_HOST   = 'smtp.gmail.com';
const SMTP_PORT   = 587;              // TLS
const SMTP_USER   = 'your@gmail.com'; // full email address
const SMTP_PASS   = 'your-app-password';
const SMTP_FROM   = 'FitPulse <your@gmail.com>';
const SMTP_REPLY  = 'your@gmail.com';

// In demo mode no real emails are sent; the mail content is returned instead
// (handy when SMTP is not configured yet).
const SMTP_DEMO   = true;             // set to false when SMTP_PASS is configured

// Minimum seconds between emails to the same address (anti-spam / anti-abuse).
const EMAIL_COOLDOWN_SECONDS = 120;

/**
 * Enforce a per-email sending cooldown. Returns the number of seconds left
 * to wait (0 = allowed) based on the latest row in `$table` filtered by the
 * given WHERE clause. Usage:
 *
 *   $wait = email_cooldown_left('users', 'email = ?', [$email]);
 *   if ($wait > 0) fail("Please wait {$wait} seconds before requesting another email.");
 */
function email_cooldown_left(string $table, string $where, array $args, string $tsColumn = 'created_at'): int
{
    if (EMAIL_COOLDOWN_SECONDS <= 0) {
        return 0;
    }
    // Elapsed seconds are computed inside MySQL so PHP/MySQL timezone
    // differences can never skew the cooldown.
    $sql = "SELECT COALESCE(TIMESTAMPDIFF(SECOND, MAX(`$tsColumn`), NOW()), 99999)
            FROM `$table` WHERE $where";
    $stmt = db()->prepare($sql);
    $stmt->execute($args);
    $elapsed = (int)$stmt->fetchColumn();
    return max(0, EMAIL_COOLDOWN_SECONDS - $elapsed);
}

/**
 * Minimal SMTP client: EHLO -> STARTTLS -> AUTH LOGIN -> send message.
 * Returns [ok: bool, detail: string].
 */
function mail_send(string $to, string $subject, string $html): array
{
    $from  = SMTP_FROM;
    $reply = SMTP_REPLY;

    $body  = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;border:1px solid #eee;border-radius:12px;overflow:hidden">'
           . '<div style="background:#1f2430;color:#fff;padding:18px 24px;font-size:18px;font-weight:bold">'
           . 'FitPulse <span style="color:#f97316">Gym</span> Management</div>'
           . '<div style="padding:24px">' . $html . '</div>'
           . '<div style="background:#f7f7f8;padding:12px 24px;font-size:12px;color:#888">'
           . 'You are receiving this email because of activity on the FitPulse platform.</div>'
           . '</div>';

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: text/html; charset=UTF-8\r\n";
    $headers .= 'From: ' . $from . "\r\n";
    $headers .= 'Reply-To: ' . $reply . "\r\n";

    $message  = "To: $to\r\n" . $headers . "Subject: $subject\r\n\r\n" . $body;

    if (SMTP_DEMO) {
        return [true, 'demo']; // mail not really sent
    }

    $sock = @stream_socket_client('tcp://' . SMTP_HOST . ':' . SMTP_PORT, $errno, $errstr, 20);
    if (!$sock) {
        return [false, "Cannot connect to SMTP server: $errstr"];
    }
    stream_set_timeout($sock, 20);

    $resp = smtp_expect($sock, 220);
    if ($resp[0] !== 'ok') return [false, 'Connect: ' . $resp[1]];

    $resp = smtp_cmd($sock, "EHLO " . (SMTP_HOST === 'smtp.gmail.com' ? 'smtp.gmail.com' : SMTP_HOST));
    if ($resp[0] !== 'ok') return [false, 'EHLO: ' . $resp[1]];

    if (SMTP_PORT === 587) {
        $resp = smtp_cmd($sock, "STARTTLS");
        if ($resp[0] !== 'ok') return [false, 'STARTTLS: ' . $resp[1]];
        if (!stream_socket_enable_crypto($sock, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            return [false, 'TLS negotiation failed.'];
        }
        $resp = smtp_cmd($sock, 'EHLO ' . SMTP_HOST);
        if ($resp[0] !== 'ok') return [false, 'EHLO(TLS): ' . $resp[1]];
    }

    $resp = smtp_cmd($sock, 'AUTH LOGIN');
    if ($resp[0] !== 'ok') return [false, 'AUTH: ' . $resp[1]];
    $resp = smtp_cmd($sock, base64_encode(SMTP_USER));
    if ($resp[0] !== 'ok') return [false, 'AUTH user: ' . $resp[1]];
    $resp = smtp_cmd($sock, base64_encode(SMTP_PASS));
    if ($resp[0] !== 'ok') return [false, 'AUTH pass: ' . $resp[1]];

    $resp = smtp_cmd($sock, 'MAIL FROM:<' . SMTP_USER . '>');
    if ($resp[0] !== 'ok') return [false, 'MAIL FROM: ' . $resp[1]];
    $resp = smtp_cmd($sock, 'RCPT TO:<' . $to . '>');
    if ($resp[0] !== 'ok') return [false, 'RCPT TO: ' . $resp[1]];
    $resp = smtp_cmd($sock, 'DATA');
    if ($resp[0] !== 'ok') return [false, 'DATA: ' . $resp[1]];

    fwrite($sock, str_replace("\r\n.\r\n", "\r\n..\r\n", $message) . "\r\n.\r\n");
    $resp = smtp_expect($sock, 250);
    if ($resp[0] !== 'ok') {
        return [false, 'Message: ' . $resp[1]];
    }

    fwrite($sock, "QUIT\r\n");
    fclose($sock);
    return [true, 'sent'];
}

/** Send one command and wait for the expected 2xx/3xx class. */
function smtp_cmd($sock, string $cmd): array
{
    fwrite($sock, $cmd . "\r\n");
    return smtp_expect($sock);
}

/** Read multiline SMTP reply; ok = 2xx or 3xx. */
function smtp_expect($sock, ?int $wantedCode = null): array
{
    $code = null;
    $data = '';
    while (true) {
        $line = fgets($sock, 512);
        if ($line === false) return ['fail', 'Connection closed by server.'];
        $data .= $line;
        if (strlen($line) >= 4 && (substr($line, 3, 1) === ' ' || substr($line, 3, 1) === '-')) {
            $code = (int)substr($line, 0, 3);
            if (substr($line, 3, 1) === ' ') break; // last line of reply
        }
    }
    $ok = $code !== null && $code >= 200 && $code < 400;
    if ($wantedCode !== null && $ok) {
        $ok = $code === $wantedCode;
    }
    return [$ok ? 'ok' : 'fail', trim($data)];
}

/** Build a verification email body. */
function verification_email(string $link): string
{
    $btn = '<a href="' . htmlspecialchars($link) . '" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Verify my email</a>';
    return '<h2 style="margin-top:0">Welcome to FitPulse!</h2>'
         . '<p>Thanks for creating a member account. Please confirm your email address to finish signing up and start following gyms.</p>'
         . '<p style="margin:22px 0">' . $btn . '</p>'
         . '<p style="font-size:12px;color:#999">Or copy this link into your browser:<br>' . htmlspecialchars($link) . '</p>';
}

/** Build a password reset email body. */
function reset_email(string $link): string
{
    $btn = '<a href="' . htmlspecialchars($link) . '" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:bold">Reset my password</a>';
    return '<h2 style="margin-top:0">Reset your password</h2>'
         . '<p>Someone asked to reset the password for your FitPulse account. Use the button below. This link expires in 1 hour.</p>'
         . '<p style="margin:22px 0">' . $btn . '</p>'
         . '<p style="font-size:12px;color:#999">If you did not request this, you can safely ignore this email.</p>';
}
