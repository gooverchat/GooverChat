'use client';

import { useEffect, useState } from 'react';

type Friend = { id: string; username: string; profile: { displayName: string | null } | null };
let friendsPageCache: Friend[] | null = null;

export default function FriendsPage() {
  const [tab, setTab] = useState<'all' | 'pending'>('all');
  const [friends, setFriends] = useState<Friend[]>(() => friendsPageCache ?? []);
  const [loading, setLoading] = useState(() => friendsPageCache == null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    fetch('/api/conversations', { credentials: 'include', signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load conversations (${r.status})`);
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) throw new Error('Conversations response is not an array');
        const unique: Record<string, Friend> = {};
        data.forEach((c: { members: Friend[] }) => {
          c.members?.forEach((m) => {
            if (m?.id && !unique[m.id]) unique[m.id] = m;
          });
        });
        const nextFriends = Object.values(unique);
        friendsPageCache = nextFriends;
        setFriends(nextFriends);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('Could not refresh right now. Showing last known list.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Friends</h1>
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`px-3 py-1 rounded-md text-sm ${tab === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setTab('pending')}
          className={`px-3 py-1 rounded-md text-sm ${tab === 'pending' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
        >
          Pending
        </button>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <>
          {error && friends.length > 0 && (
            <p className="text-xs text-amber-600 mb-2">{error}</p>
          )}
          <ul className="space-y-2">
            {friends.map((u) => (
              <li key={u.id} className="flex items-center justify-between p-2 rounded-md hover:bg-accent">
                {u.profile?.displayName || u.username}
              </li>
            ))}
            {friends.length === 0 && <p className="text-muted-foreground">No friends yet. Use Search to find people.</p>}
          </ul>
        </>
      )}
    </div>
  );
}
