import { NextRequest, NextResponse } from 'next/server';
import { registerSchema } from '@gooverchat/shared';
import { registerUser, createAccessToken, createRefreshToken, createSession } from '@/src/lib/auth';
import { authRateLimit } from '@/src/lib/rate-limit';
import { prisma } from '@/src/lib/db';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  const rl = await authRateLimit(ip);
  if (!rl.success) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  const body = await req.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const user = await registerUser(parsed.data);
    const accessToken = await createAccessToken({ sub: user.id, email: user.email });
    const refreshToken = await createRefreshToken({ sub: user.id });
    await createSession(user.id, refreshToken, {
      userAgent: req.headers.get('user-agent') ?? undefined,
      ipAddress: ip,
    });
    const res = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified,
      },
      accessToken,
      expiresIn: 900,
    });
    res.cookies.set('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.cookies.set('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 60 * 15 });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Registration failed';
    if (msg === 'EMAIL_TAKEN') return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    if (msg === 'USERNAME_TAKEN') return NextResponse.json({ error: 'Username taken' }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
