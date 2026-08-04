<?php
/**
 * ==========================================================================
 * FITPULSE DATABASE SETUP & SEEDER
 * ==========================================================================
 * Creates the `fitpulse` database, all tables, and demo data.
 *
 * HOW TO RUN (from the project root):
 *   php database/seed.php
 *
 * The script is idempotent: running it again resets the database.
 * ==========================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/init.php';

echo "== FitPulse Database Setup ==\n";

// ---- 1. Create the database if it does not exist ----
db(null)->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
echo "[ok] Database '{DB_NAME}' ready.\n";

$pdo = db();

// ---- 2. Reset tables ----
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
$pdo->exec('DROP TABLE IF EXISTS bookings');
$pdo->exec('DROP TABLE IF EXISTS payments');
$pdo->exec('DROP TABLE IF EXISTS classes');
$pdo->exec('DROP TABLE IF EXISTS trainers');
$pdo->exec('DROP TABLE IF EXISTS members');
$pdo->exec('DROP TABLE IF EXISTS users');
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

// ---- 3. Create tables ----
$pdo->exec('
  CREATE TABLE users (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    email      VARCHAR(150) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       ENUM("admin","user","trainer") NOT NULL DEFAULT "user",
    goal       VARCHAR(120) DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
');

$pdo->exec('
  CREATE TABLE members (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    email       VARCHAR(150) NOT NULL DEFAULT "",
    phone       VARCHAR(40)  NOT NULL DEFAULT "",
    plan        VARCHAR(80)  NOT NULL DEFAULT "Standard Fitness",
    status      ENUM("Active","Expiring","Inactive") NOT NULL DEFAULT "Active",
    join_date   DATE DEFAULT NULL,
    expiry_date DATE DEFAULT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
');

$pdo->exec('
  CREATE TABLE trainers (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    user_id        INT NOT NULL,
    specialization VARCHAR(120) NOT NULL,
    experience     INT NOT NULL DEFAULT 0,
    shifts         JSON NOT NULL,
    status         ENUM("pending","approved","rejected") NOT NULL DEFAULT "pending",
    registered_at  DATE DEFAULT NULL,
    CONSTRAINT fk_trainers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
');

$pdo->exec('
  CREATE TABLE classes (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    title    VARCHAR(120) NOT NULL,
    trainer  VARCHAR(100) NOT NULL DEFAULT "",
    day      VARCHAR(20)  NOT NULL DEFAULT "Monday",
    time     VARCHAR(60)  NOT NULL DEFAULT "",
    capacity INT NOT NULL DEFAULT 20,
    booked   INT NOT NULL DEFAULT 0,
    category VARCHAR(60)  NOT NULL DEFAULT "Fitness"
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
');

$pdo->exec('
  CREATE TABLE payments (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    invoice_no   VARCHAR(30) NOT NULL,
    member       VARCHAR(120) NOT NULL,
    plan         VARCHAR(120) NOT NULL DEFAULT "Membership Fee",
    amount       DECIMAL(10,2) NOT NULL DEFAULT 0,
    method       VARCHAR(50) NOT NULL DEFAULT "Cash",
    payment_date DATE DEFAULT NULL,
    status       ENUM("Paid","Pending") NOT NULL DEFAULT "Paid"
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
');

$pdo->exec('
  CREATE TABLE bookings (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL,
    trainer_id   INT NOT NULL,
    shift        VARCHAR(120) NOT NULL,
    notes        TEXT,
    booking_date DATE DEFAULT NULL,
    CONSTRAINT fk_bookings_user    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    CONSTRAINT fk_bookings_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
');

echo "[ok] Tables created.\n";

// ---- 4. Seed demo users (bcrypt hashed passwords) ----
function seed_user(PDO $pdo, string $name, string $email, string $role, string $plainPassword, ?string $goal = null): int
{
    $stmt = $pdo->prepare('INSERT INTO users (name, email, password, role, goal) VALUES (?, ?, ?, ?, ?)');
    $stmt->execute([$name, $email, password_hash($plainPassword, PASSWORD_BCRYPT), $role, $goal]);
    return (int)$pdo->lastInsertId();
}

$adminId  = seed_user($pdo, 'System Administrator', 'admin@fitpulse.com', 'admin', 'admin123');
$aaravId  = seed_user($pdo, 'Aarav Sharma', 'aarav.sharma@example.com', 'user', 'user123', 'Muscle Hypertrophy');
$sitaId   = seed_user($pdo, 'Sita Gurung', 'sita.g@example.com', 'user', 'user123', 'Weight Loss & Cardio');
$alexId   = seed_user($pdo, 'Alex Morgan', 'alex.trainer@fitpulse.com', 'trainer', 'trainer123');
$sujataId = seed_user($pdo, 'Sujata Rai', 'sujata.rai@fitpulse.com', 'trainer', 'trainer123');
$markId   = seed_user($pdo, 'Mark Davis', 'mark.davis@fitpulse.com', 'trainer', 'trainer123');
$elenaId  = seed_user($pdo, 'Elena Rostova', 'elena.r@fitpulse.com', 'trainer', 'trainer123');

// ---- 5. Seed trainers ----
$trainers = [
    [$alexId,   'HIIT & Powerlifting',  5, ['Morning Shift (06:00 AM - 10:00 AM)'],   'approved', '2026-07-10'],
    [$sujataId, 'Yoga & Flexibility',   8, ['Evening Shift (05:00 PM - 09:00 PM)'],  'approved', '2026-07-12'],
    [$markId,   'CrossFit Endurance',   6, ['Afternoon Shift (12:00 PM - 04:00 PM)'], 'pending',  '2026-07-28'],
    [$elenaId,  'Zumba & Cardio Dance', 4, ['Morning Shift (06:00 AM - 10:00 AM)'],   'pending',  '2026-07-30'],
];
$stmt = $pdo->prepare('INSERT INTO trainers (user_id, specialization, experience, shifts, status, registered_at) VALUES (?, ?, ?, ?, ?, ?)');
foreach ($trainers as $t) {
    $stmt->execute([$t[0], $t[1], $t[2], json_encode($t[3]), $t[4], $t[5]]);
}
$alexTrainerId = (int)$pdo->query('SELECT id FROM trainers WHERE user_id = ' . $alexId)->fetchColumn();
$sujataTrainerId = (int)$pdo->query('SELECT id FROM trainers WHERE user_id = ' . $sujataId)->fetchColumn();

// ---- 6. Seed members directory ----
$members = [
    ['Aarav Sharma', 'aarav.sharma@example.com', '+977 9841234567', 'Premium VIP',      'Active',   '2026-01-15', '2027-01-15'],
    ['Sita Gurung',  'sita.g@example.com',       '+977 9801987654', 'Standard Fitness', 'Active',   '2026-03-10', '2026-09-10'],
    ['Bikash Thapa', 'bikash.t@example.com',     '+977 9812345678', 'Basic Access',     'Expiring', '2025-08-01', '2026-08-01'],
    ['Pooja Karki',  'pooja.karki@example.com',  '+977 9851122334', 'Standard Fitness', 'Active',   '2026-05-20', '2026-11-20'],
    ['Rohan Adhikari', 'rohan.a@example.com',    '+977 9860998877', 'Premium VIP',      'Inactive', '2025-02-10', '2026-02-10'],
];
$stmt = $pdo->prepare('INSERT INTO members (name, email, phone, plan, status, join_date, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?)');
foreach ($members as $m) {
    $stmt->execute($m);
}

// ---- 7. Seed classes ----
$classes = [
    ['Morning Power Yoga',   'Sujata Rai',    'Monday',    '06:30 AM - 07:30 AM', 20, 14, 'Flexibility'],
    ['HIIT Fat Burner',      'Alex Morgan',   'Monday',    '05:00 PM - 06:00 PM', 20, 18, 'Cardio'],
    ['Heavy Powerlifting',   'Rijan Pokhrel', 'Tuesday',   '07:00 AM - 08:30 AM', 15, 10, 'Strength'],
    ['Zumba Cardio Dance',   'Elena Rostova', 'Wednesday', '06:00 PM - 07:00 PM', 25, 22, 'Dance'],
    ['CrossFit Endurance',   'Mark Davis',    'Thursday',  '07:00 AM - 08:00 AM', 20, 16, 'CrossFit'],
    ['Core & Spin Cycling',  'Sujata Rai',    'Friday',    '05:30 PM - 06:30 PM', 18, 15, 'Spin'],
];
$stmt = $pdo->prepare('INSERT INTO classes (title, trainer, day, time, capacity, booked, category) VALUES (?, ?, ?, ?, ?, ?, ?)');
foreach ($classes as $c) {
    $stmt->execute($c);
}

// ---- 8. Seed payments ----
$payments = [
    ['INV-1092', 'Aarav Sharma', 'Premium VIP Plan (1 Year)', 900.00, 'Credit Card', '2026-07-28', 'Paid'],
    ['INV-1091', 'Sita Gurung',  'Standard Fitness Renewal',   50.00, 'eSewa Wallet', '2026-07-25', 'Paid'],
    ['INV-1090', 'Bikash Thapa', 'Basic Access Monthly',       30.00, 'Cash',        '2026-07-20', 'Pending'],
    ['INV-1089', 'Pooja Karki',  'Standard Fitness Renewal',   50.00, 'Bank Transfer', '2026-07-15', 'Paid'],
];
$stmt = $pdo->prepare('INSERT INTO payments (invoice_no, member, plan, amount, method, payment_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
foreach ($payments as $p) {
    $stmt->execute($p);
}

// ---- 9. Seed bookings ----
$bookings = [
    [$aaravId, $alexTrainerId,    'Morning Shift (06:00 AM - 10:00 AM)', 'Focus on strength', '2026-07-28'],
    [$sitaId,  $sujataTrainerId,  'Evening Shift (05:00 PM - 09:00 PM)', '',                  '2026-07-26'],
];
$stmt = $pdo->prepare('INSERT INTO bookings (user_id, trainer_id, shift, notes, booking_date) VALUES (?, ?, ?, ?, ?)');
foreach ($bookings as $b) {
    $stmt->execute($b);
}

echo "[ok] Demo data inserted.\n";
echo "\nDone! Demo accounts:\n";
echo "  Admin   -> admin@fitpulse.com / admin123\n";
echo "  Member  -> aarav.sharma@example.com / user123\n";
echo "  Trainer -> alex.trainer@fitpulse.com / trainer123\n";
