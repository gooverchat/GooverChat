'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/** conversationId -> list of userIds who are currently typing */
type TypingState = Record<string, string[]>;
/** conversationId -> userId -> timestamp (show "typing" until at least this time) */
type TypingDisplayUntil = Record<string, Record<string, number>>;

type PresenceContextValue = {
  isOnline: (userId: string) => boolean;
  onlineUserIds: Set<string>;
  /** Join a conversation room so you can send/receive typing for it */
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  /** User IDs currently typing in this conversation (excluding current user) */
  getTypingUserIds: (conversationId: string) => string[];
  isUserTypingInConversation: (conversationId: string, userId: string) => boolean;
};

const PresenceContext = createContext<PresenceContextValue | null>(null);

export function usePresence() {
  const ctx = useContext(PresenceContext);
  return ctx;
}

const TYPING_MIN_DISPLAY_MS = 3000;

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [typingByConversation, setTypingByConversation] = useState<TypingState>({});
  const [typingDisplayUntil, setTypingDisplayUntil] = useState<TypingDisplayUntil>({});
  const socketRef = useRef<ReturnType<typeof import('socket.io-client').io> | null>(null);

  const isOnline = useCallback((userId: string) => onlineUserIds.has(userId), [onlineUserIds]);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('conversation:join', conversationId);
  }, []);

  const leaveConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit('conversation:leave', conversationId);
  }, []);

  const startTyping = useCallback((conversationId: string) => {
    if (conversationId) socketRef.current?.emit('typing:start', { conversationId });
  }, []);

  const stopTyping = useCallback((conversationId: string) => {
    if (conversationId) socketRef.current?.emit('typing:stop', { conversationId });
  }, []);

  const getTypingUserIds = useCallback(
    (conversationId: string) => {
      const inSet = typingByConversation[conversationId] ?? [];
      const until = typingDisplayUntil[conversationId];
      const now = Date.now();
      const fromUntil = until ? Object.entries(until).filter(([, ts]) => ts > now).map(([uid]) => uid) : [];
      return [...new Set([...inSet, ...fromUntil])];
    },
    [typingByConversation, typingDisplayUntil]
  );

  const isUserTypingInConversation = useCallback(
    (conversationId: string, userId: string) => {
      if ((typingByConversation[conversationId] ?? []).includes(userId)) return true;
      const until = typingDisplayUntil[conversationId]?.[userId];
      return until != null && Date.now() < until;
    },
    [typingByConversation, typingDisplayUntil]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/socket-token', { credentials: 'include' });
        if (!res.ok || !mounted) return;
        const { token } = await res.json();
        if (!token || !mounted) return;

        const { io } = await import('socket.io-client');
        const socket = io(window.location.origin, {
          path: '/api/socket',
          auth: { token },
          transports: ['websocket', 'polling'],
        });
        socketRef.current = socket;

        socket.on('presence:initial', (data: { userIds?: string[] }) => {
          if (!mounted || !data.userIds) return;
          setOnlineUserIds(new Set(data.userIds));
        });

        socket.on('presence:update', (data: { userId?: string; status?: string }) => {
          if (!mounted || !data.userId) return;
          setOnlineUserIds((prev) => {
            const next = new Set(prev);
            if (data.status === 'online') next.add(data.userId!);
            else next.delete(data.userId!);
            return next;
          });
        });

        socket.on('typing:start', (data: { userId?: string; conversationId?: string }) => {
          if (!mounted || !data?.userId || !data?.conversationId) return;
          const cid = data.conversationId!;
          const uid = data.userId!;
          const minDisplayUntil = Date.now() + TYPING_MIN_DISPLAY_MS;
          setTypingByConversation((prev) => {
            const existing = prev[cid] ?? [];
            if (existing.includes(uid)) return prev;
            return { ...prev, [cid]: [...existing, uid] };
          });
          setTypingDisplayUntil((prev) => ({
            ...prev,
            [cid]: { ...(prev[cid] ?? {}), [uid]: minDisplayUntil },
          }));
        });

        socket.on('typing:stop', (data: { userId?: string; conversationId?: string }) => {
          if (!mounted || !data?.userId || !data?.conversationId) return;
          setTypingByConversation((prev) => {
            const existing = prev[data.conversationId!] ?? [];
            const next = existing.filter((id) => id !== data.userId);
            if (next.length === 0) {
              const { [data.conversationId!]: _, ...rest } = prev;
              return rest;
            }
            return { ...prev, [data.conversationId!]: next };
          });
        });

        socket.on('connect_error', () => {
          // Optional: could set a "disconnected" state for UI
        });
      } catch {
        // Token fetch or socket init failed
      }
    })();
    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingDisplayUntil((prev) => {
        const next: TypingDisplayUntil = {};
        for (const [cid, users] of Object.entries(prev)) {
          const filtered = Object.fromEntries(
            Object.entries(users).filter(([, ts]) => ts > now)
          );
          if (Object.keys(filtered).length > 0) next[cid] = filtered;
        }
        return Object.keys(next).length === 0 ? prev : next;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const value: PresenceContextValue = {
    isOnline,
    onlineUserIds,
    joinConversation,
    leaveConversation,
    startTyping,
    stopTyping,
    getTypingUserIds,
    isUserTypingInConversation,
  };

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}
