'use client';

export default function ChatPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center px-6">
        <p className="text-gray-500 text-sm text-center">
          Pick a friend from the middle column.
        </p>
      </div>
      <footer className="p-4 border-t border-gray-700/60">
        <div className="flex items-center gap-2 rounded-2xl bg-gray-700/50 px-4 py-2.5 border border-gray-600/50">
          <input
            type="text"
            placeholder="Type a message"
            readOnly
            className="flex-1 min-w-0 bg-transparent text-gray-200 placeholder:text-gray-500 text-sm outline-none"
          />
          <button
            type="button"
            disabled
            className="flex-shrink-0 p-1 text-gray-500 rounded-full hover:bg-gray-600/50 transition-colors disabled:opacity-50"
            aria-label="Send"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}
