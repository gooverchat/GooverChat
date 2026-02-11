export const MESSAGE_EDIT_WINDOW_MINUTES_DEFAULT = 15;
export const PAGINATION_LIMIT = 50;
export const MAX_MESSAGE_LENGTH = 10000;
export const MAX_FILE_SIZE_MB = 25;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/zip',
  'text/plain',
];
export const ALLOWED_MIME_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_FILE_TYPES];

export const NOTIFICATION_TYPES = [
  'friend_request',
  'friend_accepted',
  'mention',
  'new_message',
  'system',
] as const;

export const CONVERSATION_ROLES = ['owner', 'admin', 'member'] as const;
export const MESSAGE_TYPES = ['text', 'image', 'file', 'system'] as const;
export const DELETE_SCOPES = ['me', 'everyone'] as const;
