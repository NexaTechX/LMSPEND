import { NextRequest, NextResponse } from 'next/server';
import { can } from '@/lib/plan';
import { getStore } from '@/lib/store';

/**
 * Lightweight identity endpoint for the CLI (bearer API key). `lmspend watch`
 * calls this to confirm the account may stream in real time before starting.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const key = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const email = key ? await getStore().emailForApiKey(key) : null;
  if (!email) {
    return NextResponse.json({ error: 'invalid or missing API key' }, { status: 401 });
  }
  const user = await getStore().ensureUser(email);
  const access = can(user);
  return NextResponse.json({
    email,
    plan: access.plan,
    // Real-time is a paid feature AND must be toggled on in Settings.
    realtime: access.realtime && user.realtimeEnabled,
  });
}
