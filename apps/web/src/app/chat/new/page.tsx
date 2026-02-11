'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function NewChatPage() {
  const searchParams = useSearchParams();
  const userId = searchParams.get('userId');
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setCreating(true);
    fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ type: 'direct', memberIds: [userId] }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.id) router.replace(`/chat/${data.id}`);
        else setCreating(false);
      })
      .catch(() => setCreating(false));
  }, [userId, router]);

  if (userId) {
    return (
      <div className="p-4">
        {creating ? 'Creating conversation…' : 'Redirecting…'}
      </div>
    );
  }

  return (
    <div className="p-4">
      <p className="text-muted-foreground">Search for a user and click &quot;Message&quot; to start a chat.</p>
      <a href="/chat/search" className="text-primary underline mt-2 inline-block">Go to Search</a>
    </div>
  );
}
