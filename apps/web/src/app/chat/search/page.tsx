'use client';

import { useState } from 'react';
import Link from 'next/link';

type User = { id: string; username: string; email: string; profile: { displayName: string | null } | null };

export default function SearchPage() {
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
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Search</h1>
      <div className="flex gap-2 mb-4">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          placeholder="Search users by username or email…"
          className="flex-1 px-3 py-2 border border-input rounded-md bg-background"
        />
        <button
          type="button"
          onClick={search}
          disabled={loading || q.length < 2}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
        >
          Search
        </button>
      </div>
      <ul className="space-y-2">
        {users.map((u) => (
          <li key={u.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
            <span>{u.profile?.displayName || u.username}</span>
            <Link href={`/chat/new?userId=${u.id}`} className="text-sm text-primary underline">
              Message
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
