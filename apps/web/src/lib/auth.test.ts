import { describe, it, expect, vi } from 'vitest';
import { hashPassword, verifyPassword } from './auth';

describe('auth', () => {
  it('hashes and verifies password', async () => {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    const ok = await verifyPassword(hash, password);
    expect(ok).toBe(true);
    const bad = await verifyPassword(hash, 'wrong');
    expect(bad).toBe(false);
  });
});
