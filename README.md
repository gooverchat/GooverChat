# GooverChat

Production-ready web chat application. Monorepo with Next.js (App Router), PostgreSQL, Redis, and Socket.IO.

## Tech stack

- **Web:** Next.js 14 (App Router), Tailwind CSS, TypeScript
- **API:** Next.js Route Handlers (REST) + Socket.IO (realtime)
- **DB:** PostgreSQL + Prisma
- **Cache / PubSub / Rate limit:** Redis
- **Auth:** Email + password, JWT access + refresh tokens, device sessions (password reset is **disabled for launch**; see docs)
- **File uploads:** S3-compatible (MinIO locally, AWS S3 in prod)

## Repository structure

```
/
├── apps/
│   └── web/                 # Next.js app (UI + API + Socket.IO server)
├── packages/
│   └── shared/              # Shared types, Zod schemas, constants
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── docs/
│   ├── LOCAL_TESTING.md      # Environment A: run locally (exact steps)
│   ├── DEPLOY_SERVER_LAPTOP.md  # Environment B: deploy to Ubuntu Server laptop
│   ├── SWITCH_LOCAL_TO_SERVER.md # Workflow: verify → push → deploy → verify
│   ├── DEPLOY_UBUNTU.md      # Ubuntu LTS deployment (SSH, UFW, fail2ban, etc.)
│   └── FILE_STRUCTURE.md     # File-by-file explanation
├── infra/                    # Reverse proxy (LAN vs domain+HTTPS)
│   ├── README.md
│   ├── caddy/
│   └── nginx/
├── scripts/
│   └── deploy-server.sh      # Update script for server
├── .env.example              # All variables (reference)
├── .env.local.example        # Local dev (copy to .env.local)
├── .env.production.example   # Production (copy to .env on server)
└── README.md
```

## Two environments

| Environment | Where | Compose | Env file | Docs |
|-------------|--------|---------|----------|------|
| **A – Local dev/test** | Main laptop | `docker-compose.dev.yml` | `.env.local` (from `.env.local.example`) | [docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md) |
| **B – Production** | Ubuntu Server laptop | `docker-compose.prod.yml` | `.env` at `/opt/gooverchat/.env` (from `.env.production.example`) | [docs/DEPLOY_SERVER_LAPTOP.md](docs/DEPLOY_SERVER_LAPTOP.md) |

**Workflow (local → server):** [docs/SWITCH_LOCAL_TO_SERVER.md](docs/SWITCH_LOCAL_TO_SERVER.md)

## How to run locally (Environment A)

See **[docs/LOCAL_TESTING.md](docs/LOCAL_TESTING.md)** for exact steps. Short version:

```bash
pnpm install
cp .env.local.example .env.local
pnpm docker:dev
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

- App: [http://localhost:3000](http://localhost:3000)
- Health: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- Seed users: **alice@example.com** / **bob@example.com** — **DemoPassword123!**

## Scripts

| Command | Description |
|--------|-------------|
| `pnpm dev` | Start Next.js + Socket.IO dev server |
| `pnpm build` | Build web app |
| `pnpm start` | Start production server |
| `pnpm db:generate` | Generate Prisma client (from web: `npx prisma generate --schema=../../prisma/schema.prisma`) |
| `pnpm db:migrate` | Run migrations (deploy) |
| `pnpm db:migrate:dev` | Create and run migrations (dev) |
| `pnpm db:seed` | Seed database |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:reset` | Reset DB (drop + migrate; use with care) |
| `pnpm docker:dev` | Start Postgres, Redis, MinIO (Environment A) |
| `pnpm docker:dev:down` | Stop local Docker services |
| `pnpm docker:dev:logs` | Follow logs of local Docker services |
| `pnpm test` | Run Vitest unit/integration tests |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm lint` | Lint all packages |

## Deployment

See **[docs/DEPLOY_UBUNTU.md](docs/DEPLOY_UBUNTU.md)** for:

- Non-root user and SSH hardening
- UFW, fail2ban, Docker, Nginx/Caddy, HTTPS (Let’s Encrypt)
- Backups, monitoring, update strategy

## File-by-file explanation

See **[docs/FILE_STRUCTURE.md](docs/FILE_STRUCTURE.md)** for a description of each important file and folder.

## Definition of Done (checklist)

- [x] Monorepo with clear structure
- [x] TypeScript everywhere
- [x] Auth: register, login, refresh, logout, verify email (forgot/reset password **disabled for launch**; will be added later)
- [x] API: users, friends, conversations, messages, notifications, settings, report, push
- [x] DB schema (Prisma) + migrations + seed
- [x] Realtime: Socket.IO with auth and Redis adapter
- [x] Web UI: Chats, Search, Friends, Notifications, Settings (responsive + mobile tabs)
- [x] Message actions: reply, edit, delete (me/everyone), react, forward, print route
- [x] Security: rate limiting, validation (Zod), CORS, secure cookies, security headers
- [x] Health endpoint, structured logging ready
- [x] Docker (dev + prod), .env.example
- [x] Tests: unit (auth), E2E (login, send message)
- [x] OpenAPI at /api/docs
- [x] README (how to run locally), DEPLOY_UBUNTU.md, FILE_STRUCTURE.md

---

## Exact commands (copy-paste)

### A) Main laptop – test locally (from a clean clone)

```bash
cd /path/to/gooverchat
pnpm install
cp .env.local.example .env.local
pnpm docker:dev
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Then open **http://localhost:3000**. Seed login: **alice@example.com** / **DemoPassword123!**

**Verification (after fixing @gooverchat/shared):**

```bash
pnpm install
pnpm run build:packages
pnpm dev
# In browser: open http://localhost:3000 → Sign up → create account (signup should compile and work)
# Or: curl -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d "{\"email\":\"t@t.com\",\"username\":\"testuser\",\"password\":\"TestPass123!\"}"
```

### B) Ubuntu Server laptop – first deploy

```bash
sudo mkdir -p /opt/gooverchat && sudo chown $USER:$USER /opt/gooverchat
cd /opt/gooverchat
git clone <your-repo-url> .
cp .env.production.example .env
nano .env
# Set DATABASE_URL, DIRECT_URL, REDIS_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET,
# POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, NEXT_PUBLIC_APP_URL, CORS_ORIGINS
chmod 600 .env
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy --schema=/app/prisma/schema.prisma
curl http://localhost:3000/api/health
```

### C) Ubuntu Server laptop – updates (after git push from main laptop)

```bash
cd /opt/gooverchat
./scripts/deploy-server.sh
```

Or manually:

```bash
cd /opt/gooverchat
git fetch && git checkout main && git pull
docker compose -f docker-compose.prod.yml --env-file .env build app
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy --schema=/app/prisma/schema.prisma
docker compose -f docker-compose.prod.yml --env-file .env up -d
curl http://localhost:3000/api/health
```

### D) What runs where

| Component      | Local (main laptop)              | Production (Ubuntu Server laptop)     |
|----------------|----------------------------------|----------------------------------------|
| **Browser**    | Your machine → localhost:3000    | Your machine → SERVER_IP:3000 or https |
| **Next server**| `pnpm dev` (host, port 3000)     | Docker service `app` (port 3000)       |
| **WebSocket**  | Same process as Next (server.js) | Same process as Next (server.js)      |
| **Postgres**   | Docker (docker-compose.dev)      | Docker (docker-compose.prod)           |
| **Redis**      | Docker (docker-compose.dev)      | Docker (docker-compose.prod)           |
| **Reverse proxy** | None                          | Optional: Caddy or Nginx (Mode 2)      |
