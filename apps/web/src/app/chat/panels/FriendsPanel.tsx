'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Friend = {
  id: string;
  username: string;
  conversationId: string;
  profile: { displayName: string | null; avatarUrl?: string | null } | null;
  lastMessage?: { text: string | null; createdAt: string } | null;
};

let friendsPanelCache: Friend[] | null = null;

export function FriendsPanel({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'all' | 'pending'>('all');
  const [friends, setFriends] = useState<Friend[]>(() => friendsPanelCache ?? []);
  const [loading, setLoading] = useState(() => friendsPanelCache == null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    Promise.all([
      fetch('/api/me', { credentials: 'include', signal: controller.signal }).then((r) => r.ok ? r.json() : null),
      fetch('/api/conversations', { credentials: 'include', signal: controller.signal }).then((r) => {
        if (!r.ok) throw new Error(`Failed to load conversations (${r.status})`);
        return r.json();
      }),
    ])
      .then(([me, data]) => {
        if (cancelled) return;
        if (!Array.isArray(data)) throw new Error('Conversations response is not an array');
        const myId = me?.id ?? null;
        const byId = new Map<string, { f: Friend; cTime: number }>();
        data.forEach((c: { id: string; lastMessageAt: string | null; lastMessage?: { text: string | null; createdAt: string } | null; members: Friend[] }) => {
          const others = c.members?.filter((m) => m?.id && m.id !== myId) ?? [];
          const cTime = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
          others.forEach((m) => {
            const existing = byId.get(m.id);
            if (!existing || cTime > existing.cTime) {
              byId.set(m.id, { f: { ...m, conversationId: c.id, lastMessage: c.lastMessage ?? null }, cTime });
            }
          });
        });
        const nextFriends = Array.from(byId.values()).map((x) => x.f);
        friendsPanelCache = nextFriends;
        setFriends(nextFriends);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Connection glitch while refreshing friends. Showing last known list.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  function getFirstLetter(f: Friend) {
    const name = f.profile?.displayName || f.username;
    return name.charAt(0).toUpperCase();
  }

  return (
    <div className="flex flex-col h-full bg-[#161618]">
      <header className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-white/[0.06] min-h-[52px]">
        <h2 className="text-[15px] font-semibold text-white/90 tracking-tight">Friends</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-gray-400 hover:bg-white/5 hover:text-white/90 transition-all duration-200"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] mb-5 w-fit">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === 'all' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === 'pending' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
          >
            Pending
          </button>
        </div>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
            <p className="text-gray-400 text-sm">Loading friends…</p>
          </div>
        ) : (
          <>
            {error && friends.length > 0 && (
              <p className="mb-3 text-xs text-amber-300/90">{error}</p>
            )}
          <ul className="space-y-1">
            {friends.map((u) => (
              <li
                key={u.id}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.06] transition-colors duration-200 cursor-default"
              >
                <div className="flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-gray-600 flex items-center justify-center text-white/90 text-base font-semibold">
                    {getFirstLetter(u)}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white/90 text-[15px] truncate">
                    {u.profile?.displayName || u.username}
                  </div>
                </div>
                <Link
                  href={`/chat/${u.conversationId}`}
                  onClick={onClose}
                  className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-2 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 transition-all duration-200"
                  aria-label="Message"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </Link>
              </li>
            ))}
            {friends.length === 0 && (
              <div className="flex flex-col items-center py-16 px-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-sm mb-2">No friends yet</p>
                <p className="text-gray-500 text-xs mb-4 max-w-[200px]">Find people and start chatting to add friends</p>
                <Link
                  href="/chat/search"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/90 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search for friends
                </Link>
              </div>
            )}
          </ul>
          </>
        )}
      </div>
    </div>
  );
}
