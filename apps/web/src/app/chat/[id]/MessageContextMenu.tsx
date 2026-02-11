'use client';

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

const EMOJI_ROW = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

type MessageContextMenuProps = {
  messageId: string;
  messageText: string | null;
  isMine: boolean;
  otherParticipantName: string | null;
  isMenuOpen: boolean;
  menuPos: { x: number; y: number };
  onOpenMenu: (clientX: number, clientY: number) => void;
  onCloseMenu: () => void;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, currentText: string) => void | Promise<void>;
  onDeleteForMe: (messageId: string) => void;
  onDeleteForEveryone: (messageId: string) => void;
  children: React.ReactNode;
};

export function MessageContextMenu({
  messageId,
  messageText,
  isMine,
  otherParticipantName,
  isMenuOpen,
  menuPos,
  onOpenMenu,
  onCloseMenu,
  onReact,
  onEdit,
  onDeleteForMe,
  onDeleteForEveryone,
  children,
}: MessageContextMenuProps) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuClickedRef = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_MS = 500;

  const closeMenu = useCallback(() => {
    setEditingMessageId(null);
    longPressTimer.current && clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    onCloseMenu();
  }, [onCloseMenu]);

  const openMenuAt = useCallback((clientX: number, clientY: number) => {
    const padding = 12;
    const menuWidth = 220;
    const menuHeight = 220;
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : padding * 2;
    const viewportH = typeof window !== 'undefined' ? window.innerHeight : padding * 2;
    const x = Math.max(padding, Math.min(clientX, viewportW - menuWidth - padding));
    const y = Math.max(padding, Math.min(clientY, viewportH - menuHeight - padding));
    onOpenMenu(x, y);
  }, [onOpenMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openMenuAt(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    const startX = t.clientX;
    const startY = t.clientY;
    touchStartPos.current = { x: startX, y: startY };
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null;
      openMenuAt(startX, startY);
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPos.current || !longPressTimer.current) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = Math.abs(t.clientX - touchStartPos.current.x);
    const dy = Math.abs(t.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    touchStartPos.current = null;
  };

  useLayoutEffect(() => {
    if (!isMenuOpen || !menuRef.current || typeof window === 'undefined') return;
    const el = menuRef.current;
    const rect = el.getBoundingClientRect();
    const padding = 12;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    let x = rect.left;
    let y = rect.top;
    if (rect.right > viewportW - padding) x = viewportW - rect.width - padding;
    if (rect.bottom > viewportH - padding) y = viewportH - rect.height - padding;
    if (x < padding) x = padding;
    if (y < padding) y = padding;
    if (x !== rect.left || y !== rect.top) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }
  }, [isMenuOpen, editingMessageId]);

  useEffect(() => {
    if (!isMenuOpen) setEditingMessageId(null);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      // Don't close when pointer went down inside the menu (e.g. "Edit message" button)
      if (menuClickedRef.current) {
        menuClickedRef.current = false;
        return;
      }
      if (menuRef.current?.contains(e.target as Node)) return;
      closeMenu();
    };
    const timeout = setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isMenuOpen, closeMenu]);

  const handleReact = (emoji: string) => {
    onReact(messageId, emoji);
    closeMenu();
  };

  const handleEditClick = () => {
    setEditingMessageId(messageId);
    setEditText(messageText ?? '');
  };

  const handleEditSubmit = async () => {
    if (editingMessageId !== messageId) {
      setEditingMessageId(null);
      closeMenu();
      return;
    }
    const newText = editText.trim();
    if (newText !== (messageText ?? '').trim()) {
      await Promise.resolve(onEdit(messageId, newText));
    }
    setEditingMessageId(null);
    closeMenu();
  };

  const deleteForEveryoneLabel = otherParticipantName
    ? `Delete for me and ${otherParticipantName}`
    : 'Delete for me and everyone';

  return (
    <div
      ref={wrapperRef}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      className="relative select-none"
      style={{ WebkitTouchCallout: 'none' } as React.CSSProperties}
    >
      {children}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[220px] max-h-[calc(100vh-24px)] overflow-y-auto rounded-lg bg-gray-800 border border-gray-600 shadow-xl"
          style={{ left: menuPos.x, top: menuPos.y }}
          onMouseDownCapture={() => { menuClickedRef.current = true; }}
          onClick={(e) => e.stopPropagation()}
        >
          {editingMessageId === messageId ? (
            <div className="p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-gray-700 rounded border border-gray-600 text-gray-200 outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Edit message"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditSubmit();
                  if (e.key === 'Escape') closeMenu();
                }}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleEditSubmit}
                  className="flex-1 px-2 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded text-white"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setEditingMessageId(null); closeMenu(); }}
                  className="flex-1 px-2 py-1.5 text-xs bg-gray-600 hover:bg-gray-500 rounded text-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center gap-2 px-4 py-3 border-b border-gray-600/60">
                {EMOJI_ROW.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleReact(emoji)}
                    className="text-xl p-1.5 hover:bg-gray-700 rounded transition-colors"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <div className="py-1">
                {isMine && (
                  <button
                    type="button"
                    onClick={handleEditClick}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    Edit message
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { onDeleteForMe(messageId); closeMenu(); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700"
                >
                  Delete for me
                </button>
                {isMine && (
                  <button
                    type="button"
                    onClick={() => { onDeleteForEveryone(messageId); closeMenu(); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-200 hover:bg-gray-700"
                  >
                    {deleteForEveryoneLabel}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
