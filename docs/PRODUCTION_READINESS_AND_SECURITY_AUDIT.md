# GooverChat Remake – Production Readiness & Security Audit

**Auditor role:** Principal Engineer + Security Lead  
**Scope:** Full production readiness + security hardening  
**Date:** 2025-02-10

---

## 1. Architecture Map

### 1.1 Entry points

| Type | Location | Purpose |
|------|----------|--------|
| **Next.js app** | `apps/web/` | SPA + API routes; custom server in prod |
| **Custom HTTP server** | `apps/web/server.js` | Wraps Next.js `getRequestHandler()`, attaches Socket.IO |
| **Socket.IO server** | `apps/web/src/lib/socket/server.js` | Path `/api/socket`; CORS from `CORS_ORIGINS` |
| **API routes** | `apps/web/src/app/api/**/*.ts` | Auth, conversations, messages, health, etc. |
| **Middleware** | `apps/web/src/middleware.ts` | **Matcher: `/api/:path*` only** – pages do not get security headers |

### 1.2 Auth flow

- **Login:** `POST /api/auth/login` – Zod `loginSchema`, auth rate limit (IP), Argon2 verify, JWT access + refresh, session created with **hashed** refresh token in DB (`apps/web/src/lib/auth.ts` `createSession`), cookies: `refreshToken` (httpOnly, secure from `COOKIE_SECURE`), `accessToken` (15m).
- **Refresh:** `POST /api/auth/refresh` – reads `refreshToken` from cookie or body, `findSessionByRefreshToken` (see issues below), deletes old session, issues new access + refresh, sets cookies. **No rate limit on refresh.**
- **Logout:** `POST /api/auth/logout` – reads cookie refresh + `getAuth()`; finds session by iterating user’s sessions and argon2.verify, deletes that session; clears both cookies.
- **Cookies:** `httpOnly: true`, `secure: process.env.COOKIE_SECURE === 'true'`, `sameSite: 'lax'`, `path: '/'`. **Production must set `COOKIE_SECURE=true` and `COOKIE_DOMAIN` if using subdomain.**
- **Socket token:** `GET /api/auth/socket-token` – returns current `accessToken` from cookie. **No rate limit** – can be used to harvest tokens if an attacker has a session.

### 1.3 Realtime (Socket.IO) flow

- **Connect:** Client fetches token from `/api/auth/socket-token`, then `io(origin, { path: '/api/socket', auth: { token } })`. Server middleware in `server.js` uses `auth-verify.js` to verify JWT; sets `socket.userId`, `socket.userEmail`.
- **Rooms:** On connect, socket joins `user:${userId}`. Client emits `conversation:join` / `conversation:leave` with `conversationId`; server does **no membership check** – any authenticated user can join any room by ID.
- **Events:** `typing:start` / `typing:stop` broadcast to `conversation:${conversationId}`. `presence:update` (online/offline) broadcast to all. `presence:initial` sends all connected userIds to new socket.
- **Messages:** Messages are **not** sent over Socket.IO. They are created via `POST /api/conversations/[id]/messages` (authorization enforced there). So realtime is presence + typing only; no server-side message broadcast or ack/dedupe on socket.

### 1.4 Data flow

- **Postgres (Prisma):** Users, sessions, conversations, members, messages, reactions, deliveries, read state, notifications, reports, audit logs, etc. Schema: `prisma/schema.prisma`. Indexes present on `(conversationId, createdAt)` for messages, membership lookups, etc.
- **Redis:** Used for rate limiting (`apps/web/src/lib/rate-limit.ts`) and optionally Socket.IO adapter (`SOCKET_IO_REDIS_URL`). No application message or session storage in Redis beyond rate-limit keys and Socket.IO pub/sub when configured.

---

## 2. Launch verdict

**Verdict: ⚠️ Ready with fixes**

The app has solid foundations: Argon2 password hashing, JWT access/refresh with session storage, membership checks on most conversation/message API routes, Zod validation on key inputs, and no raw SQL. However, **several blockers and important issues must be fixed before a safe public launch**: (1) **Socket.IO room join has no authorization** – any logged-in user can join any `conversationId` and receive typing/presence for conversations they are not in. (2) **Forward message API is IDOR** – the server does not verify that the user is a member of the message’s conversation, so users can forward messages from conversations they cannot read. (3) **Password reset flow** stores a raw token in `Session.refreshTokenHash` and **reset-password** iterates all sessions in the DB with no rate limit, causing performance and brute-force risk. (4) **Refresh token lookup** loads all sessions from the DB then verifies with Argon2, which does not scale and is unsafe. (5) **Next.js and dependencies** have known critical/high vulnerabilities (authorization bypass in middleware, DoS, etc.). (6) **JWT and cookie security** depend on env (no default-block in prod for weak secrets, `COOKIE_SECURE` must be true in production). (7) **Security headers** and **HSTS** apply only to `/api/*` (middleware matcher), not to document pages. (8) **Health check** exposes internal status (DB/Redis) to unauthenticated callers – acceptable for readiness but should be considered for info disclosure. Addressing the authorization and auth/reset issues plus upgrading Next.js and tightening config yields a “ready with fixes” state; without these fixes the verdict would be **not ready**.

---

## 3. Top 10 risks (ranked)

1. **Socket.IO `conversation:join` has no membership check** – Any authenticated user can join any room and receive typing/presence for private conversations. **Where:** `apps/web/src/lib/socket/server.js` lines 51–53.
2. **Forward message IDOR** – User can forward a message by ID without being a member of the source conversation. **Where:** `apps/web/src/app/api/messages/[id]/forward/route.ts` – no check that `msg.conversationId` membership includes `payload.sub`.
3. **Password reset stores raw token and reset iterates all sessions** – Forgot-password stores plain token in `refreshTokenHash`; reset-password does `findMany({ where: {} })` and compares plain token. No rate limit on reset. **Where:** `forgot-password/route.ts` lines 16–23, `reset-password/route.ts` lines 9–17.
4. **Refresh token lookup loads all sessions** – `findSessionByRefreshToken` uses `findMany({ where: { userId: { not: undefined } } })` (all sessions) then Argon2.verify in a loop. **Where:** `apps/web/src/lib/auth.ts` lines 107–115.
5. **Next.js critical/high vulnerabilities** – Including authorization bypass in middleware (critical), DoS, SSRF. **Where:** `apps/web` uses `next@14.2.18`; patched in 14.2.25+ and others.
6. **JWT secrets default in code** – If `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are unset, dev defaults are used. **Where:** `apps/web/src/lib/auth.ts` lines 6–11, `apps/web/src/lib/socket/auth-verify.js` lines 3–5.
7. **Security headers only on API** – Middleware `config.matcher` is `/api/:path*`, so HTML pages get no X-Frame-Options, X-Content-Type-Options, Referrer-Policy. **Where:** `apps/web/src/middleware.ts` line 24.
8. **Report message without conversation membership** – User can report any message by ID (e.g. from another conversation). **Where:** `apps/web/src/app/api/report/message/route.ts` – no check that reporter is in `msg.conversationId`.
9. **Socket-token and refresh endpoints unrate-limited** – Token harvesting or refresh abuse. **Where:** `GET /api/auth/socket-token`, `POST /api/auth/refresh` – no rate limit.
10. **Docker runs as root** – `apps/web/Dockerfile` has no `USER` directive. **Where:** `apps/web/Dockerfile` runner stage.

---

## 4. Checklist

### A) MUST FIX before launch (blockers)

| # | Finding | Risk | Where | Fix | Verify |
|---|--------|------|--------|-----|--------|
| A1 | Socket `conversation:join` accepts any `conversationId` with no DB check | Any user can join any room and receive typing/presence for private chats | `apps/web/src/lib/socket/server.js` lines 51–53 | Before `socket.join(\`conversation:${conversationId}\`)`, query Prisma (or a shared DB/Redis check) for `ConversationMember` where `conversationId` and `userId: socket.userId`. If no member, call `next(new Error('forbidden'))` or ignore join. | From second account, open socket, emit `conversation:join` with another user’s conversation ID; confirm server does not add to room (or client gets error). |
| A2 | Forward message does not verify user is in source conversation | User can forward messages from conversations they are not in (IDOR) | `apps/web/src/app/api/messages/[id]/forward/route.ts` lines 16–22 | After fetching `msg`, check membership: `const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: msg.conversationId, userId: payload.sub } } }); if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });` | Call forward with a messageId from a conversation the user is not in; expect 404. |
| A3 | Reset-password scans all sessions and has no rate limit | DoS and brute-force on reset tokens; possible token guessing | `apps/web/src/app/api/auth/reset-password/route.ts` lines 9–17 | (1) Use a dedicated PasswordResetToken table (token hash, userId, expiresAt) or store hashed token in Session and query by userId + expiresAt. (2) Rate limit by IP and by token (e.g. 5 attempts per token then invalidate). (3) Never iterate all sessions. | Run reset-password 20 times in a row; confirm 429. Confirm reset only works for token tied to that user. |
| A4 | Forgot-password stores raw token in `Session.refreshTokenHash` | Token stored in plaintext; conflates login sessions with reset tokens | `apps/web/src/app/api/auth/forgot-password/route.ts` lines 17–23 | Use a separate table (e.g. `PasswordResetToken`: id, userId, tokenHash, expiresAt) and store `argon2.hash(token)`. In reset-password, look up by userId and verify hash; delete after use. | Inspect DB: no raw reset token in Session or new table; reset link works once. |
| A5 | findSessionByRefreshToken loads all sessions | Performance collapse and unnecessary exposure of all sessions | `apps/web/src/lib/auth.ts` lines 107–115 | Store a lookup key: e.g. store `hash(refreshToken).slice(0, 16)` in Session as `tokenPrefix` and index it, or use a dedicated Session lookup by a deterministic part of the token. Then fetch only sessions for that user (e.g. by tokenPrefix + userId). Worst case: fetch by userId and verify in memory (not all sessions). | After 10k sessions, refresh once; response time should not scale with total session count. |
| A6 | Next.js critical/high vulnerabilities (middleware auth bypass, DoS, etc.) | Auth bypass, DoS, SSRF in production | `apps/web/package.json` (next version) | Upgrade Next.js to at least 14.2.35 (or latest 14.x patched). Run `pnpm update next` and fix any breaking changes. Re-run `pnpm audit`. | `pnpm audit` shows no critical/high for next; run e2e and smoke tests. |
| A7 | JWT secrets can fall back to dev defaults in production | If env is misconfigured, production uses weak secrets | `apps/web/src/lib/auth.ts` lines 6–11, `auth-verify.js` lines 3–5 | In production (`NODE_ENV === 'production'`), throw at startup if `!process.env.JWT_ACCESS_SECRET || process.env.JWT_ACCESS_SECRET === 'dev-access-secret-min-32-characters-long'` (and same for refresh). Use a small startup module or check in both auth.ts and auth-verify. | Set NODE_ENV=production and omit JWT_ACCESS_SECRET; app must fail to start. |
| A8 | COOKIE_SECURE false in production example | Cookies sent over HTTP in prod | `.env.production.example` line 28 | Set `COOKIE_SECURE=true` in production and document that HTTPS is required. In code, consider enforcing `secure: true` when `NODE_ENV === 'production'`. | Deploy with HTTPS; inspect Set-Cookie and confirm Secure flag. |

### B) SHOULD FIX soon (important)

| # | Finding | Risk | Where | Fix | Verify |
|---|--------|------|--------|-----|--------|
| B1 | Report message allows reporting any message by ID | Privacy/moderation abuse; report messages from convos user is not in | `apps/web/src/app/api/report/message/route.ts` lines 15–18 | After fetching `msg`, check that reporter is a member: `const member = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: msg.conversationId, userId: payload.sub } } }); if (!member) return NextResponse.json({ error: 'Not found' }, { status: 404 });` | Report a message from a conversation the user is not in; expect 404. |
| B2 | Security headers not applied to document routes | Clickjacking, MIME sniffing on pages | `apps/web/src/middleware.ts` config line 24 | Change matcher to run on all routes, e.g. `matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']`, or add headers in `next.config.js` headers. | Load `/chat` and inspect response headers for X-Frame-Options, X-Content-Type-Options. |
| B3 | No rate limit on refresh or socket-token | Token harvesting, refresh abuse | `apps/web/src/app/api/auth/refresh/route.ts`, `apps/web/src/app/api/auth/socket-token/route.ts` | Apply a per-IP (and optionally per-user) rate limit using `rateLimit()` from `rate-limit.ts` (e.g. 30 refresh per minute per IP, 60 socket-token per minute per IP). | Send 100 refresh requests from same IP; expect 429 after limit. |
| B4 | Verify-email uses Session and raw token; no rate limit | Same table misuse as reset; enumeration / brute force | `apps/web/src/app/api/auth/verify-email/route.ts` lines 9–12 | Use a dedicated email verification token table (hashed token, userId, expiresAt) and rate limit by IP. | Same pattern as reset: no Session misuse, rate limit returns 429. |
| B5 | Delete message “for me” does not check conversation membership | Minor: user could hide a message by ID they never had access to | `apps/web/src/app/api/messages/[id]/delete/route.ts` lines 16–22 | Optional: ensure user is member of `msg.conversationId` before allowing delete-for-me. | Call delete scope=me for message in convo user is not in; expect 404. |
| B6 | Caddy/Nginx examples do not set HSTS or security headers | Browsers may not enforce HTTPS; missing headers on proxy | `infra/caddy/Caddyfile.example`, `infra/nginx/gooverchat.conf.example` | In Caddy: enable automatic HTTPS and headers. In Nginx: add `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;` and other headers if not set by app. | Curl -I https://yourdomain; see Strict-Transport-Security. |
| B7 | Register leaks EMAIL_TAKEN vs USERNAME_TAKEN | Account enumeration | `apps/web/src/app/api/auth/register/route.ts` lines 47–48 | Return a single generic message for both, e.g. `return NextResponse.json({ error: 'Email or username already in use' }, { status: 409 });` | Register with existing email then existing username; same message and status. |
| B8 | Presence broadcasts to all sockets | Any connected user receives every user’s online/offline | `apps/web/src/lib/socket/server.js` lines 43, 77 | Consider emitting presence only to `user:*` rooms (friends) or to conversation rooms the user shares with the connecting user. Depends on product: if “everyone” is intentional, document; else restrict. | Document or restrict who receives presence:update. |

### C) NICE TO HAVE (later)

| # | Finding | Risk | Where | Fix | Verify |
|---|--------|------|--------|-----|--------|
| C1 | No CSP header | XSS defense in depth | `apps/web/src/middleware.ts` or next.config | Add Content-Security-Policy (e.g. default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' if Next needs it; connect-src 'self' wss: for socket). | Check response header; adjust for inline scripts if needed. |
| C2 | Health returns DB/Redis status to unauthenticated callers | Info disclosure to attackers | `apps/web/src/app/api/health/route.ts` | Optionally require a shared secret header or only expose “ok”/“degraded” without details in production; or restrict /api/health to internal IPs at proxy. | Call /api/health without auth; decide if checks.database/redis are acceptable. |
| C3 | Dockerfile runs as root | Container escape impact | `apps/web/Dockerfile` runner stage | Add `RUN adduser -D appuser && chown -R appuser:appuser /app/apps/web` and `USER appuser`. Ensure wget for healthcheck is available or use node for health. | Run container and `docker exec` as non-root. |
| C4 | No socket event rate limit (typing, join) | Spam/DoS via many join or typing events | `apps/web/src/lib/socket/server.js` | Rate limit per socket: e.g. max 10 conversation:join per minute, 20 typing:start per minute per conversation. Use in-memory or Redis. | Emit typing:start 100 times in 1s; expect throttling or disconnect. |
| C5 | Message edit does not verify conversation membership | Defense in depth (sender already implies membership) | `apps/web/src/app/api/messages/[id]/route.ts` | Add membership check for msg.conversationId and payload.sub. | Optional test. |
| C6 | No env validation at startup | Misconfiguration in production | App entry (server.js, or a shared module) | Use zod or similar to validate required env (DATABASE_URL, JWT_ACCESS_SECRET, etc.) and fail fast. | Remove required env; app should exit on start. |
| C7 | Logout only deletes one matching session | If multiple sessions share same refresh (bug), only one deleted | `apps/web/src/app/api/auth/logout/route.ts` lines 9–19 | Already correct if one refresh token per session; document. Optionally delete all sessions for that refresh token hash. | N/A. |
| C8 | N+1 possible in conversation list | Performance with many convos | `apps/web/src/app/api/conversations/route.ts` | Last message is fetched via `messages: { take: 1, orderBy }` per conversation; Prisma may optimize. Monitor and add cursor pagination if needed. | Load conversation list with 50+ convos; check query count. |

---

## 5. Minimal hardening patch list (smallest set to be acceptable)

Do these in order so the app is acceptable for launch:

1. **Socket room authorization** – In `apps/web/src/lib/socket/server.js`, before joining `conversation:${conversationId}`, verify membership (Prisma or cached) for `socket.userId`. If not member, do not join (and optionally emit error to client).
2. **Forward message authorization** – In `apps/web/src/app/api/messages/[id]/forward/route.ts`, after `msg = await prisma.message.findUnique(...)`, add conversation membership check for `payload.sub` and `msg.conversationId`; return 404 if not member.
3. **Password reset** – Introduce a dedicated `PasswordResetToken` (or similar) table with hashed token and expiry; use it in forgot-password and reset-password. Add rate limit on reset-password (per IP). Remove use of Session for reset tokens.
4. **Session lookup** – Change `findSessionByRefreshToken` to not load all sessions: e.g. store a short prefix of the token hash in Session and query by that, or by userId and verify in memory (limit to recent N sessions per user if needed).
5. **Next.js upgrade** – Upgrade to Next.js >= 14.2.35 (or latest 14.x with no critical/high). Run tests and fix any breaks.
6. **JWT secrets in production** – In auth module(s), if `NODE_ENV === 'production'` and secrets are missing or equal to dev defaults, throw at startup.
7. **COOKIE_SECURE** – Set `COOKIE_SECURE=true` in production env and document; optionally enforce in code when NODE_ENV is production.
8. **Rate limit refresh and socket-token** – Add rate limit to `POST /api/auth/refresh` and `GET /api/auth/socket-token` (per IP).

After these, do report-message membership check (B1) and security headers on all routes (B2) if possible before launch.

---

## 6. Pre-launch smoke test plan (manual)

Execute with two test users (A and B) and a private conversation between them.

1. **Auth**
   - Register new user, confirm redirect and cookie set.
   - Logout, confirm cookies cleared; access /chat redirects to login.
   - Login with wrong password 15 times from same IP; confirm 429.
   - Login with valid credentials; confirm access to /chat.
   - Call `POST /api/auth/refresh` with cookie; confirm new access token in response/cookie.
2. **Conversations**
   - User A creates DM with B; both see conversation.
   - User A opens conversation; confirm message list loads (cursor pagination if applicable).
   - User B opens same conversation; confirm same messages (no cross-convo leak).
3. **Messages**
   - User A sends message; B sees it (and vice versa).
   - User A edits own message within window; B sees edit.
   - User A deletes for self; A no longer sees it, B still sees it.
   - User A deletes for everyone (own message); both no longer see content.
   - User B tries delete for everyone on A’s message; expect 403.
4. **Authorization**
   - With B’s token, call `GET /api/conversations/{convId}/messages` where convId is a conversation B is not in (use A’s other convo id); expect 404.
   - With B’s token, call `POST /api/conversations/{convId}/messages` with same invalid convId; expect 404.
   - With B’s token, call `POST /api/messages/{messageId}/forward` with body `{ conversationIds: [B's conv] }` where messageId is from a conversation B is not in; expect 404 after fix.
5. **Socket**
   - User A and B both online; A opens DM with B; B sees A’s typing when A types.
   - From a second browser (user C), with C’s token, emit `conversation:join` with A–B conversation id; after fix, C must not receive typing/presence for that room (or get error).
6. **Health**
   - `GET /api/health` returns 200 and status healthy when DB and Redis are up; returns 503 when DB is down (if applicable).
7. **HTTPS / cookies**
   - Over HTTPS in prod, confirm Set-Cookie has `Secure` and `HttpOnly` for access and refresh.
8. **Dependencies**
   - Run `pnpm audit`; no critical or high for next and key deps.

---

## 7. Post-launch monitoring checklist (first week)

- **Errors** – Monitor 5xx and 4xx rates (e.g. /api/auth/*, /api/conversations/*, /api/messages/*). Alert on spike.
- **Auth** – Watch login/refresh failure rate and 429 rate limit responses; adjust limits if needed.
- **Socket** – Monitor connect/disconnect and `connect_error` (e.g. invalid_token); watch for spikes in joins or typing events per socket.
- **DB** – Slow query log and connection pool usage; watch for full table scans (e.g. session lookup).
- **Redis** – Memory and latency; rate-limit key growth.
- **Secrets** – Confirm no JWT or DB credentials in logs or error responses.
- **CORS** – Confirm only allowed origins in production; no wildcard in responses.
- **Backups** – Confirm Postgres backups run and one restore test is done (document in DEPLOY_*.md).
- **Incident** – Document runbook for: “user reports seeing another user’s messages” (check authz on messages and socket rooms); “mass 429” (rate limit tuning); “app slow after many users” (session lookup, N+1).

---

## 8. Dependency audit (pnpm audit)

Run: `pnpm audit`. At audit date:

- **Critical:** Next.js Authorization Bypass in Middleware (next 14.0.0–14.2.24) – upgrade to >=14.2.25.
- **High:** Next.js DoS (Server Components, deserialization), glob command injection (via eslint-config-next).
- **Moderate/Low:** Next.js cache/SSRF/image issues; esbuild (dev deps).

**Action:** Upgrade `next` to at least 14.2.35 (or latest 14.x). Re-run `pnpm audit` and fix or accept remaining findings. Dev-only (esbuild/vitest) can be lower priority.

---

## 9. Secrets and config

- **.gitignore** – `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development` are ignored; no secrets should be committed. **Verify:** `git status` and CI do not expose env files.
- **Docker** – `docker-compose.prod.yml` passes env via `env_file: .env` and `environment:`; no secrets in the file. **Verify:** Host `.env` is not in image and not logged.
- **Env validation** – Not implemented at startup. **Recommendation:** Validate required vars (e.g. DATABASE_URL, JWT_ACCESS_SECRET) and fail fast in production (see C6).

---

## 10. UNKNOWNs (verify outside code)

- **Email sending** – Forgot-password has `TODO: send email with reset link`. **Verify:** Configure SMTP and test reset flow end-to-end; confirm link contains token and expires.
- **Backups** – No backup/restore script in repo. **Verify:** Document and run Postgres backup (e.g. pg_dump) and restore once before launch.
- **Reverse proxy** – Nginx/Caddy examples do not show WebSocket explicitly (Caddy’s reverse_proxy supports it). **Verify:** With HTTPS, confirm Socket.IO connects and stays connected (wss).
- **Multi-instance** – If running multiple app instances, `SOCKET_IO_REDIS_URL` must be set for Socket.IO adapter. **Verify:** Two instances behind load balancer; same user from two tabs sees consistent presence.
- **File uploads** – S3/MinIO env present; no upload API found in audit. **Verify:** If uploads are added, apply file type/size limits and authz on download; no path traversal.

---

*End of audit.*
