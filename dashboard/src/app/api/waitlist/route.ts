import { NextRequest, NextResponse } from 'next/server';
import { getStore } from '@/lib/store';

const TOOLS = new Set(['cursor', 'copilot', 'other']);

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: unknown; tool?: unknown };
  try {
    body = (await req.json()) as { email?: unknown; tool?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const tool = typeof body.tool === 'string' && TOOLS.has(body.tool) ? body.tool : 'cursor';
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) {
    return NextResponse.json({ error: 'valid email required' }, { status: 400 });
  }

  await getStore().addToWaitlist(email, tool);
  return NextResponse.json({ ok: true });
}
