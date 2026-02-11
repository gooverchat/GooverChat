# Deploy GooverChat on Ubuntu LTS (secure via SSH)

This guide covers deploying GooverChat on a fresh Ubuntu LTS (22.04 or 24.04) with SSH hardening, firewall, Docker, reverse proxy, HTTPS, backups, and monitoring.

## 1. Create non-root sudo user

```bash
sudo adduser gooverchat
sudo usermod -aG sudo gooverchat
sudo su - gooverchat
```

Use this user for all app and deployment tasks. Avoid running the app as root.

## 2. SSH hardening

### Key-based auth only

On your **local machine** (if you don’t have a key):

```bash
ssh-keygen -t ed25519 -C "your@email.com"
```

Copy the public key to the server:

```bash
ssh-copy-id gooverchat@YOUR_SERVER_IP
```

### Disable password login and harden `sshd_config`

```bash
sudo nano /etc/ssh/sshd_config
```

Set or add:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
AllowUsers gooverchat
```

Restart SSH and **keep a session open** until you confirm key login works:

```bash
sudo systemctl restart sshd
# From another terminal: ssh gooverchat@YOUR_SERVER_IP
```

## 3. UFW firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP (for Let's Encrypt)
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
sudo ufw status
```

## 4. fail2ban

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

```bash
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## 5. Install Docker and Docker Compose plugin

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker gooverchat
# Log out and back in for docker group
```

## 6. Environment variables (never commit secrets)

Create a directory for the app and env file:

```bash
mkdir -p /home/gooverchat/app
nano /home/gooverchat/app/.env
```

Example `.env` for production:

```env
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://gooverchat.yourdomain.com
DATABASE_URL=postgresql://gooverchat:STRONG_PASSWORD@postgres:5432/gooverchat
DIRECT_URL=postgresql://gooverchat:STRONG_PASSWORD@postgres:5432/gooverchat
REDIS_URL=redis://redis:6379/0
JWT_ACCESS_SECRET=<openssl rand -base64 32>
JWT_REFRESH_SECRET=<openssl rand -base64 32>
CORS_ORIGINS=https://gooverchat.yourdomain.com
COOKIE_SECURE=true
POSTGRES_USER=gooverchat
POSTGRES_PASSWORD=STRONG_PASSWORD
POSTGRES_DB=gooverchat
```

Restrict permissions:

```bash
chmod 600 /home/gooverchat/app/.env
```

## 7. docker-compose.prod.yml

Use the repo’s `docker-compose.prod.yml`. Ensure the app service receives the variables above (via `env_file: .env` or `environment:`). Example override for build context:

```yaml
# From repo root
services:
  app:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
    env_file: .env
    # ... rest as in repo
```

## 8. Reverse proxy and HTTPS (Nginx or Caddy)

### Option A: Nginx + Let’s Encrypt

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo certbot --nginx -d gooverchat.yourdomain.com
```

Nginx site config (e.g. `/etc/nginx/sites-available/gooverchat`):

```nginx
server {
    listen 80;
    server_name gooverchat.yourdomain.com;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name gooverchat.yourdomain.com;
    ssl_certificate /etc/letsencrypt/live/gooverchat.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/gooverchat.yourdomain.com/privkey.pem;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and reload:

```bash
sudo ln -s /etc/nginx/sites-available/gooverchat /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Option B: Caddy (auto HTTPS)

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

Caddyfile (e.g. `/etc/caddy/Caddyfile`):

```text
gooverchat.yourdomain.com {
    reverse_proxy localhost:3000
}
```

```bash
sudo systemctl reload caddy
```

## 9. Backups (Postgres)

Cron script (e.g. `/home/gooverchat/backup-db.sh`):

```bash
#!/bin/bash
BACKUP_DIR=/home/gooverchat/backups
mkdir -p "$BACKUP_DIR"
docker exec gooverchat-postgres-1 pg_dump -U gooverchat gooverchat | gzip > "$BACKUP_DIR/gooverchat_$(date +%Y%m%d_%H%M).sql.gz"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +7 -delete
```

```bash
chmod +x /home/gooverchat/backup-db.sh
crontab -e
# Add: 0 2 * * * /home/gooverchat/backup-db.sh
```

Restore:

```bash
gunzip -c backups/gooverchat_YYYYMMDD_HHMM.sql.gz | docker exec -i gooverchat-postgres-1 psql -U gooverchat gooverchat
```

## 10. Monitoring and health

- Health endpoint: `GET https://gooverchat.yourdomain.com/api/health`
- Logs: `docker compose -f docker-compose.prod.yml logs -f app`
- Optionally ship logs to a central logger or use a simple cron that checks `/api/health` and alerts on non-200.

## 11. Update strategy

```bash
cd /home/gooverchat/app
git pull
docker compose -f docker-compose.prod.yml build app
docker compose -f docker-compose.prod.yml run --rm app npx prisma migrate deploy --schema=../../prisma/schema.prisma
docker compose -f docker-compose.prod.yml up -d
```

Run migrations from the app container (or a one-off container with the same env and Prisma schema).

## 12. Security notes

- **Rotate secrets** periodically (JWT, DB password); update `.env` and restart services.
- **Least privilege:** DB user only needs access to the app database; no superuser for the app.
- **DB user:** Create a dedicated user (e.g. `gooverchat`) with limited privileges; avoid using `postgres` superuser for the app.
- Keep OS and Docker images updated: `sudo apt update && sudo apt upgrade -y`, and rebuild images periodically.
