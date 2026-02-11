import Redis from 'ioredis';

const url = process.env.REDIS_URL || 'redis://localhost:6379/0';

function createRedis() {
  try {
    return new Redis(url, { maxRetriesPerRequest: 3 });
  } catch (e) {
    console.warn('Redis not available, using in-memory fallback for rate limit');
    return null;
  }
}

export const redis = createRedis();

export async function getRedis(): Promise<Redis | null> {
  return redis;
}
