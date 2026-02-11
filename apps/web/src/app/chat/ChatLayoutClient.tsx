'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChatList } from './ChatList';
import { FriendsPanel } from './panels/FriendsPanel';
import { SettingsPanel } from './panels/SettingsPanel';
import { NotificationsPanel } from './panels/NotificationsPanel';
import { ProfilePanel } from './panels/ProfilePanel';
import { SearchPanel } from './panels/SearchPanel';

const SearchIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);
const PersonIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);
const GearIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);
const BellIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);
const ChatIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
);
type Column2Panel = null | 'search' | 'profile' | 'friends' | 'settings' | 'notifications';

export function ChatLayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; displayName: string | null; avatarUrl: string | null } | null>(null);
  const [column2Panel, setColumn2Panel] = useState<Column2Panel>(null);

  function openMobileChat() {
    setColumn2Panel(null);
    router.push('/chat');
  }

  useEffect(() => {
    fetch('/api/me', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('chat-viewport-lock');
    return () => document.documentElement.classList.remove('chat-viewport-lock');
  }, []);

  const initial = user?.displayName?.[0] ?? user?.username?.[0] ?? '?';
  const displayName = user?.displayName ?? user?.username ?? '';

  const chatSegment = pathname.split('/')[2];
  const knownChatRoutes = ['friends', 'new', 'notifications', 'search', 'settings'];
  const isConversationPage =
    pathname.startsWith('/chat/') && !!chatSegment && !knownChatRoutes.includes(chatSegment);

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] md:h-screen max-h-[100dvh] md:max-h-none bg-[#1a1a1a] text-gray-200 dark overflow-hidden">
      {/* Left sidebar - narrow strip (desktop only) */}
      <aside className="hidden md:flex w-[72px] flex-shrink-0 flex-col items-center border-r border-gray-700/60 bg-[#141414] py-4">
        <button
          type="button"
          onClick={() => setColumn2Panel(null)}
          className={`p-2 rounded-lg transition-colors ${!column2Panel ? 'text-gray-200 bg-gray-700/50' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
          aria-label="Chat"
        >
          <ChatIcon />
        </button>
        <button
          type="button"
          onClick={() => setColumn2Panel('search')}
          className={`p-2 rounded-lg transition-colors ${column2Panel === 'search' ? 'text-gray-200 bg-gray-700/50' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
          aria-label="Search"
        >
          <SearchIcon />
        </button>
        <div className="flex-1" />
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setColumn2Panel('notifications')}
            className={`p-2 rounded-lg transition-colors ${column2Panel === 'notifications' ? 'text-gray-200 bg-gray-700/50' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
            aria-label="Notifications"
          >
            <BellIcon />
          </button>
          <button
            type="button"
            onClick={() => setColumn2Panel('settings')}
            className={`p-2 rounded-lg transition-colors ${column2Panel === 'settings' ? 'text-gray-200 bg-gray-700/50' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
            aria-label="Settings"
          >
            <GearIcon />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setColumn2Panel('profile')}
          className={`p-2 rounded-lg transition-colors mt-1 ${column2Panel === 'profile' ? 'text-gray-200 bg-gray-700/50' : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'}`}
          aria-label="Profile"
          title={displayName || 'Profile'}
        >
          <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs font-medium text-white overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initial.toUpperCase()
            )}
          </div>
        </button>
      </aside>

      {/* Middle column - conversation list or panel (Friends / Settings / Notifications) */}
      <section className="hidden md:flex w-[340px] flex-shrink-0 flex-col border-r border-gray-700/60 bg-[#1a1a1a] min-h-0">
        {column2Panel === 'search' ? (
          <SearchPanel onClose={() => setColumn2Panel(null)} />
        ) : column2Panel === 'profile' ? (
          <ProfilePanel onClose={() => setColumn2Panel(null)} />
        ) : column2Panel === 'friends' ? (
          <FriendsPanel onClose={() => setColumn2Panel(null)} />
        ) : column2Panel === 'settings' ? (
          <SettingsPanel onClose={() => setColumn2Panel(null)} />
        ) : column2Panel === 'notifications' ? (
          <NotificationsPanel onClose={() => setColumn2Panel(null)} />
        ) : (
          <div className="flex-1 overflow-auto min-h-0">
            <ChatList />
          </div>
        )}
      </section>

      {/* Main area: desktop = right column (chat); mobile = full screen when in conversation, else list/panels */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#0d0d0d]">
        {/* Mobile: full-screen conversation or panel/list */}
        <div className="md:hidden flex flex-col flex-1 min-h-0 overflow-hidden">
          {column2Panel === 'search' ? (
            <SearchPanel onClose={() => setColumn2Panel(null)} />
          ) : column2Panel === 'profile' ? (
            <ProfilePanel onClose={() => setColumn2Panel(null)} />
          ) : column2Panel === 'friends' ? (
            <FriendsPanel onClose={() => setColumn2Panel(null)} />
          ) : column2Panel === 'settings' ? (
            <SettingsPanel onClose={() => setColumn2Panel(null)} />
          ) : column2Panel === 'notifications' ? (
            <NotificationsPanel onClose={() => setColumn2Panel(null)} />
          ) : pathname === '/chat' ? (
            <div className="flex-1 overflow-auto min-h-0 bg-[#1a1a1a]"><ChatList /></div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden w-full">
              {children}
            </div>
          )}
        </div>
        {/* Desktop: right column = chat only */}
        <div className="hidden md:flex flex-col flex-1 min-h-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav - hidden when viewing a conversation so the chat is full screen; use back arrow in header to return */}
      {!isConversationPage && (
      <nav className="md:hidden flex flex-shrink-0 border-t border-gray-700/60 bg-[#141414] justify-around py-2 safe-area-pb">
        <button
          type="button"
          onClick={openMobileChat}
          className={`flex flex-col items-center gap-0.5 px-2 py-2 min-w-0 text-xs transition-colors ${!column2Panel ? 'text-gray-200' : 'text-gray-500'}`}
        >
          <ChatIcon />
          Chats
        </button>
        <button
          type="button"
          onClick={() => setColumn2Panel('search')}
          className={`flex flex-col items-center gap-0.5 px-2 py-2 min-w-0 text-xs transition-colors ${column2Panel === 'search' ? 'text-gray-200' : 'text-gray-500'}`}
        >
          <SearchIcon />
          Search
        </button>
        <button
          type="button"
          onClick={() => setColumn2Panel('notifications')}
          className={`flex flex-col items-center gap-0.5 px-2 py-2 min-w-0 text-xs transition-colors ${column2Panel === 'notifications' ? 'text-gray-200' : 'text-gray-500'}`}
        >
          <BellIcon />
          Notifications
        </button>
        <button
          type="button"
          onClick={() => setColumn2Panel('settings')}
          className={`flex flex-col items-center gap-0.5 px-2 py-2 min-w-0 text-xs transition-colors ${column2Panel === 'settings' ? 'text-gray-200' : 'text-gray-500'}`}
        >
          <GearIcon />
          Settings
        </button>
        <button
          type="button"
          onClick={() => setColumn2Panel('profile')}
          className={`flex flex-col items-center gap-0.5 px-2 py-2 min-w-0 text-xs transition-colors ${column2Panel === 'profile' ? 'text-gray-200' : 'text-gray-500'}`}
        >
          <PersonIcon />
          Profile
        </button>
      </nav>
      )}
    </div>
  );
}
