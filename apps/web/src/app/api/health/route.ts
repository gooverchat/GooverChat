import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/db';
import { redis } from '@/src/lib/redis';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, string> = {};
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch (e) {
    checks.database = 'error';
  }
  try {
    if (redis) {
      await redis.ping();
      checks.redis = 'ok';
    } else {
      checks.redis = 'unavailable';
    }
  } catch {
    checks.redis = 'error';
  }
  const ok = checks.database === 'ok';
  return NextResponse.json(
    { status: ok ? 'healthy' : 'degraded', checks, version: process.env.npm_package_version || '1.0.0' },
    { status: ok ? 200 : 503 }
  );
}
