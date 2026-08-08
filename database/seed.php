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
foreach ([
    'class_bookings', 'gym_classes', 'workout_exercises', 'workout_assignments', 'workout_plans',
    'diet_meals', 'diet_assignments', 'diet_plans', 'fitness_progress', 'attendance',
    'notifications', 'announcements', 'invoices',
    'user_gyms', 'users', 'password_resets', 'equipment', 'products', 'trainers', 'admins', 'superadmins',
] as $t) {
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

  'equipment' => '
    CREATE TABLE equipment (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      admin_id    INT NOT NULL,
      name        VARCHAR(120) NOT NULL,
      category    VARCHAR(80)  NOT NULL DEFAULT "",
      quantity    INT NOT NULL DEFAULT 1,
      description TEXT,
      status      ENUM("active","inactive") NOT NULL DEFAULT "active",
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_equipment_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
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
      member_code        VARCHAR(20)  NOT NULL UNIQUE,
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

  'attendance' => '
    CREATE TABLE attendance (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      admin_id      INT NOT NULL,
      user_id       INT NOT NULL,
      checked_in_by VARCHAR(20) NOT NULL DEFAULT "user",
      check_in_at   DATETIME NOT NULL,
      UNIQUE KEY uq_att_user_day (user_id, check_in_at),
      INDEX idx_att_admin_date (admin_id, check_in_at),
      CONSTRAINT fk_att_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      CONSTRAINT fk_att_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'fitness_progress' => '
    CREATE TABLE fitness_progress (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      user_id     INT NOT NULL,
      admin_id    INT NOT NULL,
      recorded_at DATE NOT NULL,
      weight      DECIMAL(6,2) NULL,
      body_fat    DECIMAL(5,2) NULL,
      bmi         DECIMAL(5,2) NULL,
      chest       DECIMAL(6,2) NULL,
      waist       DECIMAL(6,2) NULL,
      arms        DECIMAL(6,2) NULL,
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_prog_user_date (user_id, recorded_at),
      CONSTRAINT fk_prog_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
      CONSTRAINT fk_prog_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'workout_plans' => '
    CREATE TABLE workout_plans (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      admin_id      INT NOT NULL,
      trainer_id    INT NULL,
      title         VARCHAR(150) NOT NULL,
      description   TEXT,
      difficulty    ENUM("Beginner","Intermediate","Advanced") NOT NULL DEFAULT "Beginner",
      days_per_week INT NOT NULL DEFAULT 3,
      status        ENUM("active","inactive") NOT NULL DEFAULT "active",
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_wp_admin   FOREIGN KEY (admin_id)   REFERENCES admins(id)   ON DELETE CASCADE,
      CONSTRAINT fk_wp_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'workout_exercises' => '
    CREATE TABLE workout_exercises (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      plan_id    INT NOT NULL,
      day_label  VARCHAR(30) NOT NULL DEFAULT "",
      name       VARCHAR(150) NOT NULL,
      sets       INT NULL,
      reps       VARCHAR(50) NULL,
      rest       VARCHAR(30) NULL,
      notes      TEXT,
      sort_order INT NOT NULL DEFAULT 0,
      CONSTRAINT fk_we_plan FOREIGN KEY (plan_id) REFERENCES workout_plans(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'workout_assignments' => '
    CREATE TABLE workout_assignments (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      admin_id    INT NOT NULL,
      plan_id     INT NOT NULL,
      user_id     INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_wa_plan_user (plan_id, user_id),
      CONSTRAINT fk_wa_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      CONSTRAINT fk_wa_plan  FOREIGN KEY (plan_id)  REFERENCES workout_plans(id) ON DELETE CASCADE,
      CONSTRAINT fk_wa_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'diet_plans' => '
    CREATE TABLE diet_plans (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      admin_id        INT NOT NULL,
      trainer_id      INT NULL,
      title           VARCHAR(150) NOT NULL,
      description     TEXT,
      goal            VARCHAR(120) NOT NULL DEFAULT "",
      target_calories INT NOT NULL DEFAULT 0,
      status          ENUM("active","inactive") NOT NULL DEFAULT "active",
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_dp_admin   FOREIGN KEY (admin_id)   REFERENCES admins(id)   ON DELETE CASCADE,
      CONSTRAINT fk_dp_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'diet_meals' => '
    CREATE TABLE diet_meals (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      plan_id     INT NOT NULL,
      day_label   VARCHAR(30) NOT NULL DEFAULT "",
      meal_type   ENUM("Breakfast","Lunch","Dinner","Snack","Pre-Workout","Post-Workout") NOT NULL DEFAULT "Breakfast",
      name        VARCHAR(150) NOT NULL,
      description TEXT,
      calories    INT NOT NULL DEFAULT 0,
      protein     DECIMAL(6,2) NOT NULL DEFAULT 0,
      carbs       DECIMAL(6,2) NOT NULL DEFAULT 0,
      fat         DECIMAL(6,2) NOT NULL DEFAULT 0,
      sort_order  INT NOT NULL DEFAULT 0,
      CONSTRAINT fk_dm_plan FOREIGN KEY (plan_id) REFERENCES diet_plans(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'diet_assignments' => '
    CREATE TABLE diet_assignments (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      admin_id    INT NOT NULL,
      plan_id     INT NOT NULL,
      user_id     INT NOT NULL,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_da_plan_user (plan_id, user_id),
      CONSTRAINT fk_da_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      CONSTRAINT fk_da_plan  FOREIGN KEY (plan_id)  REFERENCES diet_plans(id) ON DELETE CASCADE,
      CONSTRAINT fk_da_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'gym_classes' => '
    CREATE TABLE gym_classes (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      admin_id    INT NOT NULL,
      trainer_id  INT NULL,
      name        VARCHAR(150) NOT NULL,
      description TEXT,
      day_of_week VARCHAR(15) NOT NULL DEFAULT "Monday",
      start_time  TIME NOT NULL,
      end_time    TIME NOT NULL,
      location    VARCHAR(120) NOT NULL DEFAULT "",
      capacity    INT NOT NULL DEFAULT 15,
      status      ENUM("active","inactive") NOT NULL DEFAULT "active",
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_gc_admin   FOREIGN KEY (admin_id)   REFERENCES admins(id)   ON DELETE CASCADE,
      CONSTRAINT fk_gc_trainer FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'class_bookings' => '
    CREATE TABLE class_bookings (
      id        INT AUTO_INCREMENT PRIMARY KEY,
      class_id  INT NOT NULL,
      user_id   INT NOT NULL,
      status    ENUM("booked","cancelled") NOT NULL DEFAULT "booked",
      booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_cb_class_user (class_id, user_id),
      CONSTRAINT fk_cb_class FOREIGN KEY (class_id) REFERENCES gym_classes(id) ON DELETE CASCADE,
      CONSTRAINT fk_cb_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'invoices' => '
    CREATE TABLE invoices (
      id             INT AUTO_INCREMENT PRIMARY KEY,
      admin_id       INT NOT NULL,
      user_id        INT NOT NULL,
      invoice_no     VARCHAR(40) NOT NULL UNIQUE,
      title          VARCHAR(150) NOT NULL,
      description    TEXT,
      amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
      paid_amount    DECIMAL(12,2) NOT NULL DEFAULT 0,
      status         ENUM("unpaid","partial","paid","cancelled") NOT NULL DEFAULT "unpaid",
      due_date       DATE NULL,
      paid_at        DATETIME NULL,
      payment_method VARCHAR(40) NOT NULL DEFAULT "",
      created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_inv_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
      CONSTRAINT fk_inv_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'announcements' => '
    CREATE TABLE announcements (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      admin_id   INT NOT NULL,
      title      VARCHAR(200) NOT NULL,
      body       TEXT,
      priority   ENUM("normal","important","urgent") NOT NULL DEFAULT "normal",
      status     ENUM("active","inactive") NOT NULL DEFAULT "active",
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_ann_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4',

  'notifications' => '
    CREATE TABLE notifications (
      id         INT AUTO_INCREMENT PRIMARY KEY,
      user_id    INT NOT NULL,
      admin_id   INT NULL,
      type       VARCHAR(40) NOT NULL DEFAULT "info",
      title      VARCHAR(200) NOT NULL,
      body       TEXT,
      is_read    TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_notif_user (user_id, is_read),
      CONSTRAINT fk_notif_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
      CONSTRAINT fk_notif_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
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

// ---- 8. Seed equipment for each gym ----
$stmt = $pdo->prepare('INSERT INTO equipment (admin_id, name, category, quantity, description, status) VALUES (?, ?, ?, ?, ?, ?)');
$equipment = [
    [$peakId, 'Treadmill - Pro Runner',  'Cardio',       12, 'Motorized treadmill with incline, heart-rate grips and tablet stand.', 'active'],
    [$peakId, 'Smith Machine',           'Strength',      2, 'Fixed-path barbell rack with safety stops.',                          'active'],
    [$peakId, 'Adjustable Dumbbell Set', 'Strength',     20, 'Dumbbells from 2.5kg to 32.5kg with rack.',                           'active'],
    [$peakId, 'Rowing Machine',          'Cardio',        6, 'Air-resistance rower for full-body conditioning.',                    'active'],
    [$peakId, 'Yoga Mats',               'Flexibility',  25, 'High-density mats for stretching and group classes.',                 'active'],
    [$ironId, 'CrossFit Rig',            'Functional',    1, 'Multi-station rig for pull-ups, muscle-ups and ring work.',            'active'],
    [$ironId, 'Barbells & Bumper Plates','Functional',   18, 'Olympic barbells with competition bumper plates.',                    'active'],
    [$ironId, 'Sled Push Track',         'Functional',    2, 'Heavy sleds on a dedicated turf track.',                              'active'],
    [$ironId, 'Ski Ergometer',           'Cardio',        4, 'Full-body ski trainer for endurance and power.',                      'active'],
];
foreach ($equipment as $e) {
    $stmt->execute($e);
}

// ---- 9. Seed users (demo users are already email-verified) ----
$aaravId = seed_user($pdo, $peakId, 'Aarav Sharma', 'aarav.sharma@example.com', 'user123', '+977 9841234567', 'Muscle Hypertrophy');
$sitaId  = seed_user($pdo, $ironId, 'Sita Gurung',  'sita.g@example.com',       'user123', '+977 9801987654', 'Weight Loss & Cardio');
$guestId = seed_user($pdo, null,    'Rohan Adhikari', 'rohan.a@example.com',    'user123', '+977 9860998877', 'General Fitness');

function seed_user(PDO $pdo, ?int $adminId, string $name, string $email, string $plain, string $phone, ?string $goal): int
{
    $code = 'FP-' . strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
    $stmt = $pdo->prepare('INSERT INTO users (admin_id, name, email, password, phone, goal, member_code, email_verified_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())');
    $stmt->execute([$adminId, $name, $email, password_hash($plain, PASSWORD_BCRYPT), $phone, $goal, $code]);
    return (int)$pdo->lastInsertId();
}

// ---- 10. Seed user <-> gym selections ----
$stmt = $pdo->prepare('INSERT IGNORE INTO user_gyms (user_id, admin_id) VALUES (?, ?)');
$stmt->execute([$aaravId, $peakId]);
$stmt->execute([$sitaId, $ironId]);
$stmt->execute([$guestId, $peakId]);
$stmt->execute([$guestId, $ironId]);

// ---- 11. Seed attendance (last 6 days, Peak Fitness) ----
$stmt = $pdo->prepare('INSERT IGNORE INTO attendance (admin_id, user_id, checked_in_by, check_in_at) VALUES (?, ?, ?, ?)');
for ($i = 1; $i <= 6; $i++) {
    $stmt->execute([$peakId, $aaravId, 'user', date('Y-m-d H:i:s', strtotime("-{$i} days 08:30"))]);
}
$stmt->execute([$peakId, $guestId, 'code', date('Y-m-d H:i:s', strtotime('-1 days 17:45'))]);

// ---- 12. Seed fitness progress (weekly weight/measurement logs) ----
$stmt = $pdo->prepare('INSERT INTO fitness_progress (user_id, admin_id, recorded_at, weight, body_fat, bmi, chest, waist, arms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
$weeks = [
    ['2026-07-06', 82.5, 18.5, 25.9, 102.0, 88.0, 38.5],
    ['2026-07-13', 81.8, 18.1, 25.7, 102.5, 87.2, 38.8],
    ['2026-07-20', 81.2, 17.8, 25.5, 103.0, 86.5, 39.0],
    ['2026-07-27', 80.6, 17.4, 25.3, 103.5, 86.0, 39.2],
    ['2026-08-03', 80.1, 17.1, 25.1, 104.0, 85.2, 39.5],
];
foreach ($weeks as $w) {
    $stmt->execute([$aaravId, $peakId, $w[0], $w[1], $w[2], $w[3], $w[4], $w[5], $w[6]]);
}

// ---- 13. Seed workout plans + exercises + assignments ----
$stmt = $pdo->prepare('INSERT INTO workout_plans (admin_id, trainer_id, title, description, difficulty, days_per_week, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$peakId, null, 'Hypertrophy Split', '4-day upper/lower split focused on muscle growth.', 'Intermediate', 4, 'active']);
$hypertrophyId = (int)$pdo->lastInsertId();
$stmt->execute([$peakId, null, 'Beginner Full Body', 'Simple 3-day full body routine for new members.', 'Beginner', 3, 'active']);
$beginnerId = (int)$pdo->lastInsertId();

$stmt = $pdo->prepare('INSERT INTO workout_exercises (plan_id, day_label, name, sets, reps, rest, notes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
$exercises = [
    [$hypertrophyId, 'Day 1 - Push', 'Bench Press', 4, '8-10', '90s', '', 1],
    [$hypertrophyId, 'Day 1 - Push', 'Incline Dumbbell Press', 3, '10-12', '90s', '', 2],
    [$hypertrophyId, 'Day 1 - Push', 'Overhead Press', 3, '8-10', '90s', '', 3],
    [$hypertrophyId, 'Day 1 - Push', 'Lateral Raises', 4, '12-15', '60s', '', 4],
    [$hypertrophyId, 'Day 1 - Push', 'Tricep Pushdowns', 3, '12-15', '60s', '', 5],
    [$hypertrophyId, 'Day 2 - Pull', 'Deadlift', 4, '6-8', '2m', '', 1],
    [$hypertrophyId, 'Day 2 - Pull', 'Lat Pulldowns', 4, '10-12', '90s', '', 2],
    [$hypertrophyId, 'Day 2 - Pull', 'Seated Rows', 3, '10-12', '90s', '', 3],
    [$hypertrophyId, 'Day 2 - Pull', 'Barbell Curls', 3, '10-12', '60s', '', 4],
    [$beginnerId, 'Day 1', 'Squats', 3, '10-12', '90s', 'Bodyweight to start', 1],
    [$beginnerId, 'Day 1', 'Push-ups', 3, 'AMRAP', '90s', '', 2],
    [$beginnerId, 'Day 1', 'Lat Pulldowns', 3, '10-12', '90s', '', 3],
    [$beginnerId, 'Day 2', 'Lunges', 3, '10/leg', '90s', '', 1],
    [$beginnerId, 'Day 2', 'Seated Rows', 3, '10-12', '90s', '', 2],
    [$beginnerId, 'Day 2', 'Shoulder Press', 3, '10-12', '90s', '', 3],
    [$beginnerId, 'Day 3', 'Plank', 3, '30-60s', '60s', '', 1],
    [$beginnerId, 'Day 3', 'Goblet Squats', 3, '10-12', '90s', '', 2],
    [$beginnerId, 'Day 3', 'Cable Rows', 3, '10-12', '90s', '', 3],
];
foreach ($exercises as $e) {
    $stmt->execute($e);
}

$stmt = $pdo->prepare('INSERT IGNORE INTO workout_assignments (admin_id, plan_id, user_id) VALUES (?, ?, ?)');
$stmt->execute([$peakId, $hypertrophyId, $aaravId]);
$stmt->execute([$peakId, $beginnerId, $guestId]);

// ---- 14. Seed diet plans + meals + assignments ----
$stmt = $pdo->prepare('INSERT INTO diet_plans (admin_id, trainer_id, title, description, goal, target_calories, status) VALUES (?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$peakId, null, 'Lean Muscle Builder', 'High protein plan designed for muscle gain with minimal fat.', 'Muscle Hypertrophy', 2800, 'active']);
$muscleDietId = (int)$pdo->lastInsertId();
$stmt->execute([$peakId, null, 'Fat Loss Starter', 'Calorie-controlled meals for steady, sustainable weight loss.', 'Weight Loss & Cardio', 1900, 'active']);
$fatDietId = (int)$pdo->lastInsertId();

$stmt = $pdo->prepare('INSERT INTO diet_meals (plan_id, day_label, meal_type, name, description, calories, protein, carbs, fat, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$meals = [
    [$muscleDietId, 'All Days', 'Breakfast', 'Oats + Whey + Banana', 'Rolled oats with whey protein and sliced banana.', 520, 34, 70, 10, 1],
    [$muscleDietId, 'All Days', 'Lunch', 'Chicken Rice Bowl', 'Grilled chicken breast with brown rice and vegetables.', 680, 52, 72, 12, 2],
    [$muscleDietId, 'All Days', 'Snack', 'Greek Yogurt & Nuts', 'Greek yogurt with almonds and honey.', 320, 22, 28, 14, 3],
    [$muscleDietId, 'All Days', 'Dinner', 'Salmon + Sweet Potato', 'Baked salmon with roasted sweet potato and salad.', 620, 45, 48, 22, 4],
    [$fatDietId, 'All Days', 'Breakfast', 'Egg White Omelette', 'Egg white omelette with spinach and whole-wheat toast.', 340, 30, 24, 8, 1],
    [$fatDietId, 'All Days', 'Lunch', 'Grilled Chicken Salad', 'Large salad with grilled chicken and light vinaigrette.', 430, 40, 18, 16, 2],
    [$fatDietId, 'All Days', 'Dinner', 'Paneer & Veggies', 'Low-fat paneer stir fry with mixed vegetables.', 410, 32, 22, 18, 3],
];
foreach ($meals as $m) {
    $stmt->execute($m);
}

$stmt = $pdo->prepare('INSERT IGNORE INTO diet_assignments (admin_id, plan_id, user_id) VALUES (?, ?, ?)');
$stmt->execute([$peakId, $muscleDietId, $aaravId]);
$stmt->execute([$peakId, $fatDietId, $guestId]);

// ---- 15. Seed gym classes + bookings (Peak Fitness) ----
$stmt = $pdo->prepare('INSERT INTO gym_classes (admin_id, trainer_id, name, description, day_of_week, start_time, end_time, location, capacity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$classes = [
    [$peakId, null, 'Morning HIIT', 'High intensity interval training to burn fat fast.', 'Monday', '06:30', '07:15', 'Main Floor', 20, 'active'],
    [$peakId, null, 'Yoga Flow', 'Vinyasa flow class for flexibility and core strength.', 'Tuesday', '18:00', '19:00', 'Studio 1', 15, 'active'],
    [$peakId, null, 'Spin & Sweat', 'Indoor cycling endurance ride with music.', 'Thursday', '06:30', '07:15', 'Cycle Studio', 18, 'active'],
    [$peakId, null, 'Weekend Bootcamp', 'Full-body outdoor strength bootcamp.', 'Saturday', '07:00', '08:30', 'Turf', 25, 'active'],
];
foreach ($classes as $c) {
    $stmt->execute($c);
}
$hiitId = (int)$pdo->lastInsertId() - 3;
$yogaId = $hiitId + 1;

$stmt = $pdo->prepare('INSERT IGNORE INTO class_bookings (class_id, user_id, status) VALUES (?, ?, "booked")');
$stmt->execute([$hiitId, $aaravId]);
$stmt->execute([$yogaId, $aaravId]);
$stmt->execute([$hiitId, $guestId]);

// ---- 16. Seed invoices (member billing) ----
$stmt = $pdo->prepare('INSERT INTO invoices (admin_id, user_id, invoice_no, title, description, amount, paid_amount, status, due_date, paid_at, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
$stmt->execute([$peakId, $aaravId, 'INV-2026-0001', 'Monthly Membership - July', 'Full floor access + 1 group class/week.', 2500, 2500, 'paid', '2026-07-31', '2026-07-01 10:00:00', 'eSewa']);
$stmt->execute([$peakId, $aaravId, 'INV-2026-0002', 'Monthly Membership - August', 'Full floor access + 1 group class/week.', 2500, 0, 'unpaid', '2026-08-31', null, '']);
$stmt->execute([$peakId, $guestId, 'INV-2026-0003', 'PT Session Pack (x4)', '4 x 1-on-1 personal training sessions.', 4800, 2400, 'partial', '2026-08-15', null, 'Khalti']);

// ---- 17. Seed announcements + notifications ----
$stmt = $pdo->prepare('INSERT INTO announcements (admin_id, title, body, priority, status) VALUES (?, ?, ?, ?, "active")');
$stmt->execute([$peakId, 'New Cardio Zone Opening', 'Our new 12-station cardio zone opens next Monday. Free demo all week!', 'important']);
$stmt->execute([$peakId, 'Scheduled Maintenance', 'Sauna and steam will be under maintenance on Sunday 6:00-12:00.', 'normal']);

$stmt = $pdo->prepare('INSERT INTO notifications (user_id, admin_id, type, title, body, is_read) VALUES (?, ?, ?, ?, ?, ?)');
$stmt->execute([$aaravId, $peakId, 'announcement', 'New Cardio Zone Opening', 'Our new 12-station cardio zone opens next Monday.', 0]);
$stmt->execute([$aaravId, $peakId, 'invoice', 'Invoice INV-2026-0002 due', 'Your August membership invoice of NPR 2,500 is due on 2026-08-31.', 0]);
$stmt->execute([$aaravId, $peakId, 'class', 'Class booked', 'You are booked for Morning HIIT on Monday at 06:30.', 1]);
$stmt->execute([$guestId, $peakId, 'announcement', 'Scheduled Maintenance', 'Sauna and steam closed Sunday 6:00-12:00.', 0]);

echo "[ok] Demo data inserted.\n";
echo "\nDone! Demo accounts:\n";
echo "  Superadmin -> rijanpokhrel@superadmin.com / Rijan@123\n";
echo "  Admin      -> admin@peakfitness.com / Admin@123\n";
echo "  Admin      -> admin@ironcore.com / Admin@123\n";
echo "  Trainer    -> alex@peakfitness.com / Trainer@123\n";
echo "  User       -> aarav.sharma@example.com / user123\n";
