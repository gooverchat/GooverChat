import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { ChatLayoutClient } from './ChatLayoutClient';
import { PresenceProvider } from './PresenceProvider';

export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get('accessToken')?.value;
  if (!token) redirect('/login');
  return (
    <PresenceProvider>
      <ChatLayoutClient>{children}</ChatLayoutClient>
    </PresenceProvider>
  );
}
