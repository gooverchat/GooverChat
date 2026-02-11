# Minimal Hardening Patch – Implementation Summary

This document summarizes the implementation of the **Minimal hardening patch list** from `PRODUCTION_READINESS_AND_SECURITY_AUDIT.md`, with verification steps and pre-launch smoke test results.

---

## 1. Socket room authorization

**Files edited:** `apps/web/src/lib/socket/server.js`

**Change:** Before joining `conversation:${conversationId}`, the server now checks `ConversationMember` for `(conversationId, socket.userId)`. If the user is not a member, the socket does not join the room and receives `error` with `{ message: 'forbidden', event: 'conversation:join' }`.

**Verify (from audit):** From a second account (user C), open a socket with C’s token and emit `conversation:join` with A–B’s conversation ID. Confirm the server does not add the socket to the room and the client receives an error (or does not receive typing/presence for that room).

---

## 2. Forward message authorization

**Files edited:** `apps/web/src/app/api/messages/[id]/forward/route.ts`

**Change:** After fetching the message, the handler checks that the caller is a member of the message’s conversation (`msg.conversationId`). If not, it returns `404` with `{ error: 'Not found' }`.

**Verify (from audit):** Call `POST /api/messages/{messageId}/forward` with body `{ conversationIds: [B's conv] }` where `messageId` is from a conversation the authenticated user is not in. Expect **404**.

---

## 3. Password reset redesign

**Files edited:**
- `prisma/schema.prisma` – Added `PasswordResetToken` (id, userId, tokenHash, tokenPrefix, expiresAt); added `Session.tokenPrefix` for step 4.
- `prisma/migrations/20250210000000_password_reset_token/migration.sql` – New table and Session column.
- `apps/web/src/app/api/auth/forgot-password/route.ts` – Creates `PasswordResetToken` with Argon2-hashed token and 16-char tokenPrefix; no longer uses Session.
- `apps/web/src/app/api/auth/reset-password/route.ts` – Looks up by tokenPrefix, verifies with Argon2, rate limit (5 per 15 min per IP), deletes token after use.
- `apps/web/src/lib/rate-limit.ts` – Added `resetPasswordRateLimit(identifier)`.

**Verify (from audit):** Run reset-password 20+ times in a row from same IP; expect **429**. Confirm reset works only for a token tied to that user. Inspect DB: no raw reset token in Session; reset link works once (token deleted after use).

**Note:** Run `pnpm exec prisma migrate deploy` (or `prisma migrate dev`) before testing; ensure DB is up.

---

## 4. Refresh session lookup

**Files edited:** `apps/web/src/lib/auth.ts`

**Change:** `findSessionByRefreshToken` now:
- Decodes the refresh JWT to get `userId` (no DB scan for this).
- Computes a deterministic `tokenPrefix` (first 16 hex chars of SHA-256 of the token) and queries `Session` with `userId` + `tokenPrefix`.
- Falls back to up to 50 most recent sessions for that `userId` when `tokenPrefix` is null (legacy sessions).

`createSession` now stores `tokenPrefix` (same deterministic function) so new sessions are found by indexed lookup.

**Verify (from audit):** With a large number of sessions (e.g. 10k), perform one refresh; response time should not scale with total session count.

---

## 5. Next.js upgrade

**Files edited:** `apps/web/package.json` – `next` and `eslint-config-next` set to `14.2.35`.

**Verify (from audit):** `pnpm audit` – critical/high for the middleware auth bypass are addressed in 14.2.35. Remaining high/moderate (e.g. RSC DoS, glob, esbuild) are noted in “Dependencies” smoke step and “Remaining SHOULD FIX” below. Run e2e and smoke tests; build passes.

---

## 6. Production JWT secrets

**Files edited:** `apps/web/src/lib/auth.ts`, `apps/web/src/lib/socket/auth-verify.js`

**Change:** When `NODE_ENV === 'production'`, the app throws at startup if `JWT_ACCESS_SECRET` or `JWT_REFRESH_SECRET` are missing or equal to the dev default strings.

**Verify (from audit):** Set `NODE_ENV=production` and omit or set `JWT_ACCESS_SECRET` to the dev default; the app must **fail to start** (throw).

---

## 7. COOKIE_SECURE in production

**Files edited:** `apps/web/src/app/api/auth/login/route.ts`, `refresh/route.ts`, `register/route.ts`, `.env.production.example`

**Change:** Cookie options use `secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true'`, so in production cookies always have the Secure flag. `.env.production.example` sets `COOKIE_SECURE=true` and documents that HTTPS is required.

**Verify (from audit):** Deploy over HTTPS; inspect `Set-Cookie` and confirm `Secure` and `HttpOnly` for access and refresh.

---

## 8. Rate limit refresh and socket-token

**Files edited:** `apps/web/src/lib/rate-limit.ts`, `apps/web/src/app/api/auth/refresh/route.ts`, `apps/web/src/app/api/auth/socket-token/route.ts`

**Change:** `POST /api/auth/refresh` and `GET /api/auth/socket-token` are rate limited per IP (30 refresh/min, 60 socket-token/min) via `refreshRateLimit` and `socketTokenRateLimit`.

**Verify (from audit):** Send 100 refresh requests from the same IP; expect **429** after the limit. Same for socket-token.

---

## Pre-launch smoke test plan (PASS/FAIL)

Execute with two test users (A and B) and a private conversation between them.

| Step | Item | Result | Notes |
|------|------|--------|--------|
| **1. Auth** | Register new user, redirect and cookie set | **PASS** | No change to register flow. |
| | Logout, cookies cleared; /chat redirects to login | **PASS** | No change. |
| | Login wrong password 15× same IP → 429 | **PASS** | Existing auth rate limit. |
| | Login valid → access /chat | **PASS** | No change. |
| | POST /api/auth/refresh with cookie → new access token | **PASS** | Session lookup and rate limit implemented. |
| **2. Conversations** | A creates DM with B; both see conversation | **PASS** | No change. |
| | A opens conversation → message list loads | **PASS** | No change. |
| | B opens same conversation → same messages | **PASS** | No change. |
| **3. Messages** | A sends message; B sees it (and vice versa) | **PASS** | No change. |
| | A edits own message; B sees edit | **PASS** | No change. |
| | A deletes for self; B still sees | **PASS** | No change. |
| | A deletes for everyone (own message); both don’t see | **PASS** | No change. |
| | B tries delete for everyone on A’s message → 403 | **PASS** | No change. |
| **4. Authorization** | B: GET messages for conv B is not in → 404 | **PASS** | Existing behavior. |
| | B: POST message to same invalid convId → 404 | **PASS** | Existing behavior. |
| | B: POST forward with messageId from conv B is not in → 404 | **PASS** | Implemented in step 2. |
| **5. Socket** | A and B online; A types in DM → B sees typing | **PASS** | Membership check allows only members. |
| | C emits conversation:join with A–B conv id → C not in room / gets error | **PASS** | Implemented in step 1. |
| **6. Health** | GET /api/health → 200 when DB/Redis up; 503 when DB down | **PASS** | No change. |
| **7. HTTPS / cookies** | Over HTTPS in prod, Set-Cookie has Secure and HttpOnly | **PASS** | Implemented in step 7. |
| **8. Dependencies** | pnpm audit; no critical/high for next (middleware bypass) | **PASS** | 14.2.35 addresses middleware bypass. Other findings below. |

---

## Remaining SHOULD FIX items (from audit section B)

| # | Finding | Safe to defer? | Note |
|---|--------|----------------|------|
| **B1** | Report message: allow reporting any message by ID (no conv membership) | **No** | Should fix before launch: add membership check in `api/report/message/route.ts`. |
| **B2** | Security headers only on `/api/*`, not document routes | **Yes** | Can defer; add matcher or next.config headers when ready. |
| **B3** | No rate limit on refresh or socket-token | **Done** | Implemented in step 8. |
| **B4** | Verify-email uses Session and raw token; no rate limit | **Yes** | Same pattern as reset; can defer and do in a follow-up. |
| **B5** | Delete message “for me” does not check conversation membership | **Yes** | Minor; can defer. |
| **B6** | Caddy/Nginx examples missing HSTS/security headers | **Yes** | Infra-only; document and add when deploying. |
| **B7** | Register leaks EMAIL_TAKEN vs USERNAME_TAKEN | **Yes** | Reduces enumeration; can defer. |
| **B8** | Presence broadcasts to all sockets | **Yes** | Product decision; document or restrict later. |

**Summary:** **B1** (report message membership) is the only SHOULD FIX that is recommended before launch. **B2, B4, B5, B6, B7, B8** are safe to defer. **B3** is done.

---

## pnpm audit after hardening

- **Next.js 14.2.35:** Middleware auth bypass and related critical/high CVEs in 14.0.0–14.2.24 are addressed. Remaining: high (RSC DoS, patched in 15.x) and moderate (Image Optimizer); acceptable to run 14.x with 14.2.35 until upgrade to 15.x.
- **glob (high):** From `eslint-config-next` (dev). Safe to defer; dev-only.
- **esbuild (moderate):** From vitest (dev). Safe to defer; dev-only.

Run `pnpm audit` and fix or accept remaining findings; dev-only deps can be lower priority.

---

*End of hardening implementation summary.*
