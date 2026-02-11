import { z } from 'zod';

export const updateProfileSchema = z.object({
  displayName: z.string().min(0).max(100).optional(),
  bio: z.string().min(0).max(500).optional(),
  username: z.string().min(2).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
});

export const updateSettingsSchema = z.object({
  whoCanMessage: z.enum(['everyone', 'friends_only']).optional(),
  whoCanAdd: z.enum(['everyone', 'friends_of_friends', 'nobody']).optional(),
  showReadReceipts: z.boolean().optional(),
  showTypingIndicator: z.boolean().optional(),
  showOnlineStatus: z.enum(['everyone', 'friends', 'nobody']).optional(),
  messageEditWindowMinutes: z.number().int().min(1).max(60).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  language: z.string().max(10).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  notifyFriendRequest: z.boolean().optional(),
  notifyMention: z.boolean().optional(),
  notifyMessage: z.boolean().optional(),
  notifySound: z.boolean().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128).regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
