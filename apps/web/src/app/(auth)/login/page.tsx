'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const text = await res.text();
      let data: { error?: string; detail?: string } = {};
      if (text.trim()) {
        try {
          data = JSON.parse(text);
        } catch {
          setError(res.ok ? 'Invalid response' : 'Login failed');
          return;
        }
      }
      if (!res.ok) {
        const msg = data.error || 'Login failed';
        const detail = data.detail;
        setError(detail ? `${msg}: ${detail}` : msg);
        return;
      }
      router.push('/chat');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm border border-border rounded-lg p-6 bg-card">
        <h1 className="text-xl font-semibold mb-4">Sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-input rounded-md bg-background"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="mt-4 text-sm text-muted-foreground">
          <span className="text-muted-foreground/80">Contact support for account help.</span>
          {' · '}
          <Link href="/register" className="underline">Sign up</Link>
        </p>
      </div>
    </div>
  );
}
