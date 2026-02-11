'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePresence } from './PresenceProvider';
import { TypingIndicator } from './TypingIndicator';

type Conversation = {
  id: string;
  type: string;
  name: string | null;
  lastMessageAt: string | null;
  lastMessage: { id: string; text: string | null; createdAt: string; sender: { username: string } | null } | null;
  members: { id: string; username: string; profile: { displayName: string | null; avatarUrl?: string | null } | null }[];
  role: string;
};

function OnlineIndicator({ online }: { online: boolean }) {
  return (
    <span
      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#1a1a1a] ${
        online ? 'bg-emerald-500' : 'bg-gray-500'
      }`}
      title={online ? 'Online' : 'Offline'}
      aria-hidden
    />
  );
}

export function ChatList() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const presence = usePresence();
  const joinConversation = presence?.joinConversation;
  const leaveConversation = presence?.leaveConversation;
  const isOnline = presence?.isOnline;
  const isUserTypingInConversation = presence?.isUserTypingInConversation;
  const joinedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    Promise.all([
      fetch('/api/me', { credentials: 'include', signal: controller.signal }).then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch('/api/conversations', { credentials: 'include', signal: controller.signal }).then((r) => r.json()).catch(() => []),
    ])
      .then(([me, data]) => {
        if (cancelled) return;
        if (me?.id) setMyId(me.id);
        if (!Array.isArray(data)) return;
        const myIdVal = me?.id ?? null;
        const byId = new Map<string, Conversation>();
        data.forEach((c: Conversation) => byId.set(c.id, c));
        const list = Array.from(byId.values());
        const oneToOneByOther = new Map<string, Conversation>();
        const rest: Conversation[] = [];
        list.forEach((c) => {
          const others = c.members?.filter((m: { id: string }) => m && m.id !== myIdVal) ?? [];
          const is1v1 = !c.name && others.length === 1;
          if (is1v1 && others[0]) {
            const otherId = others[0].id;
            const existing = oneToOneByOther.get(otherId);
            const cTime = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
            const exTime = existing?.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
            if (!existing || cTime > exTime) oneToOneByOther.set(otherId, c);
          } else {
            rest.push(c);
          }
        });
        const deduped = [...oneToOneByOther.values(), ...rest].sort((a, b) => {
          const tA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const tB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return tB - tA;
        });
        setConversations(deduped);
      })
      .catch(() => {
        if (cancelled) return;
        setConversations([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const currentConversationIds = new Set(conversations.map((c) => c.id));
    conversations.forEach((c) => {
      if (!joinedIdsRef.current.has(c.id)) {
        joinConversation?.(c.id);
        joinedIdsRef.current.add(c.id);
      }
    });
    joinedIdsRef.current.forEach((conversationId) => {
      if (!currentConversationIds.has(conversationId)) {
        leaveConversation?.(conversationId);
        joinedIdsRef.current.delete(conversationId);
      }
    });
  }, [conversations, joinConversation, leaveConversation]);

  useEffect(() => {
    return () => {
      joinedIdsRef.current.forEach((conversationId) => leaveConversation?.(conversationId));
      joinedIdsRef.current.clear();
    };
  }, [leaveConversation]);

  function getFirstLetter(m: { profile?: { displayName: string | null } | null; username: string }) {
    const name = m.profile?.displayName || m.username;
    return name.charAt(0).toUpperCase();
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
        <p className="text-gray-400 text-sm">Loading chats…</p>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-gray-400 text-sm mb-2">No chats yet</p>
        <p className="text-gray-500 text-xs mb-4 max-w-[200px]">Start a conversation to see your chats here</p>
        <Link
          href="/chat/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 text-sm font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Start a conversation
        </Link>
      </div>
    );
  }

  return (
    <ul className="p-2 space-y-0.5">
      {conversations.map((c) => {
        const others = c.members?.filter((m) => m && m.id !== myId) ?? [];
        const title = c.name || others.map((m) => m.profile?.displayName || m.username).join(', ') || 'Chat';
        const firstOther = others[0];
        const otherUserId = firstOther?.id;
        const isOtherOnline = Boolean(otherUserId && isOnline?.(otherUserId));
        const isOtherTyping = Boolean(otherUserId != null && isUserTypingInConversation?.(c.id, otherUserId));

        return (
          <li key={c.id}>
            <Link
              href={`/chat/${c.id}`}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors duration-200 group"
            >
              <div className="flex-shrink-0 relative">
                <div className="w-11 h-11 rounded-full bg-gray-600 flex items-center justify-center text-white/90 text-base font-semibold">
                  {firstOther ? getFirstLetter(firstOther) : '?'}
                </div>
                {otherUserId != null && (
                  <OnlineIndicator online={isOtherOnline} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white/90 text-[15px] truncate">{title}</div>
                {isOtherTyping && (
                  <div className="truncate">
                    <TypingIndicator />
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
