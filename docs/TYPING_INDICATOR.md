# Typing Indicator Feature

## Overview

The typing indicator shows when the other person is typing in a conversation. It appears in two places: under the friend’s name in the open chat header, and under the friend’s name in the chat list.

## Where It Shows

1. **Conversation view** – When a chat is open, “typing…” appears under the other person’s name and online status in the header.
2. **Chat list** – In the list of conversations, “typing…” appears under the friend’s name for the conversation where they are typing.

## How It Works

### Sender (person typing)

- **Start**: When the user types in the message input (and there is at least one non‑whitespace character), the client sends a `typing:start` event over the socket for that conversation.
- **Stop**: If the user stops typing, a `typing:stop` event is sent 3 seconds after the last keystroke. If the user clears the input, `typing:stop` is sent immediately.
- The client joins the conversation room when the chat is open so it can send (and receive) typing events for that conversation.

### Receiver (person seeing “typing…”)

- The client listens for `typing:start` and `typing:stop` in the conversation room.
- On `typing:start`, the other user is marked as typing. To avoid a very short flash, the indicator is kept for a **minimum of 3 seconds** even if `typing:stop` arrives sooner.
- On `typing:stop`, the user is removed from the typing set; the 3‑second minimum may still keep “typing…” visible until that window ends.

### Socket (server)

- **Events**: `typing:start` and `typing:stop`, each with `conversationId` (and the server adds `userId` from the socket).
- **Rooms**: Clients join `conversation:{id}` to send and receive typing for that conversation. The server broadcasts typing events to everyone in that room except the sender.

## Main Files

| File | Role |
|------|------|
| `apps/web/src/lib/socket/server.js` | Handles `typing:start` / `typing:stop`, broadcasts to conversation room. |
| `apps/web/src/app/chat/PresenceProvider.tsx` | Socket connection, join/leave conversation, typing state, minimum 3s display, `startTyping` / `stopTyping` / `isUserTypingInConversation`. |
| `apps/web/src/app/chat/[id]/ConversationView.tsx` | Joins conversation room, sends typing on input change (only when text present), 3s debounce before stop, shows “typing…” under header name. |
| `apps/web/src/app/chat/ChatList.tsx` | Joins all conversation rooms when list loads, shows “typing…” under friend name per conversation. |

## Behaviour Summary

- **Only when there’s text**: Typing is sent only when the input has at least one non‑whitespace character; clearing the input sends stop immediately.
- **3s after last key**: Stop is sent 3 seconds after the last keystroke so the other side sees “typing…” for a short time after the user stops.
- **Minimum 3s display**: On the receiver, “typing…” stays for at least 3 seconds from the last `typing:start` to avoid a brief 0.1s flicker.
- **Under the name**: The indicator is always shown under the other person’s name (in the conversation header and in the chat list).
