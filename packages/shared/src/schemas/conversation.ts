import { z } from 'zod';

export const createConversationSchema = z.object({
  type: z.enum(['direct', 'group']),
  memberIds: z.array(z.string().cuid()).optional(),
  name: z.string().min(0).max(100).optional(),
  description: z.string().min(0).max(500).optional(),
});

export const addMemberSchema = z.object({
  userId: z.string().cuid(),
  role: z.enum(['admin', 'member']).optional(),
});

export const updateConversationSchema = z.object({
  name: z.string().min(0).max(100).optional(),
  description: z.string().min(0).max(500).optional(),
  avatarUrl: z.string().url().nullable().optional(),
});

export const conversationPreferenceSchema = z.object({
  isPinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isMuted: z.boolean().optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
