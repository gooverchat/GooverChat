import { NextResponse } from 'next/server';

/** Password reset is disabled for launch. Endpoint returns 501 so no tokens are created. */
export async function POST() {
  return NextResponse.json(
    { error: 'Not implemented' },
    { status: 501 }
  );
}
