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
