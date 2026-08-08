-- ============================================================================
-- FITPULSE MULTI-ADMIN GYM MANAGEMENT SYSTEM - MySQL SCHEMA
-- ============================================================================
-- Four portals: Superadmin, Admin, Trainer, User.
-- EASIEST SETUP: run `php database/seed.php` instead (creates DB, tables AND
-- demo data automatically). This file is a reference for manual phpMyAdmin import.
--
-- Data isolation: every admin-owned row carries an `admin_id`. Admin API
-- endpoints filter by the signed-in admin, so each admin sees only their own
-- gyms, products, users and trainers. The superadmin portal sees everything.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `fitpulse`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `fitpulse`;

-- ---------------------------------------------------------------------------
-- Superadmin account(s). Seeded with the fixed superadmin credentials.
-- ---------------------------------------------------------------------------
CREATE TABLE `superadmins` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(100) NOT NULL,
  `email`      VARCHAR(150) NOT NULL UNIQUE,
  `password`   VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Admins = independent gym owners. Created & managed by the superadmin.
-- ---------------------------------------------------------------------------
CREATE TABLE `admins` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(100) NOT NULL,
  `email`       VARCHAR(150) NOT NULL UNIQUE,
  `password`    VARCHAR(255) NOT NULL,
  `gym_name`    VARCHAR(120) NOT NULL DEFAULT '',
  `phone`       VARCHAR(40)  NOT NULL DEFAULT '',
  `address`     VARCHAR(255) NOT NULL DEFAULT '',
  `logo_url`    VARCHAR(500) NOT NULL DEFAULT '',
  `description` TEXT,
  `status`      ENUM('active','suspended') NOT NULL DEFAULT 'active',
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Trainers belong to an admin's gym and get their own login/portal.
-- ---------------------------------------------------------------------------
CREATE TABLE `trainers` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`       INT NOT NULL,
  `name`           VARCHAR(120) NOT NULL,
  `email`          VARCHAR(150) NOT NULL UNIQUE,
  `password`       VARCHAR(255) NOT NULL,
  `specialization` VARCHAR(120) NOT NULL DEFAULT '',
  `experience`     INT NOT NULL DEFAULT 0,
  `phone`          VARCHAR(40)  NOT NULL DEFAULT '',
  `certifications` TEXT,
  `salary`         DECIMAL(10,2) NOT NULL DEFAULT 0,
  `status`         ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_trainers_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Products = supplements / merchandise / memberships / services sold by a gym.
-- An admin may only manage products while their subscription is active.
-- ---------------------------------------------------------------------------
CREATE TABLE `products` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`    INT NOT NULL,
  `name`        VARCHAR(120) NOT NULL,
  `category`    ENUM('Supplement','Merchandise','Membership','Service') NOT NULL DEFAULT 'Supplement',
  `price`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `stock`       INT NOT NULL DEFAULT 0,
  `description` TEXT,
  `image_url`   VARCHAR(500) NOT NULL DEFAULT '',
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_products_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Equipment = gym machines / tools managed by a gym admin and visible to users.
-- ---------------------------------------------------------------------------
CREATE TABLE `equipment` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`    INT NOT NULL,
  `name`        VARCHAR(120) NOT NULL,
  `category`    VARCHAR(80)  NOT NULL DEFAULT '',
  `quantity`    INT NOT NULL DEFAULT 1,
  `description` TEXT,
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_equipment_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Users = gym members. May be self-registered or created by an admin.
-- ---------------------------------------------------------------------------
CREATE TABLE `users` (
  `id`                  INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`            INT DEFAULT NULL,
  `name`                VARCHAR(100) NOT NULL,
  `email`               VARCHAR(150) NOT NULL UNIQUE,
  `password`            VARCHAR(255) NOT NULL,
  `phone`               VARCHAR(40)  NOT NULL DEFAULT '',
  `goal`                VARCHAR(120) DEFAULT NULL,
  `member_code`         VARCHAR(20)  NOT NULL UNIQUE,
  `verification_token`  VARCHAR(64)  DEFAULT NULL,
  `verification_sent_at` DATETIME    DEFAULT NULL,
  `email_verified_at`   DATETIME     DEFAULT NULL,
  `created_at`          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_users_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Password reset tokens (sent by email, single-use, short-lived).
-- ---------------------------------------------------------------------------
CREATE TABLE `password_resets` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `email`      VARCHAR(150) NOT NULL,
  `token_hash` VARCHAR(64)  NOT NULL,
  `expires_at` DATETIME     NOT NULL,
  `used_at`    DATETIME     DEFAULT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_pr_email` (`email`),
  INDEX `idx_pr_token` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- User <-> gym selections (a user can follow/select multiple gyms).
-- ---------------------------------------------------------------------------
CREATE TABLE `user_gyms` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL,
  `admin_id`    INT NOT NULL,
  `selected_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_user_gym` (`user_id`, `admin_id`),
  CONSTRAINT `fk_ug_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_ug_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Attendance / member check-ins. One check-in per user per day (unique on the
-- exact check_in_at datetime is enforced in code to avoid double check-ins).
-- ---------------------------------------------------------------------------
CREATE TABLE `attendance` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`      INT NOT NULL,
  `user_id`       INT NOT NULL,
  `checked_in_by` VARCHAR(20) NOT NULL DEFAULT 'user',
  `check_in_at`   DATETIME NOT NULL,
  UNIQUE KEY `uq_att_user_day` (`user_id`, `check_in_at`),
  INDEX `idx_att_admin_date` (`admin_id`, `check_in_at`),
  CONSTRAINT `fk_att_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_att_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Fitness progress: weekly (or ad-hoc) weight / body-fat / measurement logs.
-- ---------------------------------------------------------------------------
CREATE TABLE `fitness_progress` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT NOT NULL,
  `admin_id`    INT NOT NULL,
  `recorded_at` DATE NOT NULL,
  `weight`      DECIMAL(6,2) NULL,
  `body_fat`    DECIMAL(5,2) NULL,
  `bmi`         DECIMAL(5,2) NULL,
  `chest`       DECIMAL(6,2) NULL,
  `waist`       DECIMAL(6,2) NULL,
  `arms`        DECIMAL(6,2) NULL,
  `notes`       TEXT,
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_prog_user_date` (`user_id`, `recorded_at`),
  CONSTRAINT `fk_prog_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_prog_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Workout plans (created by admin/trainer) + exercises + member assignments.
-- ---------------------------------------------------------------------------
CREATE TABLE `workout_plans` (
  `id`            INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`      INT NOT NULL,
  `trainer_id`    INT NULL,
  `title`         VARCHAR(150) NOT NULL,
  `description`   TEXT,
  `difficulty`    ENUM('Beginner','Intermediate','Advanced') NOT NULL DEFAULT 'Beginner',
  `days_per_week` INT NOT NULL DEFAULT 3,
  `status`        ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_wp_admin`   FOREIGN KEY (`admin_id`)   REFERENCES `admins`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_wp_trainer` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `workout_exercises` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id`    INT NOT NULL,
  `day_label`  VARCHAR(30) NOT NULL DEFAULT '',
  `name`       VARCHAR(150) NOT NULL,
  `sets`       INT NULL,
  `reps`       VARCHAR(50) NULL,
  `rest`       VARCHAR(30) NULL,
  `notes`      TEXT,
  `sort_order` INT NOT NULL DEFAULT 0,
  CONSTRAINT `fk_we_plan` FOREIGN KEY (`plan_id`) REFERENCES `workout_plans`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `workout_assignments` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`    INT NOT NULL,
  `plan_id`     INT NOT NULL,
  `user_id`     INT NOT NULL,
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_wa_plan_user` (`plan_id`, `user_id`),
  CONSTRAINT `fk_wa_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wa_plan`  FOREIGN KEY (`plan_id`)  REFERENCES `workout_plans`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_wa_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Diet / nutrition plans + meals + member assignments.
-- ---------------------------------------------------------------------------
CREATE TABLE `diet_plans` (
  `id`              INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`        INT NOT NULL,
  `trainer_id`      INT NULL,
  `title`           VARCHAR(150) NOT NULL,
  `description`     TEXT,
  `goal`            VARCHAR(120) NOT NULL DEFAULT '',
  `target_calories` INT NOT NULL DEFAULT 0,
  `status`          ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_dp_admin`   FOREIGN KEY (`admin_id`)   REFERENCES `admins`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_dp_trainer` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `diet_meals` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `plan_id`     INT NOT NULL,
  `day_label`   VARCHAR(30) NOT NULL DEFAULT '',
  `meal_type`   ENUM('Breakfast','Lunch','Dinner','Snack','Pre-Workout','Post-Workout') NOT NULL DEFAULT 'Breakfast',
  `name`        VARCHAR(150) NOT NULL,
  `description` TEXT,
  `calories`    INT NOT NULL DEFAULT 0,
  `protein`     DECIMAL(6,2) NOT NULL DEFAULT 0,
  `carbs`       DECIMAL(6,2) NOT NULL DEFAULT 0,
  `fat`         DECIMAL(6,2) NOT NULL DEFAULT 0,
  `sort_order`  INT NOT NULL DEFAULT 0,
  CONSTRAINT `fk_dm_plan` FOREIGN KEY (`plan_id`) REFERENCES `diet_plans`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `diet_assignments` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`    INT NOT NULL,
  `plan_id`     INT NOT NULL,
  `user_id`     INT NOT NULL,
  `assigned_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_da_plan_user` (`plan_id`, `user_id`),
  CONSTRAINT `fk_da_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_da_plan`  FOREIGN KEY (`plan_id`)  REFERENCES `diet_plans`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_da_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Group classes / sessions + member bookings.
-- ---------------------------------------------------------------------------
CREATE TABLE `gym_classes` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`    INT NOT NULL,
  `trainer_id`  INT NULL,
  `name`        VARCHAR(150) NOT NULL,
  `description` TEXT,
  `day_of_week` VARCHAR(15) NOT NULL DEFAULT 'Monday',
  `start_time`  TIME NOT NULL,
  `end_time`    TIME NOT NULL,
  `location`    VARCHAR(120) NOT NULL DEFAULT '',
  `capacity`    INT NOT NULL DEFAULT 15,
  `status`      ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at`  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_gc_admin`   FOREIGN KEY (`admin_id`)   REFERENCES `admins`(`id`)   ON DELETE CASCADE,
  CONSTRAINT `fk_gc_trainer` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `class_bookings` (
  `id`        INT AUTO_INCREMENT PRIMARY KEY,
  `class_id`  INT NOT NULL,
  `user_id`   INT NOT NULL,
  `status`    ENUM('booked','cancelled') NOT NULL DEFAULT 'booked',
  `booked_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_cb_class_user` (`class_id`, `user_id`),
  CONSTRAINT `fk_cb_class` FOREIGN KEY (`class_id`) REFERENCES `gym_classes`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_cb_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Member billing / invoices.
-- ---------------------------------------------------------------------------
CREATE TABLE `invoices` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`       INT NOT NULL,
  `user_id`        INT NOT NULL,
  `invoice_no`     VARCHAR(40) NOT NULL UNIQUE,
  `title`          VARCHAR(150) NOT NULL,
  `description`    TEXT,
  `amount`         DECIMAL(12,2) NOT NULL DEFAULT 0,
  `paid_amount`    DECIMAL(12,2) NOT NULL DEFAULT 0,
  `status`         ENUM('unpaid','partial','paid','cancelled') NOT NULL DEFAULT 'unpaid',
  `due_date`       DATE NULL,
  `paid_at`        DATETIME NULL,
  `payment_method` VARCHAR(40) NOT NULL DEFAULT '',
  `created_at`     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_inv_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_inv_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------------------------------------------------------------------------
-- Announcements (gym-wide, pushed to members) + per-user notifications.
-- ---------------------------------------------------------------------------
CREATE TABLE `announcements` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `admin_id`   INT NOT NULL,
  `title`      VARCHAR(200) NOT NULL,
  `body`       TEXT,
  `priority`   ENUM('normal','important','urgent') NOT NULL DEFAULT 'normal',
  `status`     ENUM('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_ann_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `notifications` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`    INT NOT NULL,
  `admin_id`   INT NULL,
  `type`       VARCHAR(40) NOT NULL DEFAULT 'info',
  `title`      VARCHAR(200) NOT NULL,
  `body`       TEXT,
  `is_read`    TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_notif_user` (`user_id`, `is_read`),
  CONSTRAINT `fk_notif_user`  FOREIGN KEY (`user_id`)  REFERENCES `users`(`id`)  ON DELETE CASCADE,
  CONSTRAINT `fk_notif_admin` FOREIGN KEY (`admin_id`) REFERENCES `admins`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
