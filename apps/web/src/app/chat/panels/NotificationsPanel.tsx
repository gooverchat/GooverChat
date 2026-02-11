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

export function NotificationsPanel({ onClose }: { onClose: () => void }) {
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
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      <header className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-gray-700/60 min-h-[52px]">
        <h2 className="text-sm font-semibold text-gray-200">Notifications</h2>
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
        {loading ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : (
          <ul className="space-y-2">
            {list.map((n) => (
              <li
                key={n.id}
                className={`p-3 rounded-lg border text-sm ${n.readAt ? 'bg-gray-800/30 border-gray-700/50' : 'bg-gray-700/30 border-gray-600/50'}`}
              >
                <div className="font-medium text-gray-200">{n.title}</div>
                {n.body && <div className="text-gray-500 text-xs mt-0.5">{n.body}</div>}
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                  {!n.readAt && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="ml-2 text-blue-400 hover:underline"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
            {list.length === 0 && <p className="text-gray-500 text-sm">No notifications.</p>}
          </ul>
        )}
      </div>
    </div>
  );
}
