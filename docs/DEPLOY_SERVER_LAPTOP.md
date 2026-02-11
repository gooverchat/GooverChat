# Deploy to Ubuntu Server laptop (Environment B)

Deploy GooverChat on a **separate laptop** running **Ubuntu Server LTS**. You SSH from your main laptop, clone the repo to `/opt/gooverchat`, use a production env file (not committed), and run the stack with Docker Compose.

---

## Prerequisites

- Ubuntu Server LTS (22.04 or 24.04) installed on the server laptop.
- You can SSH from your main laptop to the server (user with sudo).

---

## 1. SSH hardening (key-only auth, disable password login)

On your **main laptop**, generate a key if you don’t have one:

```bash
ssh-keygen -t ed25519 -C "your@email.com" -f ~/.ssh/gooverchat_server
```

Copy the public key to the server (replace `USER` and `SERVER_IP`):

```bash
ssh-copy-id -i ~/.ssh/gooverchat_server.pub USER@SERVER_IP
```

On the **server laptop**, edit SSH config:

```bash
sudo nano /etc/ssh/sshd_config
```

Set or add:

```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
```

Restart SSH (keep an existing session open until you’ve tested a new login):

```bash
sudo systemctl restart sshd
```

From your main laptop, verify key login works:

```bash
ssh -i ~/.ssh/gooverchat_server USER@SERVER_IP
```

---

## 2. UFW firewall rules

On the **server**:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# If you use LAN-only access on a custom port (e.g. 3000):
sudo ufw allow 3000/tcp
sudo ufw enable
sudo ufw status
```

---

## 3. fail2ban

On the **server**:

```bash
sudo apt update && sudo apt install -y fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

Under `[sshd]` set:

```ini
enabled = true
maxretry = 3
bantime = 3600
```

Then:

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## 4. Install Docker and Docker Compose

On the **server**:

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```

Log out and back in (or `newgrp docker`) so the `docker` group is applied. Verify:

```bash
docker compose version
```

---

## 5. Clone repo into /opt/gooverchat

On the **server** (use a dedicated user if you prefer, e.g. `gooverchat`):

```bash
sudo mkdir -p /opt/gooverchat
sudo chown $USER:$USER /opt/gooverchat
cd /opt/gooverchat
git clone <your-repo-url> .
```

Or, if you already have the repo elsewhere, copy it and ensure you’re on the branch you deploy (e.g. `main`):

```bash
cd /opt/gooverchat
git fetch && git checkout main && git pull
```

---

## 6. Create production env file on the server

On the **server**:

```bash
cd /opt/gooverchat
cp .env.production.example .env
nano .env
```

Set **real** values:

- `DATABASE_URL` and `DIRECT_URL`: use host **postgres** (Docker service name), and a **strong** password.
- `REDIS_URL`: use host **redis**.
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`: generate with `openssl rand -base64 32`.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: same as in the URLs.
- `NEXT_PUBLIC_APP_URL`: either `http://SERVER_LAN_IP:3000` (LAN-only) or `https://yourdomain.com` (if using reverse proxy).
- `CORS_ORIGINS`: same as `NEXT_PUBLIC_APP_URL`.

Save and restrict permissions:

```bash
chmod 600 /opt/gooverchat/.env
```

Never commit `.env`; it is gitignored.

---

## 7. Start prod stack with Docker Compose

On the **server**:

```bash
cd /opt/gooverchat
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
```

This builds the app image, starts Postgres and Redis with persistent volumes, then starts the app. The app waits for Postgres and Redis to be healthy (see `docker-compose.prod.yml`).

---

## 8. Run migrations in production safely

On the **server**, after the stack is up:

```bash
cd /opt/gooverchat
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy --schema=/app/prisma/schema.prisma
```

This runs inside the app container with the same env (DB URL points to `postgres`). It only applies pending migrations; it does not reset data.

---

## 9. Verify production

- **Health:** From your main laptop (or the server):  
  `curl http://SERVER_LAN_IP:3000/api/health`  
  Or with HTTPS: `curl https://yourdomain.com/api/health`
- **App:** Open the same URL in a browser.

---

## 10. How to update (git pull, rebuild, migrate, restart)

On the **server**:

```bash
cd /opt/gooverchat
git fetch && git checkout main && git pull
docker compose -f docker-compose.prod.yml --env-file .env build app
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy --schema=/app/prisma/schema.prisma
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

Or use the deploy script (see below):

```bash
./scripts/deploy-server.sh
```

---

## 11. How to rollback

If you need to revert to the previous version:

```bash
cd /opt/gooverchat
git log -1 --oneline   # note current commit
git checkout main
git reset --hard <previous-commit-hash>
docker compose -f docker-compose.prod.yml --env-file .env build app
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

**Note:** Database migrations are not automatically reverted. If the new code added a migration, rolling back the app may leave the DB in a newer state. For a safe rollback, restore the DB from a backup if you have one.

---

## Reverse proxy (optional): LAN-only vs domain + HTTPS

- **Mode 1 – LAN only:** Access at `http://SERVER_LAN_IP:3000`. No reverse proxy needed; UFW allows port 3000.
- **Mode 2 – Domain + HTTPS:** Put Caddy (or Nginx) in front and use Let’s Encrypt. Example configs are in `infra/` (see [infra/README.md](infra/README.md)).

---

## Summary: first deploy commands (server)

```bash
# After SSH, UFW, fail2ban, Docker are done:
sudo mkdir -p /opt/gooverchat && sudo chown $USER:$USER /opt/gooverchat
cd /opt/gooverchat
git clone <your-repo-url> .
cp .env.production.example .env
nano .env   # fill real values
chmod 600 .env
docker compose -f docker-compose.prod.yml --env-file .env up -d --build
docker compose -f docker-compose.prod.yml --env-file .env run --rm app npx prisma migrate deploy --schema=/app/prisma/schema.prisma
curl http://localhost:3000/api/health
```
