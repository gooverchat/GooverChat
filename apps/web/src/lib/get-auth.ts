import { cookies } from 'next/headers';
import { verifyAccessToken } from './auth';

export async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export async function requireAuth() {
  const payload = await getAuth();
  if (!payload) throw new Error('UNAUTHORIZED');
  return payload;
}
