import { redis } from './redis';

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<{ success: boolean; remaining: number }> {
  if (!redis) return { success: true, remaining: limit };
  const k = `rl:${key}`;
  const count = await redis.incr(k);
  if (count === 1) await redis.expire(k, windowSeconds);
  const ttl = await redis.ttl(k);
  if (ttl === -1) await redis.expire(k, windowSeconds);
  const remaining = Math.max(0, limit - count);
  return { success: count <= limit, remaining };
}

export async function authRateLimit(identifier: string): Promise<{ success: boolean; remaining: number }> {
  const limit = parseInt(process.env.RATE_LIMIT_AUTH_MAX || '10', 10);
  const window = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW || '60', 10);
  return rateLimit(`auth:${identifier}`, limit, window);
}

export async function messageRateLimit(userId: string): Promise<{ success: boolean; remaining: number }> {
  const limit = parseInt(process.env.RATE_LIMIT_MESSAGE_MAX || '60', 10);
  const window = parseInt(process.env.RATE_LIMIT_MESSAGE_WINDOW || '60', 10);
  return rateLimit(`msg:${userId}`, limit, window);
}

/** Rate limit for password reset (per IP): 5 attempts per 15 minutes. */
export async function resetPasswordRateLimit(identifier: string): Promise<{ success: boolean; remaining: number }> {
  return rateLimit(`reset-password:${identifier}`, 5, 15 * 60);
}

/** Rate limit for auth refresh (per IP): 30 per minute. */
export async function refreshRateLimit(identifier: string): Promise<{ success: boolean; remaining: number }> {
  return rateLimit(`auth-refresh:${identifier}`, 30, 60);
}

/** Rate limit for socket-token (per IP): 60 per minute. */
export async function socketTokenRateLimit(identifier: string): Promise<{ success: boolean; remaining: number }> {
  return rateLimit(`socket-token:${identifier}`, 60, 60);
}
