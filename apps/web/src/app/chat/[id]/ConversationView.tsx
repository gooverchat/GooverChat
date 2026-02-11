'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { MessageContextMenu } from './MessageContextMenu';
import { usePresence } from '../PresenceProvider';
import { TypingIndicator } from '../TypingIndicator';

type Message = {
  id: string;
  text: string | null;
  type: string;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: { id: string; username: string; profile: { displayName: string | null } | null } | null;
  replyTo: { id: string; text: string | null } | null;
  reactions: { emoji: string; user: { id: string } }[];
  status?: { deliveredAt: string | null; seenAt: string | null };
};

type MessagesResponse = {
  messages: Message[];
  currentUserId?: string;
};

export function ConversationView({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [otherParticipantName, setOtherParticipantName] = useState<string | null>(null);
  const [otherParticipantAvatarUrl, setOtherParticipantAvatarUrl] = useState<string | null>(null);
  const [otherParticipantId, setOtherParticipantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const presence = usePresence();
  const otherIsTyping = otherParticipantId != null && presence?.isUserTypingInConversation(id, otherParticipantId);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [openContextMenuMessageId, setOpenContextMenuMessageId] = useState<string | null>(null);
  const [openContextMenuPos, setOpenContextMenuPos] = useState({ x: 0, y: 0 });
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrolledMessageIdRef = useRef<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/conversations/${id}/messages?limit=50`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
      fetch(`/api/conversations/${id}`, { credentials: 'include' }).then((r) => r.json()).catch(() => ({})),
    ]).then(([msgData, convData]: [MessagesResponse, { members?: { user: { id: string; username: string; profile?: { displayName: string | null; avatarUrl?: string | null } } }[]; type?: string; name?: string | null }]) => {
      if (msgData?.messages) {
        const list = msgData.messages.reverse() as Message[];
        setMessages(list);
        const me = msgData.currentUserId as string | undefined;
        const latest = list[list.length - 1];
        if (latest?.id) {
          fetch(`/api/conversations/${id}/read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ lastReadMessageId: latest.id }),
          }).catch(() => {});
          const receivedIds = list.filter((m) => m.sender?.id !== me).map((m) => m.id);
          if (receivedIds.length > 0) {
            fetch(`/api/conversations/${id}/messages/delivered`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ messageIds: receivedIds }),
            }).catch(() => {});
          }
        }
      }
      if (msgData?.currentUserId) setCurrentUserId(msgData.currentUserId);
      if (msgData?.currentUserId && convData?.members) {
        const other = convData.members.find((m) => m.user.id !== msgData.currentUserId);
        if (other) {
          setOtherParticipantName(other.user.profile?.displayName || other.user.username);
          setOtherParticipantAvatarUrl(other.user.profile?.avatarUrl ?? null);
          setOtherParticipantId(other.user.id);
        } else if (convData.type === 'group' && convData.name) {
          setOtherParticipantName(convData.name);
          setOtherParticipantAvatarUrl(null);
          setOtherParticipantId(null);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    lastScrolledMessageIdRef.current = null;
  }, [id]);

  useEffect(() => {
    if (!id || !presence) return;
    presence.joinConversation(id);
    return () => {
      presence.leaveConversation(id);
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      presence.stopTyping(id);
    };
  }, [id, presence]);

  const handleTextChange = useCallback(
    (value: string) => {
      setText(value);
      if (!id || !presence) return;
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
      const hasText = value.trim().length > 0;
      if (hasText) {
        presence.startTyping(id);
        typingStopTimeoutRef.current = setTimeout(() => {
          presence.stopTyping(id);
          typingStopTimeoutRef.current = null;
        }, 3000);
      } else {
        presence.stopTyping(id);
      }
    },
    [id, presence]
  );

  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      fetch(`/api/conversations/${id}/messages?limit=50`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data: MessagesResponse) => {
          if (data?.messages) {
            const list = (data.messages as Message[]).reverse();
            setMessages(list);
            const me = data.currentUserId as string | undefined;
            const latest = list[list.length - 1];
            if (latest?.id) {
              fetch(`/api/conversations/${id}/read`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ lastReadMessageId: latest.id }),
              }).catch(() => {});
              const receivedIds = list.filter((m) => m.sender?.id !== me).map((m) => m.id);
              if (receivedIds.length > 0) {
                fetch(`/api/conversations/${id}/messages/delivered`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({ messageIds: receivedIds }),
                }).catch(() => {});
              }
            }
          }
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (messages.length === 0) return;
    const latestId = messages[messages.length - 1]?.id ?? null;
    if (latestId === lastScrolledMessageIdRef.current) return;
    lastScrolledMessageIdRef.current = latestId;
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!text.trim() || sending) return;
    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
      typingStopTimeoutRef.current = null;
    }
    presence?.stopTyping(id);
    setSending(true);
    try {
      const res = await fetch(`/api/conversations/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text.trim(), type: 'text' }),
      });
      const msg = await res.json();
      if (res.ok && msg.id) {
        setMessages((prev) => [...prev, msg]);
        setText('');
      }
    } catch {
      // Network error or failed fetch - avoid unhandled rejection
    } finally {
      setSending(false);
    }
  }

  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    const res = await fetch(`/api/messages/${messageId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        const reactions = [...(m.reactions || [])];
        const idx = reactions.findIndex((r) => r.emoji === emoji && r.user.id === currentUserId);
        if (data.removed && idx >= 0) {
          reactions.splice(idx, 1);
        } else if (!data.removed) {
          const existing = reactions.findIndex((r) => r.emoji === emoji && r.user.id === currentUserId);
          if (existing < 0) reactions.push({ emoji, user: { id: currentUserId! } });
        }
        return { ...m, reactions };
      })
    );
  }, [currentUserId]);

  const handleEdit = useCallback(async (messageId: string, text: string) => {
    const body = { text: typeof text === 'string' ? text : String(text ?? '') };
    const res = await fetch(`/api/messages/${messageId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('Edit message failed', res.status, err);
      return;
    }
    const updated = await res.json();
    const newText = updated?.text;
    const newEditedAt = updated?.editedAt ?? null;
    if (newText === undefined) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, text: newText, editedAt: newEditedAt } : m
      )
    );
  }, []);

  const handleDeleteForMe = useCallback(async (messageId: string) => {
    const res = await fetch(`/api/messages/${messageId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scope: 'me' }),
    });
    if (!res.ok) return;
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  }, []);

  const handleDeleteForEveryone = useCallback(async (messageId: string) => {
    const res = await fetch(`/api/messages/${messageId}/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ scope: 'everyone' }),
    });
    if (!res.ok) return;
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), text: null } : m
      )
    );
  }, []);

  function formatDateHeader(dateStr: string) {
    const d = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const msgDate = new Date(d);
    msgDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((msgDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays === 1) return 'Tomorrow';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
  }

  let lastDate = '';

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <header className="sticky top-0 z-10 flex-shrink-0 px-4 py-3 border-b border-gray-700/60 flex items-center gap-3 min-h-[52px] bg-[#0d0d0d]">
        <Link
          href="/chat"
          className="md:hidden flex items-center gap-1.5 text-gray-400 hover:text-gray-200 shrink-0 py-2 pr-3 -ml-1 rounded-lg hover:bg-gray-700/50 active:bg-gray-700/70 transition-colors"
          aria-label="Back to chats"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back</span>
        </Link>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-full bg-gray-600/60 flex-shrink-0 overflow-hidden flex items-center justify-center">
            {otherParticipantAvatarUrl ? (
              <img src={otherParticipantAvatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-gray-300 text-sm font-medium">
                {otherParticipantName ? otherParticipantName.charAt(0).toUpperCase() : '?'}
              </span>
            )}
          </div>
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium text-gray-200 text-sm truncate">
                {otherParticipantName ?? 'Loading…'}
              </span>
              {otherParticipantId != null && (
                <span
                  className={`flex-shrink-0 text-xs ${presence?.isOnline(otherParticipantId) ? 'text-emerald-400' : 'text-gray-500'}`}
                  title={presence?.isOnline(otherParticipantId) ? 'Online' : 'Offline'}
                >
                  {presence?.isOnline(otherParticipantId) ? 'Online' : 'Offline'}
                </span>
              )}
            </div>
            {otherIsTyping && <TypingIndicator />}
          </div>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-auto overflow-x-hidden p-4 space-y-3">
        {messages.map((m) => {
          const dateKey = new Date(m.createdAt).toDateString();
          const showDateHeader = dateKey !== lastDate;
          if (showDateHeader) lastDate = dateKey;

          const isMine = m.sender?.id === currentUserId;
          return (
          <div key={m.id} className="space-y-3">
            {showDateHeader && (
              <div className="flex justify-center">
                <span className="text-xs text-gray-500 font-medium bg-gray-700/40 px-3 py-1 rounded-full">
                  {formatDateHeader(m.createdAt)}
                </span>
              </div>
            )}
            <MessageContextMenu
              messageId={m.id}
              messageText={m.text}
              isMine={isMine}
              otherParticipantName={otherParticipantName}
              isMenuOpen={openContextMenuMessageId === m.id}
              menuPos={openContextMenuPos}
              onOpenMenu={(x, y) => {
                setOpenContextMenuMessageId(m.id);
                setOpenContextMenuPos({ x, y });
              }}
              onCloseMenu={() => setOpenContextMenuMessageId(null)}
              onReact={handleReact}
              onEdit={handleEdit}
              onDeleteForMe={handleDeleteForMe}
              onDeleteForEveryone={handleDeleteForEveryone}
            >
              <div
                className={`flex flex-col max-w-[min(75%,280px)] w-fit ${isMine ? 'ml-auto' : 'mr-auto'}`}
              >
                {m.deletedAt ? (
                  <span className="text-sm italic text-gray-500">This message was deleted</span>
                ) : (
                  <>
                    {m.replyTo && (
                      <div className="text-xs border-l-2 border-gray-600 pl-2 my-1 text-gray-500">
                        {m.replyTo.text}
                      </div>
                    )}
                    <div className="rounded-xl px-3 py-2 bg-gray-700/60 text-gray-200 text-sm">
                      {m.text}
                      {m.editedAt && <span className="text-xs text-gray-500 ml-1">(edited)</span>}
                      {m.reactions && m.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5 pt-1 border-t border-gray-600/40">
                          {Object.entries(
                            m.reactions.reduce<Record<string, number>>((acc, r) => {
                              acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([emoji, count]) => (
                            <span key={emoji} className="text-xs bg-gray-600/50 px-1.5 py-0.5 rounded">
                              {emoji} {count > 1 && <span className="text-[10px]">{count}</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {isMine && (
                      <div className="flex items-center justify-end mt-0.5 text-[10px]">
                        {m.status?.seenAt ? (
                          <span className="text-blue-400">Seen</span>
                        ) : m.status?.deliveredAt ? (
                          <span className="text-gray-400">Delivered</span>
                        ) : (
                          <span className="text-gray-500">Sent</span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </MessageContextMenu>
          </div>
        );
        })}
        <div ref={bottomRef} />
      </div>
      <footer className="flex-shrink-0 p-4 border-t border-gray-700/60 bg-[#0d0d0d]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="flex items-center gap-2 rounded-2xl bg-gray-700/50 px-4 py-2.5 border border-gray-600/50"
        >
          <input
            type="text"
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Type a message"
            className="flex-1 min-w-0 bg-transparent text-gray-200 placeholder:text-gray-500 text-sm outline-none"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-200 rounded-full hover:bg-gray-600/50 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            aria-label="Send"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </form>
      </footer>
    </div>
  );
}
