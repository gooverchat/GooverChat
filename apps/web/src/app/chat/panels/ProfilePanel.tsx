'use client';

export function ProfilePanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full bg-[#1a1a1a]">
      <header className="flex items-center justify-between flex-shrink-0 px-4 py-3 border-b border-gray-700/60 min-h-[52px]">
        <h2 className="text-sm font-semibold text-gray-200">Profile</h2>
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
        <div className="rounded-lg border border-gray-600/50 bg-gray-800/30 p-4 text-center">
          <p className="text-gray-300 text-sm font-medium mb-1">Customize your profile</p>
          <p className="text-gray-500 text-xs mb-3">
            Change your photo, display name, and more.
          </p>
          <span className="inline-block px-3 py-1.5 rounded-lg bg-gray-700/60 text-gray-400 text-xs font-medium">
            Coming in feature
          </span>
        </div>
      </div>
    </div>
  );
}
