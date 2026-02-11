import { z } from 'zod';

export const friendRequestSchema = z.object({
  toId: z.string().cuid(),
});

export const friendActionSchema = z.object({
  userId: z.string().cuid(),
});

export const blockUserSchema = z.object({
  userId: z.string().cuid(),
});

export const reportUserSchema = z.object({
  userId: z.string().cuid(),
  reason: z.string().min(0).max(500).optional(),
  details: z.string().min(0).max(2000).optional(),
});
