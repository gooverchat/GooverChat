# Reverse proxy and deployment modes

GooverChat can be used in two ways on the Ubuntu Server laptop:

---

## Mode 1: LAN-only

- **Access:** `http://SERVER_LAN_IP:3000`
- **No reverse proxy.** The app listens on port 3000; UFW must allow `3000/tcp`.
- **Use when:** You only need access on your local network (e.g. home lab).

Ensure in `.env` on the server:

- `NEXT_PUBLIC_APP_URL=http://SERVER_LAN_IP:3000`
- `CORS_ORIGINS=http://SERVER_LAN_IP:3000`

---

## Mode 2: Domain + HTTPS (Caddy or Nginx)

- **Access:** `https://gooverchat.yourdomain.com`
- **Reverse proxy** terminates SSL (e.g. Let’s Encrypt) and forwards to the app at `http://localhost:3000`.
- **Use when:** You have a domain and want HTTPS.

### Caddy (preferred: automatic HTTPS)

1. Install Caddy on the server (see Caddy docs).
2. Copy `infra/caddy/Caddyfile.example` to `/etc/caddy/Caddyfile` (or your Caddy config path).
3. Set your domain and adjust if needed.
4. Reload Caddy: `sudo systemctl reload caddy`.

The app container still listens on 3000; Caddy proxies to `http://127.0.0.1:3000`. No need to expose 3000 to the internet if you don’t want (you can bind the app to 127.0.0.1 in compose or rely on UFW and only allow 80/443).

### Nginx + Let’s Encrypt

1. Install Nginx and certbot: `sudo apt install nginx certbot python3-certbot-nginx`
2. Copy `infra/nginx/gooverchat.conf.example` to `/etc/nginx/sites-available/gooverchat` and set your domain.
3. Enable site, get certificate, reload:  
   `sudo ln -s /etc/nginx/sites-available/gooverchat /etc/nginx/sites-enabled/`  
   `sudo certbot --nginx -d gooverchat.yourdomain.com`  
   `sudo nginx -t && sudo systemctl reload nginx`

---

## Summary

| Mode   | URL format                        | Reverse proxy | Config in `infra/`      |
|--------|-----------------------------------|---------------|--------------------------|
| LAN    | `http://SERVER_LAN_IP:3000`       | None          | —                        |
| Domain | `https://gooverchat.yourdomain.com` | Caddy or Nginx | `caddy/`, `nginx/` |
