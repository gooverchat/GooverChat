import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@/src/lib/get-auth';
import { prisma } from '@/src/lib/db';
import * as argon2 from 'argon2';

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get('refreshToken')?.value;
  const payload = await getAuth();
  if (refreshToken && payload?.sub) {
    const sessions = await prisma.session.findMany({ where: { userId: payload.sub } });
    for (const s of sessions) {
      try {
        if (await argon2.verify(s.refreshTokenHash, refreshToken)) {
          await prisma.session.delete({ where: { id: s.id } });
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set('refreshToken', '', { path: '/', maxAge: 0 });
  res.cookies.set('accessToken', '', { path: '/', maxAge: 0 });
  return res;
}
