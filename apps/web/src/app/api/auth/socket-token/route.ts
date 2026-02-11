import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { socketTokenRateLimit } from '@/src/lib/rate-limit';

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rl = await socketTokenRateLimit(ip);
  if (!rl.success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ token });
}
