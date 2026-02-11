'use client';

export function TypingIndicator({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-baseline gap-0.5 text-xs text-gray-400 italic truncate ${className ?? ''}`}>
      typing
      <span className="inline-flex gap-0.5 ml-0.5" aria-hidden>
        <span className="w-1 h-1 rounded-full bg-current animate-typing-dot" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 rounded-full bg-current animate-typing-dot" style={{ animationDelay: '160ms' }} />
        <span className="w-1 h-1 rounded-full bg-current animate-typing-dot" style={{ animationDelay: '320ms' }} />
      </span>
    </span>
  );
}
