import { z } from 'zod';
import { MAX_MESSAGE_LENGTH } from '../constants';

export const sendMessageSchema = z.object({
  text: z.string().min(0).max(MAX_MESSAGE_LENGTH).optional(),
  type: z.enum(['text', 'image', 'file', 'system']).default('text'),
  replyToId: z.string().cuid().optional(),
  forwardedFromId: z.string().cuid().optional(),
  attachmentIds: z.array(z.string().cuid()).optional(),
  mentionIds: z.array(z.string().cuid()).optional(),
});

export const editMessageSchema = z.object({
  text: z.string().min(0).max(MAX_MESSAGE_LENGTH),
});

export const deleteMessageSchema = z.object({
  scope: z.enum(['me', 'everyone']),
});

export const reactSchema = z.object({
  emoji: z.string().min(1).max(10),
});

export const forwardSchema = z.object({
  conversationIds: z.array(z.string().cuid()).min(1).max(10),
});

export const reportMessageSchema = z.object({
  messageId: z.string().cuid(),
  reason: z.string().min(0).max(500).optional(),
  details: z.string().min(0).max(2000).optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type DeleteMessageInput = z.infer<typeof deleteMessageSchema>;
