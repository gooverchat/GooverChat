import { NextRequest, NextResponse } from 'next/server';
import { loginSchema } from '@gooverchat/shared';
import {
  findUserByEmail,
  verifyPassword,
  createAccessToken,
  createRefreshToken,
  createSession,
} from '@/src/lib/auth';
import { authRateLimit } from '@/src/lib/rate-limit';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
};

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
    const rl = await authRateLimit(ip);
    if (!rl.success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
    }
    const user = await findUserByEmail(parsed.data.email);
    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }
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
        profile: user.profile,
        settings: user.settings,
      },
      accessToken,
      expiresIn: 900,
    });
    res.cookies.set('refreshToken', refreshToken, COOKIE_OPTIONS);
    res.cookies.set('accessToken', accessToken, { ...COOKIE_OPTIONS, maxAge: 60 * 15 });
    return res;
  } catch (err) {
    console.error('Login error:', err);
    const message = err instanceof Error ? err.message : 'Login failed';
    return NextResponse.json(
      {
        error: 'Login failed',
        ...(process.env.NODE_ENV !== 'production' && { detail: message }),
      },
      { status: 500 }
    );
  }
}
