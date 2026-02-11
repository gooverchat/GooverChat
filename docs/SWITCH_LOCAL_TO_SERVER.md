# Switching workflow: Local → Server

This document describes the **exact flow** to verify locally, push to git, then deploy to your Ubuntu Server laptop and verify production.

---

## Step 1: Verify locally (tests + run)

On your **main laptop**, from the repo root:

```bash
# Run tests
pnpm test
pnpm lint

# Optional: E2E (requires app + DB running)
pnpm docker:dev
pnpm db:migrate
pnpm db:seed
pnpm test:e2e

# Run the app and smoke-test in the browser
pnpm dev
# Open http://localhost:3000, sign in, send a message.
```

Confirm there are no failing tests and the app behaves as expected.

---

## Step 2: Push to git (main branch)

On your **main laptop**:

```bash
git add -A
git status   # review
git commit -m "Your change description"
git push origin main
```

Use the branch your server deploys from (e.g. `main`). The server will pull this branch in Step 4.

---

## Step 3: SSH to server laptop

From your **main laptop**:

```bash
ssh -i ~/.ssh/gooverchat_server USER@SERVER_IP
```

Replace `USER` and `SERVER_IP` with your server user and IP (or hostname). Use the key you set up in [DEPLOY_SERVER_LAPTOP.md](DEPLOY_SERVER_LAPTOP.md).

---

## Step 4: Pull latest + deploy script

On the **server** (after SSH):

```bash
cd /opt/gooverchat
chmod +x scripts/deploy-server.sh   # only first time
./scripts/deploy-server.sh
```

The script will:

1. `git fetch && git checkout main && git pull`
2. `docker compose -f docker-compose.prod.yml --env-file .env build app`
3. `docker compose ... run --rm app npx prisma migrate deploy --schema=/app/prisma/schema.prisma`
4. `docker compose ... up -d`

---

## Step 5: Verify production health endpoint

On the **server** (or from your main laptop if the server is reachable):

**LAN-only (Mode 1):**

```bash
curl http://SERVER_LAN_IP:3000/api/health
```

**With reverse proxy + HTTPS (Mode 2):**

```bash
curl https://gooverchat.yourdomain.com/api/health
```

You should get JSON with `"status": "healthy"` (or `"degraded"` if Redis is down; DB must be OK for healthy).

---

## Quick reference

| Step | Where       | Action |
|------|-------------|--------|
| 1    | Main laptop | `pnpm test` && `pnpm lint` && `pnpm dev` + manual check |
| 2    | Main laptop | `git push origin main` |
| 3    | Main laptop | `ssh USER@SERVER_IP` |
| 4    | Server      | `cd /opt/gooverchat && ./scripts/deploy-server.sh` |
| 5    | Server or main | `curl .../api/health` |

---

## If something goes wrong

- **Tests fail locally:** Fix and re-run Step 1; do not push until tests pass.
- **Deploy script fails on server:** Check `docker compose -f docker-compose.prod.yml --env-file .env logs app` and fix env or code; then re-run the script.
- **Health returns 503:** Check Postgres and Redis: `docker compose -f docker-compose.prod.yml ps` and logs for `postgres`, `redis`, `app`.
- **Rollback:** See [DEPLOY_SERVER_LAPTOP.md#how-to-rollback](DEPLOY_SERVER_LAPTOP.md#11-how-to-rollback).
