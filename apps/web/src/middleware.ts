import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((o) => o.trim());

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin');
  const res = NextResponse.next();
  if (origin && CORS_ORIGINS.includes(origin)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
  }
  res.headers.set('Access-Control-Allow-Credentials', 'true');
  res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: res.headers });
  }
  return res;
}

export const config = { matcher: '/api/:path*' };
