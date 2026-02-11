# Local testing (Environment A)

Run GooverChat on your **main laptop** for development and testing. Uses Docker for Postgres, Redis, and MinIO; the app runs on your host with `pnpm dev`.

---

## Prerequisites

- **Node.js 20+** and **pnpm** (`npm install -g pnpm`)
- **Docker** and **Docker Compose** (so `docker compose` works)

---

## Exact steps (from a clean clone)

### 1. Clone and install

```bash
cd /path/to/your/projects
git clone <your-repo-url> gooverchat
cd gooverchat
pnpm install
```

### 2. Copy local env file

```bash
cp .env.local.example .env.local
```

Edit `.env.local` if you need to change ports or passwords. Defaults point to `localhost` and match `docker-compose.dev.yml`.

### 3. Start local services (Postgres, Redis, MinIO)

```bash
pnpm docker:dev
```

This runs `docker compose -f docker-compose.dev.yml up -d`. Wait a few seconds for Postgres to be ready.

### 4. Generate Prisma client

```bash
pnpm db:generate
```

If you see an error about `pnpm add prisma`, run this first from repo root, then `pnpm db:generate` again:

```bash
cd apps/web && pnpm add prisma@5.22.0 -D && cd ../..
pnpm db:generate
```

### 5. Run migrations

```bash
pnpm db:migrate
```

### 6. Seed the database (optional but recommended)

```bash
pnpm db:seed
```

Creates users **alice@example.com** and **bob@example.com** with password **DemoPassword123!**.

### 7. Start the app (web + API + WebSocket)

```bash
pnpm dev
```

---

## Where to open the app

- **App (browser):** [http://localhost:3000](http://localhost:3000)
- **Health check:** [http://localhost:3000/api/health](http://localhost:3000/api/health)
- **API docs (OpenAPI):** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)

---

## How to see logs

- **App (Next.js + Socket.IO):** In the terminal where you ran `pnpm dev`. No separate command.
- **Docker services (Postgres, Redis, MinIO):**
  ```bash
  pnpm docker:dev:logs
  ```
  Or:
  ```bash
  docker compose -f docker-compose.dev.yml logs -f
  ```
  Use `Ctrl+C` to stop following. To see logs for one service:
  ```bash
  docker compose -f docker-compose.dev.yml logs -f postgres
  ```

---

## How to reset the database

**Option A – Reset and re-seed (drops all data, reapplies migrations + seed):**

```bash
pnpm db:reset
pnpm db:seed
```

**Option B – Stop services and remove volumes (full reset of Postgres/Redis/MinIO data):**

```bash
pnpm docker:dev:down
docker volume rm gooverchat_gooverchat_pg_data gooverchat_gooverchat_redis_data gooverchat_gooverchat_minio_data 2>/dev/null || true
pnpm docker:dev
# Wait ~10 seconds, then:
pnpm db:migrate
pnpm db:seed
pnpm dev
```

---

## One-command recap (after first-time setup)

After you’ve already run steps 1–6 once:

```bash
pnpm docker:dev   # if services aren’t running
pnpm dev
```

---

## Env files used locally

| File              | Purpose |
|-------------------|--------|
| `.env.local`      | Loaded by Next.js when you run `pnpm dev`. Copy from `.env.local.example`. |
| `.env.example`    | Reference for all variables (no secrets). |
| `docker-compose.dev.yml` | Defines Postgres, Redis, MinIO; **DATABASE_URL** in `.env.local` must match (e.g. `localhost:5432`). |

The app does **not** read `docker-compose.dev.yml` for env; it reads `.env.local` (and Next.js default loading order). So `DATABASE_URL` in `.env.local` must point to **localhost** (same machine as the app), not a Docker service name.

---

## Troubleshooting

- **“Connection refused” to Postgres/Redis:** Ensure `pnpm docker:dev` has run and containers are up: `docker compose -f docker-compose.dev.yml ps`.
- **Prisma “schema not found”:** Run `pnpm db:generate` from the **repo root**.
- **Port 3000 in use:** Change `SERVER_PORT` in `.env.local` and the port in `NEXT_PUBLIC_APP_URL` if you run the app on another port.
