FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @gooverchat/shared build
RUN cd apps/web && npx prisma generate --schema=../../prisma/schema.prisma
RUN pnpm --filter web build

FROM base AS runner
RUN apk add --no-cache wget
ENV NODE_ENV=production
WORKDIR /app/apps/web
COPY --from=builder /app/apps/web/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/server.js ./
COPY --from=builder /app/apps/web/src ./src
COPY --from=builder /app/apps/web/package.json ./
COPY --from=builder /app/apps/web/next.config.js ./
COPY --from=builder /app/apps/web/public ./public 2>/dev/null || true
COPY --from=builder /app/prisma /app/prisma
ENV DATABASE_URL=""
ENV DIRECT_URL=""
EXPOSE 3000
CMD ["node", "server.js"]
