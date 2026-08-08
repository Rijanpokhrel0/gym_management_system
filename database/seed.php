<?php
/**
 * ==========================================================================
 * FITPULSE MULTI-ADMIN GYM MANAGEMENT SYSTEM - DATABASE SETUP & SEEDER
 * ==========================================================================
 * Creates the `fitpulse` database, all tables and demo data.
 *
 * HOW TO RUN (from the project root):
 *   php database/seed.php
 *
 * Idempotent: re-running resets the database.
 * ==========================================================================
 */

declare(strict_types=1);

require_once __DIR__ . '/../config/init.php';

echo "== FitPulse Multi-Admin Database Setup ==\n";

// ---- 1. Create database if missing ----
db(null)->exec('CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
echo "[ok] Database '" . DB_NAME . "' ready.\n";

$pdo = db();

// ---- 2. Reset tables ----
$pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
foreach (['user_gyms', 'users', 'password_resets', 'products', 'trainers', 'admins', 'superadmins'] as $t) {
    $pdo->exec("DROP TABLE IF EXISTS `$t`");
}
$pdo->exec('SET FOREIGN_KEY_CHECKS = 1');

// ---- 3. Create tables ----
$tables = [
  'superadmins' => '
    CREATE TABLE superadmins (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      name       VARCHAR(100) NOT NULL,
      email      VARCHAR(150) NOT NULL UNIQUE,
      password   VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'admins' => '
    CREATE TABLE admins (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      name        VARCHAR(100) NOT NULL,
      email       VARCHAR(150) NOT NULL UNIQUE,
      password    VARCHAR(255) NOT NULL,
      gym_name    VARCHAR(120) NOT NULL DEFAULT "",
      phone       VARCHAR(40)  NOT NULL DEFAULT "",
      address     VARCHAR(255) NOT NULL DEFAULT "",
      logo_url    VARCHAR(500) NOT NULL DEFAULT "",
      description TEXT,
      status      ENUM("active","suspended") NOT NULL DEFAULT "active",
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'trainers' => '
    CREATE TABLE trainers (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      admin_id       INT NOT NULL,
      name           VARCHAR(120) NOT NULL,
      email          VARCHAR(150) NOT NULL UNIQUE,
      password       VARCHAR(255) NOT NULL,
      specialization VARCHAR(120) NOT NULL DEFAULT "",
      experience     INT NOT NULL DEFAULT 0,
      phone          VARCHAR(40)  NOT NULL DEFAULT "",
      certifications TEXT,
      salary         DECIMAL(10,2) NOT NULL DEFAULT 0,
      status         ENUM("active","inactive") NOT NULL DEFAULT "active",
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_trainers_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'products' => '
    CREATE TABLE products (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      admin_id    INT NOT NULL,
      name        VARCHAR(120) NOT NULL,
      category    ENUM("Supplement","Merchandise","Membership","Service") NOT NULL DEFAULT "Supplement",
      price       DECIMAL(10,2) NOT NULL DEFAULT 0,
      stock       INT NOT NULL DEFAULT 0,
      description TEXT,
      image_url   VARCHAR(500) NOT NULL DEFAULT "",
      status      ENUM("active","inactive") NOT NULL DEFAULT "active",
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_products_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'users' => '
    CREATE TABLE users (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      admin_id           INT DEFAULT NULL,
      name               VARCHAR(100) NOT NULL,
      email              VARCHAR(150) NOT NULL UNIQUE,
      password           VARCHAR(255) NOT NULL,
      phone              VARCHAR(40)  NOT NULL DEFAULT "",
      goal               VARCHAR(120) DEFAULT NULL,
      verification_token VARCHAR(64)  DEFAULT NULL,
      verification_sent_at DATETIME   DEFAULT NULL,
      email_verified_at  DATETIME     DEFAULT NULL,
      created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_users_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'password_resets' => '
    CREATE TABLE password_resets (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      email      VARCHAR(150) NOT NULL,
      token_hash VARCHAR(64)  NOT NULL,
      expires_at DATETIME     NOT NULL,
      used_at    DATETIME     DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_pr_email (email),
      INDEX idx_pr_token (token_hash)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'user_gyms' => '
    CREATE TABLE user_gyms (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      admin_id    INT NOT NULL,
      selected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_gym (user_id, admin_id),
      CONSTRAINT fk_ug_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
      CONSTRAINT fk_ug_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',
];
foreach ($tables as $name => $sql) {
    $pdo->exec($sql);
}
echo "[ok] Tables created.\n";

// ---- 4. Seed superadmin (fixed credentials) ----
$stmt = $pdo->prepare('INSERT INTO superadmins (name, email, password) VALUES (?, ?, ?)');
$stmt->execute(['Super Administrator', 'rijanpokhrel@superadmin.com', password_hash('Rijan@123', PASSWORD_BCRYPT)]);

// ---- 5. Seed admins (gym owners) ----
function seed_admin(PDO $pdo, string $name, string $email, string $plain, string $gym, string $phone, string $address, string $logo, string $desc): int
{
    $stmt = $pdo->prepare('INSERT INTO admins (name, email, password, gym_name, phone, address, logo_url, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    $stmt->execute([$name, $email, password_hash($plain, PASSWORD_BCRYPT), $gym, $phone, $address, $logo, $desc]);
    return (int)$pdo->lastInsertId();
}

$peakId = seed_admin($pdo, 'Rijan Pokhrel', 'admin@peakfitness.com', 'Admin@123',
    'Peak Fitness Club', '+977 9800000001', 'Baneshwor, Kathmandu',
    'https://i.imgur.com/r0P3kQk.png',
    'A modern strength & cardio facility with certified trainers and a supplement store.');
$ironId = seed_admin($pdo, 'Sita Gurung', 'admin@ironcore.com', 'Admin@123',
    'IronCore Gym', '+977 9800000002', 'Maitighar, Kathmandu',
    'https://i.imgur.com/8YvYxqx.png',
    'CrossFit box with functional training zones, coaching and merch.');

// ---- 6. Seed trainers (with own login accounts, scoped to gyms) ----
$stmt = $pdo->prepare('INSERT INTO trainers (admin_id, name, email, password, specialization, experience, phone, certifications, salary, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$trainers = [
    [$peakId, 'Alex Morgan',   'alex@peakfitness.com', 'Trainer@123', 'Strength & Conditioning', 5, '+977 9811112222', 'ACE-CPT, Powerlifting L1', 45000, 'active'],
    [$peakId, 'Sujata Rai',    'sujata@peakfitness.com','Trainer@123', 'Yoga & Mobility',         8, '+977 9822223333', 'RYT-500',                 40000, 'active'],
    [$ironId, 'Mark Davis',    'mark@ironcore.com',    'Trainer@123', 'CrossFit & Endurance',    6, '+977 9833334444', 'CrossFit L2',             42000, 'active'],
    [$ironId, 'Elena Rostova', 'elena@ironcore.com',   'Trainer@123', 'Zumba & Cardio Dance',   4, '+977 9844445555', 'Zumba ZIN',               38000, 'active'],
];
foreach ($trainers as $t) {
    $t[3] = password_hash($t[3], PASSWORD_BCRYPT);
    $stmt->execute($t);
}

// ---- 7. Seed products for Peak Fitness (supplements / merch / memberships / services) ----
$stmt = $pdo->prepare('INSERT INTO products (admin_id, name, category, price, stock, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
$products = [
    [$peakId, 'Whey Protein Isolate 1kg',  'Supplement',  4200, 20,  'Double chocolate, 27g protein per scoop.', 'active'],
    [$peakId, 'Creatine Monohydrate 300g', 'Supplement',  1800, 15,  'Micronized creatine for strength gains.',   'active'],
    [$peakId, 'Pre-Workout 250g',          'Supplement',  2400, 12,  'Caffeine + beta-alanine energy blend.',    'active'],
    [$peakId, 'Peak Fitness T-Shirt',      'Merchandise',  900, 30,  'Cotton gym tee, sizes S-XXL.',             'active'],
    [$peakId, 'Gym Water Bottle 1L',      'Merchandise',  450, 40,  'BPA-free steel bottle with logo.',         'active'],
    [$peakId, 'Monthly Membership',        'Membership',  2500, 999, 'Full floor access + 1 group class/week.',  'active'],
    [$peakId, 'Personal Training Session', 'Service',     1200, 999, '1-on-1 PT session with certified coach.',  'active'],
];
foreach ($products as $p) {
    $stmt->execute($p);
}

// ---- 8. Seed users (demo users are already email-verified) ----
$aaravId = seed_user($pdo, $peakId, 'Aarav Sharma', 'aarav.sharma@example.com', 'user123', '+977 9841234567', 'Muscle Hypertrophy');
$sitaId  = seed_user($pdo, $ironId, 'Sita Gurung',  'sita.g@example.com',       'user123', '+977 9801987654', 'Weight Loss & Cardio');
$guestId = seed_user($pdo, null,    'Rohan Adhikari', 'rohan.a@example.com',    'user123', '+977 9860998877', 'General Fitness');

function seed_user(PDO $pdo, ?int $adminId, string $name, string $email, string $plain, string $phone, ?string $goal): int
{
    $stmt = $pdo->prepare('INSERT INTO users (admin_id, name, email, password, phone, goal, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, NOW())');
    $stmt->execute([$adminId, $name, $email, password_hash($plain, PASSWORD_BCRYPT), $phone, $goal]);
    return (int)$pdo->lastInsertId();
}

// ---- 9. Seed user <-> gym selections ----
$stmt = $pdo->prepare('INSERT IGNORE INTO user_gyms (user_id, admin_id) VALUES (?, ?)');
$stmt->execute([$aaravId, $peakId]);
$stmt->execute([$sitaId, $ironId]);
$stmt->execute([$guestId, $peakId]);
$stmt->execute([$guestId, $ironId]);

echo "[ok] Demo data inserted.\n";
echo "\nDone! Demo accounts:\n";
echo "  Superadmin -> rijanpokhrel@superadmin.com / Rijan@123\n";
echo "  Admin      -> admin@peakfitness.com / Admin@123\n";
echo "  Admin      -> admin@ironcore.com / Admin@123\n";
echo "  Trainer    -> alex@peakfitness.com / Trainer@123\n";
echo "  User       -> aarav.sharma@example.com / user123\n";
