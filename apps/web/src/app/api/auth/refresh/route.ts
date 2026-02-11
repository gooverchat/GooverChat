import { NextRequest, NextResponse } from 'next/server';
import { findSessionByRefreshToken, deleteSession, createAccessToken, createRefreshToken, createSession } from '@/src/lib/auth';
import { refreshRateLimit } from '@/src/lib/rate-limit';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await refreshRateLimit(ip);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  let refreshToken = req.cookies.get('refreshToken')?.value;
  if (!refreshToken) {
    try {
      const body = await req.json();
      refreshToken = body?.refreshToken;
    } catch {
      // no body
    }
  }
  if (!refreshToken) {
    return NextResponse.json({ error: 'Refresh token required' }, { status: 401 });
  }
  const session = await findSessionByRefreshToken(refreshToken);
  if (!session || session.expiresAt < new Date()) {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }
  await deleteSession(session.id);
  const user = session.user;
  const newAccess = await createAccessToken({ sub: user.id, email: user.email });
  const newRefresh = await createRefreshToken({ sub: user.id });
  await createSession(user.id, newRefresh, {
    deviceInfo: session.deviceInfo ?? undefined,
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    userAgent: req.headers.get('user-agent') ?? undefined,
  });
  const res = NextResponse.json({
    accessToken: newAccess,
    expiresIn: 900,
  });
  res.cookies.set('refreshToken', newRefresh, COOKIE_OPTIONS);
  res.cookies.set('accessToken', newAccess, { ...COOKIE_OPTIONS, maxAge: 60 * 15 });
  return res;
}
