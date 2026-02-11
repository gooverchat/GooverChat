import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <h1 className="text-3xl font-bold text-primary mb-2">GooverChat</h1>
      <p className="text-muted-foreground mb-8">Web chat that just works</p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="px-4 py-2 rounded-md border border-border hover:bg-accent"
        >
          Sign up
        </Link>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        <Link href="/chat" className="underline">Go to Chat</Link> (requires auth)
      </p>
    </div>
  );
}
