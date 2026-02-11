# File-by-file explanation

## Root

| File | Purpose |
|------|--------|
| `package.json` | Root workspace scripts: `dev`, `build`, `db:migrate`, `db:seed`, `docker:dev`, etc. |
| `pnpm-workspace.yaml` | Defines workspace packages: `apps/*`, `packages/*`. |
| `tsconfig.base.json` | Shared TypeScript options for the monorepo. |
| `.env.example` | Documented environment variables; copy to `.env` and fill. |
| `.gitignore` | Ignores `node_modules`, `.env`, build outputs, logs. |
| `docker-compose.dev.yml` | Local stack: Postgres, Redis, MinIO. |
| `docker-compose.prod.yml` | Production stack: app, Postgres, Redis. |

## prisma/

| File | Purpose |
|------|--------|
| `schema.prisma` | Full data model: User, Session, Friendship, Conversation, Message, Notification, etc. |
| `migrations/*` | SQL migrations applied with `prisma migrate deploy`. |

## packages/shared/

| File | Purpose |
|------|--------|
| `package.json` | Package `@gooverchat/shared`; build outputs `dist/`. |
| `src/index.ts` | Re-exports schemas and constants. |
| `src/constants.ts` | Limits, MIME types, enums (e.g. message edit window, pagination). |
| `src/schemas/*.ts` | Zod schemas for auth, user, conversation, message, friend (validation + types). |

## apps/web/

| File | Purpose |
|------|--------|
| `package.json` | Next.js app deps; scripts: `dev` (custom server), `build`, `test`, `test:e2e`; Prisma schema/seed paths. |
| `next.config.js` | Next config; `transpilePackages` for shared; `output: 'standalone'`; external packages for Prisma/argon2. |
| `tailwind.config.ts` | Tailwind theme (colors, radius) and `tailwindcss-animate`. |
| `postcss.config.js` | Tailwind + Autoprefixer. |
| `tsconfig.json` | Extends base; path `@/*`; Next plugin. |
| `server.js` | Custom Node server: creates HTTP server, mounts Next.js handler and Socket.IO. |
| `Dockerfile` | Multi-stage: deps → build (shared, Prisma generate, Next build) → runner (run `node server.js`). |
| `vitest.config.ts` | Vitest config; `@` alias. |
| `playwright.config.ts` | Playwright base URL, webServer for dev, Chromium. |

## apps/web/src/

| Path | Purpose |
|------|--------|
| `lib/db.ts` | Prisma client singleton (dev hot-reload safe). |
| `lib/redis.ts` | Redis client for rate limit and (optionally) Socket.IO adapter. |
| `lib/auth.ts` | Password hash/verify (argon2), JWT create/verify (jose), register, findUserByEmail, session create/find/delete. |
| `lib/get-auth.ts` | `getAuth()` / `requireAuth()` using cookies and access token. |
| `lib/rate-limit.ts` | Redis-backed rate limit; `authRateLimit`, `messageRateLimit`. |
| `lib/socket/server.js` | Socket.IO server: auth via access token, `conversation:join/leave`, `typing:start/stop`, presence; optional Redis adapter. |
| `lib/socket/auth-verify.js` | CJS helper to verify JWT for Socket.IO (same secret as auth.ts). |
| `middleware.ts` | CORS (from `CORS_ORIGINS`), security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy); applied to `/api/*`. |

## apps/web/src/app/

| Path | Purpose |
|------|--------|
| `layout.tsx` | Root HTML and body. |
| `globals.css` | Tailwind; CSS variables for light/dark; print-only rules. |
| `page.tsx` | Landing: links to login, register, chat. |
| `(auth)/login/page.tsx` | Login form; POST `/api/auth/login`; redirect to `/chat`. |
| `(auth)/register/page.tsx` | Register form; POST `/api/auth/register`; redirect to `/chat`. |
| `chat/layout.tsx` | Requires auth (cookie); wraps with `ChatLayoutClient`. |
| `chat/ChatLayoutClient.tsx` | Desktop sidebar nav + mobile bottom tabs (Chats, Search, Friends, Notifications, Settings). |
| `chat/page.tsx` | Chat list page; header with search + “New chat”; `ChatList`. |
| `chat/ChatList.tsx` | Fetches `/api/conversations`; list of conversations with last message. |
| `chat/new/page.tsx` | New chat; if `?userId=` creates DM and redirects to `/chat/[id]`. |
| `chat/[id]/page.tsx` | Conversation page; renders `ConversationView`. |
| `chat/[id]/ConversationView.tsx` | Loads messages; compose form; send message; print link per message. |
| `chat/search/page.tsx` | Search users; GET `/api/users/search?q=`; link to start DM. |
| `chat/friends/page.tsx` | Friends list (from conversations members). |
| `chat/notifications/page.tsx` | Notifications list; GET `/api/notifications`; mark read. |
| `chat/settings/page.tsx` | Settings sections; sign out (POST `/api/auth/logout`). |
| `print/message/[messageId]/page.tsx` | Server: load message by id; render print view. |
| `print/message/[messageId]/PrintMessageView.tsx` | Print layout: app name, conversation, sender, content, timestamp, quoted; “Print” button (`window.print()`); print-only CSS. |

## apps/web/src/app/api/

| Path | Purpose |
|------|--------|
| `health/route.ts` | GET health: DB and Redis check; returns status and checks. |
| `docs/route.ts` | GET OpenAPI 3.0 JSON for main endpoints. |
| `auth/register/route.ts` | POST register; rate limit; create user + profile + settings; set access + refresh cookies. |
| `auth/login/route.ts` | POST login; rate limit; set cookies. |
| `auth/refresh/route.ts` | POST refresh; rotate refresh token; set new cookies. |
| `auth/logout/route.ts` | POST logout; clear session and cookies. |
| `auth/forgot-password/route.ts` | POST forgot password; rate limit; create reset token (email optional). |
| `auth/reset-password/route.ts` | POST reset password with token. |
| `auth/verify-email/route.ts` | POST verify email with token. |
| `users/search/route.ts` | GET search users by `q`. |
| `users/block/route.ts` | POST block user. |
| `users/unblock/route.ts` | POST unblock user. |
| `users/blocked/route.ts` | GET blocked list. |
| `friends/request/route.ts` | POST send friend request. |
| `friends/accept/route.ts` | POST accept friend request. |
| `friends/decline/route.ts` | POST decline friend request. |
| `friends/remove/route.ts` | POST remove friend. |
| `conversations/route.ts` | GET list conversations; POST create DM or group. |
| `conversations/[id]/route.ts` | GET conversation by id. |
| `conversations/[id]/members/route.ts` | POST add member (group). |
| `conversations/[id]/members/[userId]/route.ts` | DELETE remove member or leave. |
| `conversations/[id]/messages/route.ts` | GET messages (cursor pagination; exclude “deleted for me”); POST send message; rate limit. |
| `conversations/[id]/search/route.ts` | GET search messages in conversation. |
| `messages/[id]/route.ts` | PATCH edit message (within edit window). |
| `messages/[id]/delete/route.ts` | POST delete for me (MessageDeletedForUser) or for everyone (audit + soft delete). |
| `messages/[id]/react/route.ts` | POST add/remove reaction. |
| `messages/[id]/forward/route.ts` | POST forward to conversations. |
| `search/messages/route.ts` | GET global message search. |
| `notifications/route.ts` | GET notifications. |
| `notifications/[id]/read/route.ts` | POST mark read. |
| `settings/route.ts` | GET/PUT user settings. |
| `report/message/route.ts` | POST report message. |
| `report/user/route.ts` | POST report user. |
| `push/subscribe/route.ts` | POST save push subscription. |
| `push/unsubscribe/route.ts` | POST remove push subscription. |

## apps/web/prisma/

| File | Purpose |
|------|--------|
| `seed.ts` | Creates demo users (alice, bob), profiles, settings, friendship, DM, first message. |

## apps/web/e2e/

| File | Purpose |
|------|--------|
| `auth.spec.ts` | Playwright: home links; login success; login error. |
| `chat.spec.ts` | Playwright: chat list; open conversation; send message (after login). |

## apps/web/src/lib/auth.test.ts

| File | Purpose |
|------|--------|
| `auth.test.ts` | Vitest: hash and verify password. |
