# FitPulse - Gym Management System (PHP + MySQL)

A professional multi-role gym management system with a **PHP REST API** and a
**MySQL database** on localhost.

## Roles & Features

| Role | Access |
|------|--------|
| **Admin** | Trainer verification, member directory (CRUD), class schedule (CRUD), payments, system overview |
| **Member / User** | Browse verified trainers, book trainers & shifts, view booking history |
| **Trainer** | Application status, assigned shifts, assigned client roster |

Authentication uses **email + password** (bcrypt hashed) with PHP sessions
(httpOnly cookies). All data lives in MySQL - no localStorage.

## Tech Stack

- Frontend: HTML5 + CSS3 + Vanilla JS (fetch API)
- Backend: PHP 8 (PDO prepared statements)
- Database: MySQL / MariaDB (schema: `fitpulse`)

## Project Structure

```
├── index.html                 Frontend entry point
├── style.css                  Styles
├── script.js                  Frontend logic (talks to the PHP API)
├── config/init.php            DB credentials, session, CORS, helpers
├── api/
│   ├── auth/login.php         Email + password login
│   ├── auth/register.php      User / trainer registration
│   ├── auth/logout.php        End session
│   ├── auth/me.php            Restore session on page load
│   ├── trainers.php           List + admin approve/reject
│   ├── bookings.php           Create + role-based listing
│   ├── members.php            Admin CRUD
│   ├── classes.php            List + admin CRUD
│   ├── payments.php           Admin CRUD
│   └── metrics.php            Dashboard statistics
└── database/
    ├── seed.php               One-click database + demo data setup
    └── schema.sql             Reference schema (optional)
```

## Setup (Windows, XAMPP recommended)

### 1. Install XAMPP
Download from https://www.apachefriends.org and install. XAMPP bundles
**Apache (PHP)** + **MariaDB (MySQL)** together.

> Already have PHP and MySQL separately? Skip to step 3.

### 2. Copy the project into htdocs
Copy this entire folder into `C:\xampp\htdocs\`
(e.g. `C:\xampp\htdocs\gym-management-system`).

### 3. Configure the database credentials
Open `config/init.php` and check the constants at the top:

```php
const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'fitpulse';
const DB_USER = 'root';
const DB_PASS = '';   // XAMPP default is empty
```

If your MySQL root password is set, change `DB_PASS`.

### 4. Start the servers
Open the XAMPP Control Panel and **Start** both:
- **Apache**
- **MySQL**

### 5. Create the database & seed demo data
Open a terminal in the project folder and run:

```bash
php database/seed.php
```

This creates the `fitpulse` database, all tables, and demo data. It is
idempotent (re-running resets the database).

> Alternative: import `database/schema.sql` via phpMyAdmin
> (http://localhost/phpmyadmin).

### 6. Open the app
Go to: `http://localhost/<your-folder-name>/index.html`

## Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@fitpulse.com` | `admin123` |
| Member | `aarav.sharma@example.com` | `user123` |
| Trainer | `alex.trainer@fitpulse.com` | `trainer123` |

## API Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/login.php` | - | Sign in (email, password, portal) |
| POST | `/api/auth/register.php` | - | Register user or trainer |
| POST | `/api/auth/logout.php` | - | Sign out |
| GET | `/api/auth/me.php` | - | Current session user |
| GET | `/api/trainers.php` | - | Approved catalog (or all for admin) |
| POST | `/api/trainers.php` | admin | Approve / reject trainer |
| GET | `/api/bookings.php` | any | Bookings by role |
| POST | `/api/bookings.php` | user | Book a trainer |
| GET/POST/PUT/DELETE | `/api/members.php` | admin | Member directory CRUD |
| GET/POST/DELETE | `/api/classes.php` | GET public, rest admin | Class schedule |
| GET/POST | `/api/payments.php` | admin | Payments |
| GET | `/api/metrics.php` | any signed-in | Dashboard stats |

## Security Notes

- Passwords hashed with `password_hash()` (bcrypt).
- All queries use PDO prepared statements (SQL-injection safe).
- Sessions are httpOnly, regenerated on login, role checks on every protected
  endpoint.
- **Demo only:** this project has no CSRF tokens or rate limiting. For
  production, add HTTPS, CSRF protection, and password reset flows.
