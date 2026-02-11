'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function logout() {
    setLoading(true);
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-lg font-semibold mb-4">Settings</h1>
      <div className="space-y-4">
        <section>
          <h2 className="font-medium mb-2">Account</h2>
          <p className="text-sm text-muted-foreground mb-2">Manage email, password, and devices.</p>
        </section>
        <section>
          <h2 className="font-medium mb-2">Privacy & Security</h2>
          <p className="text-sm text-muted-foreground mb-2">Block list, read receipts, typing indicator.</p>
        </section>
        <section>
          <button
            type="button"
            onClick={logout}
            disabled={loading}
            className="px-4 py-2 rounded-md border border-destructive text-destructive hover:bg-destructive/10"
          >
            Sign out
          </button>
        </section>
      </div>
    </div>
  );
}
