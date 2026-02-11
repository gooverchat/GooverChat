import * as argon2 from 'argon2';
import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';
import { prisma } from './db';
import type { RegisterInput } from '@gooverchat/shared';

const DEV_ACCESS_SECRET = 'dev-access-secret-min-32-characters-long';
const DEV_REFRESH_SECRET = 'dev-refresh-secret-min-32-characters-long';

if (process.env.NODE_ENV === 'production') {
  const access = process.env.JWT_ACCESS_SECRET;
  const refresh = process.env.JWT_REFRESH_SECRET;
  if (!access || access === DEV_ACCESS_SECRET || !refresh || refresh === DEV_REFRESH_SECRET) {
    throw new Error(
      'Production requires JWT_ACCESS_SECRET and JWT_REFRESH_SECRET to be set and different from dev defaults.'
    );
  }
}

const ACCESS_SECRET = new TextEncoder().encode(
  process.env.JWT_ACCESS_SECRET || DEV_ACCESS_SECRET
);
const REFRESH_SECRET = new TextEncoder().encode(
  process.env.JWT_REFRESH_SECRET || DEV_REFRESH_SECRET
);

function refreshTokenPrefix(refreshToken: string): string {
  return crypto.createHash('sha256').update(refreshToken).digest('hex').slice(0, 16);
}
const ACCESS_EXP = process.env.JWT_ACCESS_EXPIRES_IN || '15m';
const REFRESH_EXP = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export async function createAccessToken(payload: { sub: string; email: string }) {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_EXP)
    .sign(ACCESS_SECRET);
}

export async function createRefreshToken(payload: { sub: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_EXP)
    .sign(REFRESH_SECRET);
}

export async function verifyAccessToken(token: string): Promise<{ sub: string; email: string } | null> {
  try {
    const { payload } = await jwtVerify(token, ACCESS_SECRET);
    if (payload.sub && payload.email) return { sub: payload.sub, email: String(payload.email) };
    return null;
  } catch {
    return null;
  }
}

export async function verifyRefreshToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, REFRESH_SECRET);
    if (payload.sub) return { sub: String(payload.sub) };
    return null;
  } catch {
    return null;
  }
}

export async function registerUser(input: RegisterInput & { password: string }) {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
  });
  if (existing) {
    if (existing.email === input.email) throw new Error('EMAIL_TAKEN');
    throw new Error('USERNAME_TAKEN');
  }
  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      username: input.username,
      passwordHash,
    },
  });
  await prisma.userProfile.create({ data: { userId: user.id } });
  await prisma.userSettings.create({ data: { userId: user.id } });
  return user;
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { profile: true, settings: true },
  });
}

export async function createSession(
  userId: string,
  refreshToken: string,
  meta?: { deviceInfo?: string; ipAddress?: string; userAgent?: string }
) {
  const hash = await argon2.hash(refreshToken, { type: argon2.argon2id });
  const prefix = refreshTokenPrefix(refreshToken);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  return prisma.session.create({
    data: {
      userId,
      refreshTokenHash: hash,
      tokenPrefix: prefix,
      deviceInfo: meta?.deviceInfo,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      expiresAt,
    },
  });
}

const MAX_SESSIONS_LEGACY_FALLBACK = 50;

export async function findSessionByRefreshToken(refreshToken: string) {
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload?.sub) return null;
  const prefix = refreshTokenPrefix(refreshToken);
  let sessions = await prisma.session.findMany({
    where: { userId: payload.sub, tokenPrefix: prefix },
    include: { user: true },
  });
  if (sessions.length === 0) {
    // Legacy: sessions created before tokenPrefix existed (tokenPrefix null)
    sessions = await prisma.session.findMany({
      where: { userId: payload.sub },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: MAX_SESSIONS_LEGACY_FALLBACK,
    });
  }
  for (const s of sessions) {
    if (await argon2.verify(s.refreshTokenHash, refreshToken)) return s;
  }
  return null;
}

export async function deleteSession(sessionId: string) {
  return prisma.session.delete({ where: { id: sessionId } }).catch(() => null);
}

export async function deleteAllSessionsForUser(userId: string, exceptSessionId?: string) {
  const where: { userId: string; id?: { not: string } } = { userId };
  if (exceptSessionId) where.id = { not: exceptSessionId };
  return prisma.session.deleteMany({ where });
}
