'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function logout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    onClose();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      <header className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-gray-700/60 min-h-[52px]">
        <h2 className="text-sm font-semibold text-gray-200">Settings</h2>
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
        <div className="space-y-5">
          <section>
            <h3 className="font-medium text-gray-200 text-sm mb-1">Privacy & Security</h3>
            <p className="text-xs text-gray-500">Block list, read receipts, typing indicator.</p>
          </section>
          <section>
            <button
              type="button"
              onClick={logout}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-red-500/60 text-red-400 hover:bg-red-500/10 text-sm disabled:opacity-50"
            >
              Sign out
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
