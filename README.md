# FitPulse - Multi-Admin Gym Management System (PHP + MySQL)

A professional **multi-admin** gym management system with three isolated
portals: **Superadmin**, **Admin** and **User** — powered by a PHP REST API and
a MySQL database on localhost (XAMPP).

> This project replaces the old single-gym app. Trainers now have **no login
> portal**; their records are managed manually. Each admin runs an independent
> gym (supplements / merch / memberships / services) with full data isolation.

---

## 1. System Architecture Overview

```
┌────────────────────┐   ┌────────────────────┐   ┌────────────────────┐
│   SUPERADMIN       │   │   ADMIN            │   │   USER             │
│   (one fixed acct) │   │   (gym owner)      │   │   (gym member)     │
└─────────┬──────────┘   └─────────┬──────────┘   └─────────┬──────────┘
          │  session cookie        │  session cookie       │  session cookie
          ▼                        ▼                       ▼
   ┌──────────────────────────────────────────────────────────────┐
   │                 PHP REST API  (api/*.php)                    │
   │  auth (login/me/logout/register) · superadmin/* · admin/*    │
   │  user/* · payments.php (static QR generation)                │
   └──────────────────────────────────────────────────────────────┘
          │                        │                       │
          ▼                        ▼                       ▼
   superadmins              admins · subscription_plans   users · user_gyms
   trainers (all)          subscriptions · trainers       products (read)
                           products · users
                  ┌────────────────────────────┐
                  │   MySQL database `fitpulse` │
                  └────────────────────────────┘
```

### Portal Roles

| Portal | Who | What they can do |
|--------|-----|------------------|
| **Superadmin** | Platform owner (fixed account) | Create/suspend/delete Admin accounts, define subscription plans, monitor & verify all subscription payments, view all gyms, add/manage trainers manually (assign to any gym), global metrics |
| **Admin** | Independent gym owner | Own login, purchase a subscription plan via **QR payment**, after activation manage **own** products (supplements / merch / memberships / services), create & manage **own** users, add/manage **own** trainers (manual records) |
| **User** | Gym member | Own registration/login, dashboard, browse all gyms with an active subscription, **select/follow multiple gyms**, view products & trainers of each selected gym |

### Authentication

- Email + password, **bcrypt** hashed via `password_hash()`.
- Single sign-in form; the portal is detected automatically by looking up
  `superadmins` → `admins` → `users`.
- PHP sessions (`httpOnly`, `Lax`, regenerated on login); identity stored as
  `['portal' => ..., 'id' => ...]` and resolved to the correct table by
  `current_user()`.
- Role checks on every protected endpoint via `require_portal()`; admin writes
  additionally require an **active subscription** (`require_admin_active()`).

### User Flows

1. **Superadmin** creates an Admin → Admin logs in → picks a plan → pays by QR →
   Superadmin verifies the payment → subscription becomes active → Admin adds
   products/users/trainers.
2. **User** registers → browses gyms (only those with active subscriptions) →
   selects gyms to follow → opens each gym's product catalog.

### Payment Process (QR, manual verification)

1. Admin clicks **Subscribe** on a plan (`api/admin/subscribe.php`).
2. Server creates a `pending` subscription with a unique reference
   (`qr_ref`, e.g. `FITQ-XXXX-XXXXXX`) and returns it.
3. Frontend renders the static QR via `api/payments.php?ref=...`, which encodes
   the payment instruction text (plan, amount, reference) as a PNG using the
   bundled **phpqrcode** library (works fully offline).
4. The admin pays using eSewa / Khalti / bank transfer in the real world.
5. The Superadmin opens the **Payments & Subs** tab, sees the pending reference,
   and clicks **Verify** to activate the subscription (or Reject). `expires_at`
   is set from the plan duration; expired subscriptions are auto-flagged.

### Data Isolation (Multi-Admin)

- Every admin-owned row (`trainers`, `products`, `users`, `subscriptions`)
  carries an `admin_id`.
- Admin endpoints filter every query by the signed-in admin's id
  (`WHERE admin_id = ?`), so admin A can never read/write admin B's data.
- `user_gyms` links members to the gyms they follow; products are always shown
  scoped to the selected `admin_id`.
- Deleting an admin cascades to all of their data (`ON DELETE CASCADE`).

### Technology Stack

- **Frontend:** HTML5 + CSS3 + Vanilla JS (`fetch`, single-page UI, no build step)
- **Backend:** PHP 8 (PDO prepared statements)
- **Database:** MySQL / MariaDB (XAMPP), database `fitpulse`
- **QR codes:** `vendor/phpqrcode/` (pure-PHP, offline)

---

## 2. Project Structure

```
├── index.html                 Single-page frontend (3 portals)
├── style.css                  Styles
├── script.js                  Frontend logic (auth, portal routing, CRUD)
├── config/init.php            DB credentials, session, CORS, auth helpers
├── api/
│   ├── auth/
│   │   ├── login.php          Portal auto-detect login
│   │   ├── register.php       User self-registration
│   │   ├── me.php             Restore session
│   │   └── logout.php
│   ├── superadmin/
│   │   ├── admins.php         Admin accounts CRUD
│   │   ├── plans.php          Subscription plans CRUD
│   │   ├── subscriptions.php  List + verify/reject payments
│   │   ├── trainers.php       Trainer records CRUD (any gym)
│   │   └── metrics.php        Global dashboard stats
│   ├── admin/
│   │   ├── dashboard.php      Admin metrics + subscription status
│   │   ├── subscribe.php      Create payment request (QR)
│   │   ├── subscriptions.php  Own history / current status
│   │   ├── products.php       Own products CRUD (requires active sub)
│   │   ├── users.php          Own gym users CRUD (requires active sub)
│   │   └── trainers.php       Own gym trainers CRUD (requires active sub)
│   ├── user/
│   │   ├── dashboard.php      Member dashboard
│   │   ├── gyms.php           List/select/follow gyms
│   │   ├── products.php       Products of a selected gym
│   │   └── trainers.php       Trainers of a selected gym
│   └── payments.php           Static QR PNG + info generator
├── database/
│   ├── seed.php               One-click DB + tables + demo data
│   └── schema.sql             Reference schema
└── vendor/phpqrcode/          Bundled QR encoder (LGPL)
```

---

## 3. Setup (Windows, XAMPP)

### 1. Install XAMPP and copy the project

Install XAMPP from https://www.apachefriends.org, then copy this folder to
`C:\xampp\htdocs\gym-management-system` (folder name optional).

### 2. Configure credentials (if needed)

Open `config/init.php`:

```php
const DB_HOST = '127.0.0.1';
const DB_PORT = 3306;
const DB_NAME = 'fitpulse';
const DB_USER = 'root';
const DB_PASS = '';   // XAMPP default is empty
```

### 3. Start Apache + MySQL

Open the XAMPP Control Panel and start **Apache** and **MySQL**.

### 4. Create the database & demo data

```bash
php database/seed.php
```

Idempotent — re-running resets the database. (Alternative: import
`database/schema.sql` in phpMyAdmin, but demo passwords only come from seed.php.)

### 5. Open the app

Go to: `http://localhost/<your-folder-name>/index.html`

---

## 4. Demo Accounts

| Portal | Email | Password | Notes |
|--------|-------|----------|-------|
| **Superadmin** | `rijanpokhrel@superadmin.com` | `Rijan@123` | Fixed platform owner |
| **Admin (active)** | `admin@peakfitness.com` | `Admin@123` | Subscription ACTIVE — products/users unlocked |
| **Admin (pending)** | `admin@ironcore.com` | `Admin@123` | Pending payment — try the full QR verification flow |
| **User** | `aarav.sharma@example.com` | `user123` | Member |

---

## 5. API Summary

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/login.php` | - | Portal auto-detect login |
| POST | `/api/auth/register.php` | - | User registration |
| GET  | `/api/auth/me.php` | any | Restore session |
| POST | `/api/auth/logout.php` | any | Sign out |
| GET/POST/PUT/DELETE | `/api/superadmin/admins.php` | superadmin | Admin account management |
| GET/POST/PUT/DELETE | `/api/superadmin/plans.php` | superadmin | Subscription plans |
| GET/POST | `/api/superadmin/subscriptions.php` | superadmin | List + verify/reject payments |
| GET/POST/PUT/DELETE | `/api/superadmin/trainers.php` | superadmin | Manual trainer records |
| GET | `/api/superadmin/metrics.php` | superadmin | Global stats |
| GET | `/api/admin/dashboard.php` | admin | Own metrics + sub status |
| POST | `/api/admin/subscribe.php` | admin | Purchase a plan (QR ref) |
| GET | `/api/admin/subscriptions.php` | admin | Own history + status |
| GET/POST/PUT/DELETE | `/api/admin/products.php` | admin* | Own products |
| GET/POST/PUT/DELETE | `/api/admin/users.php` | admin* | Own gym users |
| GET/POST/PUT/DELETE | `/api/admin/trainers.php` | admin* | Own gym trainers |
| GET | `/api/user/dashboard.php` | user | Member dashboard |
| GET/POST/DELETE | `/api/user/gyms.php` | user | Browse / select gyms |
| GET | `/api/user/products.php` | user | Products of a gym |
| GET | `/api/user/trainers.php` | user | Trainers of a gym |
| GET | `/api/payments.php?ref=...` | - | QR PNG / payment info |

\* `admin/*` write endpoints also require an **active subscription**.

---

## 6. Security Notes

- Passwords hashed with `password_hash()` (bcrypt).
- All queries use PDO prepared statements (SQL-injection safe).
- Sessions are httpOnly, Lax, regenerated on login; role + subscription checks
  on every protected endpoint.
- QR references are random (16 hex chars) and required to view a QR.
- **Demo only:** no CSRF tokens or rate limiting. For production add HTTPS,
  CSRF protection, real payment gateway webhooks, and audit logs.

---

## 7. Bundled QR library

`vendor/phpqrcode/` is the well-known pure-PHP QR encoder (LGPL). It renders
the payment QR codes offline, so no external API / internet is needed at runtime.
