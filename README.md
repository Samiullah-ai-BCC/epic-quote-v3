# Epic Craftings Quote Generator — V3

React + Vite · Laravel 11 · MySQL · Gotenberg PDF · Groq AI

## Structure

```
epic-quote-v3/
├── frontend/          React + Vite SPA
├── backend/           Laravel 11 API
├── docker-compose.yml MySQL + Gotenberg + phpMyAdmin
├── PARITY_CHECKLIST.md  V1 feature floor — tick as each ships
└── README.md
```

## Prerequisites

- PHP 8.2+
- Composer
- Node.js 18+
- Docker Desktop (for MySQL + Gotenberg)

## Setup

### 1. Start services
```bash
docker compose up -d
```
MySQL at `localhost:3306`, Gotenberg at `localhost:3030`, phpMyAdmin at `localhost:8080`.

### 2. Backend
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
# Edit .env — set DB_PASSWORD, GROQ_API_KEY, seed passwords
php artisan migrate --seed
php artisan storage:link
php artisan serve   # http://localhost:8000
```

### 3. Frontend
```bash
cd frontend
npm install    # already done if you cloned after scaffold
npm run dev    # http://localhost:5173
```

## Environment variables (critical)

| Key | Notes |
|-----|-------|
| `APP_KEY` | Auto-set by `artisan key:generate` |
| `GROQ_API_KEY` | Required for AI specs — never commit |
| `GOTENBERG_URL` | `http://localhost:3030` locally |
| `SEED_*_PASSWORD` | Set before first `migrate --seed` — no defaults |
| `FILESYSTEM_DISK` | `local` → Render disk; `s3` → R2 (env swap only) |

## Parity rule

Every feature in `PARITY_CHECKLIST.md` must ship. V1 is the floor. Do not proceed to next phase until current phase items are checked.

## Phases

| Phase | Scope |
|-------|-------|
| P0 | Scaffold ✓ |
| P1 | Auth + RBAC + Users |
| P2 | Schema + Catalog (MySQL migrations) |
| P3 | Quote intake + list + dashboard |
| P4 | Generator wizard |
| P5 | AI specs (Groq) |
| P6 | Proposal editor (key phase) |
| P7 | Server-side PDF (Gotenberg) |
| P8 | Dashboard + CRM + Reports |
| P9 | Harden + deploy (Render) |
