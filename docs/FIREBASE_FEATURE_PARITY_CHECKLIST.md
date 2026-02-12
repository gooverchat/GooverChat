# Firebase Migration Feature Parity Audit

Date: 2026-02-12  
Branch: `cursor/firebase-chat-feature-parity-ba07`

This audit is based on the current implementation in:

- API routes under `apps/web/src/app/api/**`
- chat UI under `apps/web/src/app/chat/**`
- socket server under `apps/web/src/lib/socket/server.js`
- data model in `prisma/schema.prisma`

---

## 1) Current feature inventory + Firebase parity classification

Legend:

- **Direct Firebase replacement**
- **Needs redesign**
- **Needs Cloud Functions**

| Area | Feature in current app | Current status | Firebase classification |
|---|---|---|---|
| Auth | Register / login / logout / refresh | Implemented (`/api/auth/*`) with JWT + cookies + sessions | **Direct Firebase replacement** (Firebase Auth) |
| Auth | Email verification | Implemented (`/api/auth/verify-email`) | **Direct Firebase replacement** |
| Auth | Password reset | Intentionally disabled (`501`) | **Direct Firebase replacement** (later enable via Firebase Auth) |
| Auth | Device/session metadata in DB | Implemented via `Session` model | **Needs redesign** |
| Discovery | User search by `contains` username/email | Implemented (`/api/users/search`) with SQL `contains` | **Needs redesign** |
| Friends | Send/accept/decline/remove friend requests | Implemented in API | **Direct Firebase replacement** |
| Safety | Block/unblock/list blocked users | Implemented in API | **Direct Firebase replacement** |
| Conversations | Create DM and prevent duplicate DM | Implemented (`/api/conversations`) | **Needs redesign** |
| Conversations | Group room creation | Implemented in API | **Direct Firebase replacement** |
| Conversations | Add/remove group members with owner/admin checks | API exists (`/members`) | **Needs Cloud Functions** |
| Conversations | Conversation list with last message + per-user prefs | Implemented (`/api/conversations`) | **Needs redesign** |
| Conversations | Conversation detail + member list | Implemented (`/api/conversations/[id]`) | **Direct Firebase replacement** |
| Messaging | Send message (text/type/reply/forward refs/mentions) | Implemented (`/messages`) | **Direct Firebase replacement** |
| Messaging | Real-time new messages | Not socket-based; currently 4s polling in UI | **Direct Firebase replacement** (Firestore listeners) |
| Messaging | Edit message | Implemented (`/api/messages/[id]`) | **Direct Firebase replacement** |
| Messaging | Delete for everyone (soft delete) | Implemented (`/api/messages/[id]/delete`) | **Direct Firebase replacement** |
| Messaging | Delete for me | Implemented (`MessageDeletedForUser`) | **Needs redesign** |
| Messaging | Reactions | Implemented (`/api/messages/[id]/react`) | **Direct Firebase replacement** |
| Messaging | Forward message API | Implemented (`/api/messages/[id]/forward`) | **Direct Firebase replacement** |
| Messaging | Message print view | Implemented (`/print/message/[messageId]`) | **Direct Firebase replacement** |
| Messaging | File/image attachments | Schema exists, but upload flow/API/UI not implemented | **Needs redesign** |
| Search | Conversation message search | Implemented (`/api/conversations/[id]/search`) | **Needs redesign** |
| Search | Global message search | Implemented (`/api/search/messages`) | **Needs redesign** |
| Presence | Typing indicator (room events) | Implemented via Socket.IO | **Needs redesign** |
| Presence | Online/offline presence | Implemented via Socket.IO connect/disconnect | **Needs Cloud Functions** |
| Receipts | Delivered receipts | Implemented (`/messages/delivered`) | **Needs redesign** |
| Receipts | Read receipts / seen status | Implemented (`/conversations/[id]/read`) | **Needs redesign** |
| Notifications | Notification inbox + mark read | Implemented (`/api/notifications`) | **Direct Firebase replacement** |
| Notifications | Friend-request notification creation | Implemented in friend APIs | **Needs Cloud Functions** |
| Push | Save/remove web-push subscription rows | Implemented (`/api/push/*`) | **Needs redesign** |
| Push | Push fanout delivery | Not implemented yet | **Needs Cloud Functions** |
| Moderation | Report user/message | Implemented (`/api/report/*`) | **Direct Firebase replacement** |
| Moderation | Audit log for destructive actions | Implemented (`AuditLog` writes) | **Needs Cloud Functions** |
| Abuse control | Auth/message/socket rate limits (Redis) | Implemented | **Needs Cloud Functions** |

---

## 2) Firebase designs for all **Needs redesign** items

### A. Session/device metadata parity

Keep Firebase Auth for identity, and add Firestore session docs for device list/sign-out-all UX.

- `users/{userId}/sessions/{sessionId}`
  - `deviceLabel: string`
  - `userAgent: string`
  - `ipHash: string`
  - `createdAt: Timestamp`
  - `lastSeenAt: Timestamp`
  - `revokedAt: Timestamp | null`
  - `platform: "web" | "ios" | "android"`

### B. User search (`contains`) replacement

Firestore cannot do SQL-style case-insensitive `contains`. Use prefix tokens.

- `users/{userId}`
  - `username: string`
  - `usernameLower: string`
  - `email: string`
  - `emailLower: string`
  - `displayName: string | null`
  - `searchPrefixes: string[]` (e.g., `["a","al","ali","alic","alice"]`)

Query pattern:

- `where("searchPrefixes", "array-contains", normalizedQueryPrefix)`

### C. DM uniqueness + conversation summary model

Use deterministic DM IDs and denormalized conversation summary fields.

- `conversations/{conversationId}`
  - `type: "direct" | "group"`
  - `memberIds: string[]`
  - `name: string | null`
  - `description: string | null`
  - `avatarUrl: string | null`
  - `createdBy: string`
  - `createdAt: Timestamp`
  - `updatedAt: Timestamp`
  - `lastMessageId: string | null`
  - `lastMessageText: string | null`
  - `lastMessageSenderId: string | null`
  - `lastMessageAt: Timestamp | null`

- `conversations/{conversationId}/members/{userId}`
  - `role: "owner" | "admin" | "member"`
  - `joinedAt: Timestamp`
  - `lastReadMessageId: string | null`
  - `lastReadAt: Timestamp | null`
  - `isPinned: boolean`
  - `isArchived: boolean`
  - `isMuted: boolean`
  - `pinOrder: number`

DM ID rule:

- `conversationId = "dm_" + min(userA,userB) + "_" + max(userA,userB)`

### D. Delete-for-me in Firestore

Keep canonical messages, but add per-user hide markers.

- `users/{userId}/hiddenMessages/{conversationId_messageId}`
  - `conversationId: string`
  - `messageId: string`
  - `hiddenAt: Timestamp`

Client filters out messages with matching hidden marker.

### E. Delivered/read receipt model

Prefer per-member cursors over per-message fanout writes.

- `conversations/{conversationId}/members/{userId}`
  - `lastDeliveredMessageId: string | null`
  - `lastDeliveredAt: Timestamp | null`
  - `lastReadMessageId: string | null`
  - `lastReadAt: Timestamp | null`

- `conversations/{conversationId}/messages/{messageId}`
  - `senderId: string`
  - `createdAt: Timestamp`

Sender computes `Sent/Delivered/Seen` by comparing recipient cursors against message order.

### F. File/image attachments

Move media to Firebase Storage and persist metadata on message docs.

- Storage path: `chatUploads/{conversationId}/{messageId}/{fileId}`

- `conversations/{conversationId}/messages/{messageId}`
  - `type: "text" | "image" | "file" | "system"`
  - `text: string | null`
  - `attachments: Attachment[]`

- `Attachment` object fields:
  - `fileId: string`
  - `storagePath: string`
  - `downloadUrl: string`
  - `mimeType: string`
  - `sizeBytes: number`
  - `filename: string`
  - `width: number | null`
  - `height: number | null`
  - `uploadedAt: Timestamp`

### G. Message/user search parity

For Firestore-only search parity, create tokenized index docs.

- `messageIndex/{conversationId_messageId}`
  - `conversationId: string`
  - `messageId: string`
  - `senderId: string`
  - `memberIds: string[]`
  - `text: string`
  - `textLower: string`
  - `searchPrefixes: string[]`
  - `createdAt: Timestamp`

Use:

- conversation search: `where("conversationId","==",cid)` + `array-contains` prefix
- global search: `where("memberIds","array-contains",uid)` + `array-contains` prefix

### H. Typing indicator

Typing should be ephemeral with TTL cleanup.

- `conversations/{conversationId}/typing/{userId}`
  - `isTyping: boolean`
  - `updatedAt: Timestamp`
  - `expiresAt: Timestamp` (TTL field)

Client writes on keystroke/debounce; listeners show active typers where `expiresAt > now`.

### I. Push subscription model (move to FCM)

Replace Web Push subscription rows with FCM device tokens.

- `users/{userId}/devices/{deviceId}`
  - `fcmToken: string`
  - `platform: string`
  - `userAgent: string`
  - `notificationsEnabled: boolean`
  - `createdAt: Timestamp`
  - `lastSeenAt: Timestamp`

---

## 3) Day-1 vs Later checklist

### Day 1 (can work immediately on Firebase with minimal risk)

- [ ] Email/password auth (register/login/logout) via Firebase Auth
- [ ] Email verification
- [ ] Basic DM and group conversations
- [ ] Conversation list + open room
- [ ] Send/edit/delete-for-everyone text messages
- [ ] Message reactions
- [ ] Basic message pagination/history
- [ ] In-app notifications list/read state
- [ ] Friend request lifecycle + block/unblock
- [ ] Report user/message

### Later (required for full parity with current backend behavior)

- [ ] Session/device management views (if kept)
- [ ] SQL-style user/message search parity
- [ ] Deterministic DM IDs + denormalized chat summaries
- [ ] Delete-for-me hidden-message model
- [ ] Delivered + seen status parity
- [ ] Typing indicator TTL model
- [ ] Robust online presence (`online/offline`) via backend automation
- [ ] File/image upload and attachment metadata pipeline
- [ ] Push notification delivery (token fanout)
- [ ] Trusted notification generation (friend/mention/new message) server-side
- [ ] Role-protected group member mutations (owner/admin enforcement)
- [ ] Immutable audit logs + production-grade rate limiting

---

## Recommended migration order

1. Auth + conversations + text messages (day-1 baseline)
2. Read receipts + typing + presence
3. Search + attachments
4. Notifications/push + moderation automation

