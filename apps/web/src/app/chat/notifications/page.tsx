'use client';

import { useEffect, useState } from 'react';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
};

export default function NotificationsPage() {
  const [list, setList] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/notifications', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => setList(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST', credentials: 'include' });
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)));
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Notifications</h1>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {list.map((n) => (
            <li
              key={n.id}
              className={`p-3 rounded-md border ${n.readAt ? 'bg-muted/50' : 'bg-card'}`}
            >
              <div className="font-medium">{n.title}</div>
              {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(n.createdAt).toLocaleString()}
                {!n.readAt && (
                  <button
                    type="button"
                    onClick={() => markRead(n.id)}
                    className="ml-2 text-primary underline"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </li>
          ))}
          {list.length === 0 && <p className="text-muted-foreground">No notifications.</p>}
        </ul>
      )}
    </div>
  );
}
