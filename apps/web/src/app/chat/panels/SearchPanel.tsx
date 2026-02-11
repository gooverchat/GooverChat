'use client';

import { useState } from 'react';
import Link from 'next/link';

type User = { id: string; username: string; email: string; profile: { displayName: string | null } | null };

export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  function search() {
    if (q.length < 2) return;
    setLoading(true);
    fetch(`/api/users/search?q=${encodeURIComponent(q)}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      <header className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-gray-700/60 min-h-[52px]">
        <h2 className="text-sm font-semibold text-gray-200">Search</h2>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-700/50 hover:text-gray-200 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </header>
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-2 mb-4">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && search()}
            placeholder="Search users by username or email…"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-700/50 border border-gray-600/50 text-gray-200 placeholder:text-gray-500 text-sm outline-none focus:border-gray-500"
          />
          <button
            type="button"
            onClick={search}
            disabled={loading || q.length < 2}
            className="px-4 py-2 rounded-lg bg-gray-600 text-gray-200 text-sm font-medium hover:bg-gray-500 disabled:opacity-50 disabled:hover:bg-gray-600"
          >
            Search
          </button>
        </div>
        <ul className="space-y-1">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-700/40">
              <span className="text-gray-200 text-sm truncate">{u.profile?.displayName || u.username}</span>
              <Link
                href={`/chat/new?userId=${u.id}`}
                onClick={onClose}
                className="text-xs text-blue-400 hover:underline flex-shrink-0 ml-2"
              >
                Message
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
