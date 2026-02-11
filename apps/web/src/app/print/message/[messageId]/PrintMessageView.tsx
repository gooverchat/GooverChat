'use client';

type Message = {
  id: string;
  text: string | null;
  type: string;
  createdAt: Date | string;
  editedAt: Date | string | null;
  sender: { username: string; profile: { displayName: string | null } | null } | null;
  replyTo: { text: string | null; createdAt: Date | string } | null;
  conversation: { name: string | null; type: string };
};

export function PrintMessageView({ message }: { message: Message }) {
  const conversationName = message.conversation.name || `Conversation (${message.conversation.type})`;
  const senderName = message.sender?.profile?.displayName || message.sender?.username || 'System';

  return (
    <div className="print-only p-8 max-w-2xl mx-auto">
      <div className="no-print mb-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-primary">GooverChat</h1>
        <button
          type="button"
          onClick={() => window.print()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Print
        </button>
      </div>
      <div className="border border-border rounded-lg p-6">
        <p className="text-sm text-muted-foreground mb-1">Conversation: {conversationName}</p>
        <p className="text-sm text-muted-foreground mb-2">From: {senderName}</p>
        {message.replyTo && (
          <div className="text-sm border-l-2 border-muted pl-2 mb-2 text-muted-foreground">
            Quoted: {message.replyTo.text}
          </div>
        )}
        <div className="text-base my-4">{message.text}</div>
        <p className="text-sm text-muted-foreground">
          {new Date(message.createdAt).toLocaleString()}
          {message.editedAt && ' (edited)'}
        </p>
      </div>
    </div>
  );
}
