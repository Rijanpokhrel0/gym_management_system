-- ============================================================================
-- FITPULSE GYM MANAGEMENT SYSTEM - MySQL SCHEMA
-- ============================================================================
-- EASIEST SETUP: run `php database/seed.php` instead (it creates the database,
-- tables AND demo data automatically).
--
-- This file is provided as a reference / for manual import via phpMyAdmin.
-- NOTE: If you import only this file, demo users will be missing their
-- passwords. Prefer database/seed.php for a fully working setup.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `fitpulse`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `fitpulse`;

CREATE TABLE `users` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `name`       VARCHAR(100) NOT NULL,
  `email`      VARCHAR(150) NOT NULL UNIQUE,
  `password`   VARCHAR(255) NOT NULL,
  `role`       ENUM('admin','user','trainer') NOT NULL DEFAULT 'user',
  `goal`       VARCHAR(120) DEFAULT NULL,
  `phone`      VARCHAR(40)  NOT NULL DEFAULT '',
  `bio`        TEXT,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `members` (
  `id`          INT AUTO_INCREMENT PRIMARY KEY,
  `name`        VARCHAR(120) NOT NULL,
  `email`       VARCHAR(150) NOT NULL DEFAULT '',
  `phone`       VARCHAR(40)  NOT NULL DEFAULT '',
  `plan`        VARCHAR(80)  NOT NULL DEFAULT 'Standard Fitness',
  `status`      ENUM('Active','Expiring','Inactive') NOT NULL DEFAULT 'Active',
  `join_date`   DATE DEFAULT NULL,
  `expiry_date` DATE DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `trainers` (
  `id`                 INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`            INT NOT NULL,
  `specialization`     VARCHAR(120) NOT NULL,
  `experience`         INT NOT NULL DEFAULT 0,
  `shifts`             JSON NOT NULL,
  `status`             ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `registered_at`      DATE DEFAULT NULL,
  `salary_expectation` DECIMAL(10,2) NOT NULL DEFAULT 0,
  `certifications`     TEXT,
  `rating`             DECIMAL(2,1) NOT NULL DEFAULT 0,
  CONSTRAINT `fk_trainers_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `classes` (
  `id`       INT AUTO_INCREMENT PRIMARY KEY,
  `title`    VARCHAR(120) NOT NULL,
  `trainer`  VARCHAR(100) NOT NULL DEFAULT '',
  `day`      VARCHAR(20)  NOT NULL DEFAULT 'Monday',
  `time`     VARCHAR(60)  NOT NULL DEFAULT '',
  `capacity` INT NOT NULL DEFAULT 20,
  `booked`   INT NOT NULL DEFAULT 0,
  `category` VARCHAR(60)  NOT NULL DEFAULT 'Fitness'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `payments` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `invoice_no`   VARCHAR(30) NOT NULL,
  `member`       VARCHAR(120) NOT NULL,
  `plan`         VARCHAR(120) NOT NULL DEFAULT 'Membership Fee',
  `amount`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `method`       VARCHAR(50) NOT NULL DEFAULT 'Cash',
  `payment_date` DATE DEFAULT NULL,
  `status`       ENUM('Paid','Pending') NOT NULL DEFAULT 'Paid'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE `bookings` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `user_id`      INT NOT NULL,
  `trainer_id`   INT NOT NULL,
  `shift`        VARCHAR(120) NOT NULL,
  `notes`        TEXT,
  `booking_date` DATE DEFAULT NULL,
  CONSTRAINT `fk_bookings_user`    FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)    ON DELETE CASCADE,
  CONSTRAINT `fk_bookings_trainer` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Gym equipment inventory
CREATE TABLE `equipment` (
  `id`               INT AUTO_INCREMENT PRIMARY KEY,
  `name`             VARCHAR(120) NOT NULL,
  `category`         VARCHAR(60)  NOT NULL DEFAULT 'Strength',
  `quantity`         INT NOT NULL DEFAULT 1,
  `equipment_status` ENUM('New','Good','Needs Maintenance','Out of Service') NOT NULL DEFAULT 'Good',
  `last_maintenance` DATE DEFAULT NULL,
  `notes`            VARCHAR(255) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Membership plan pricing catalog
CREATE TABLE `membership_plans` (
  `id`       INT AUTO_INCREMENT PRIMARY KEY,
  `name`     VARCHAR(80) NOT NULL,
  `price`    DECIMAL(10,2) NOT NULL DEFAULT 0,
  `duration` VARCHAR(40)  NOT NULL DEFAULT 'Monthly',
  `features` TEXT,
  `popular`  TINYINT(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Single-row gym profile (about, location, hours, contact)
CREATE TABLE `gym_info` (
  `id`      INT AUTO_INCREMENT PRIMARY KEY,
  `name`    VARCHAR(120) NOT NULL DEFAULT 'FitPulse Gym',
  `about`   TEXT,
  `address` VARCHAR(255) NOT NULL DEFAULT '',
  `phone`   VARCHAR(40)  NOT NULL DEFAULT '',
  `email`   VARCHAR(150) NOT NULL DEFAULT '',
  `hours`   TEXT,
  `map_url` VARCHAR(500) NOT NULL DEFAULT ''
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Trainer salary payments
CREATE TABLE `trainer_payments` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `trainer_id`   INT NOT NULL,
  `amount`       DECIMAL(10,2) NOT NULL DEFAULT 0,
  `month`        VARCHAR(7) NOT NULL DEFAULT '',
  `status`       ENUM('Paid','Pending') NOT NULL DEFAULT 'Pending',
  `payment_date` DATE DEFAULT NULL,
  `method`       VARCHAR(50) NOT NULL DEFAULT 'Cash',
  `notes`        VARCHAR(255) NOT NULL DEFAULT '',
  CONSTRAINT `fk_trainer_payments_trainer` FOREIGN KEY (`trainer_id`) REFERENCES `trainers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
