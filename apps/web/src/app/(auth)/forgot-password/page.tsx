'use client';

import Link from 'next/link';

/** Password reset is disabled for launch. This page shows a contact-support message. */
export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm border border-border rounded-lg p-6 bg-card">
        <h1 className="text-xl font-semibold mb-4">Password reset</h1>
        <p className="text-muted-foreground text-sm">
          Password reset is not available at launch. For account help, please contact support.
        </p>
        <Link href="/login" className="mt-4 inline-block text-primary underline text-sm">Back to sign in</Link>
      </div>
    </div>
  );
}
