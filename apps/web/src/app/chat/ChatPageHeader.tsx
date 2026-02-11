'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function ChatPageHeader() {
  const router = useRouter();

  return (
    <header className="p-4 border-b border-border flex items-center gap-2">
      <input
        type="search"
        placeholder="Search chats…"
        className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-sm"
        readOnly
        onClick={() => router.push('/chat/search')}
      />
      <Link href="/chat/new" className="p-2 rounded-md hover:bg-accent">
        New chat
      </Link>
    </header>
  );
}
