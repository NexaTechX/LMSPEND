import { NextRequest, NextResponse } from 'next/server';
import { koraProvider } from '@/lib/billing/kora';
import { ACCESS_DAYS_PER_CHARGE } from '@/lib/billing/types';
import { getStore } from '@/lib/store';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const payload = await req.text();

  try {
    koraProvider.verifyWebhook(payload, req.headers);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'invalid webhook' },
      { status: 401 },
    );
  }

  const event = koraProvider.mapEvent(payload);
  if (!event) return NextResponse.json({ ignored: true });

  const store = getStore();
  switch (event.type) {
    case 'charge_succeeded': {
      // Each successful charge = 31 days of access. Extend from paid_until if
      // renewing early, otherwise from now.
      const user = await store.ensureUser(event.customerEmail);
      const base = user.paidUntil && new Date(user.paidUntil) > new Date()
        ? new Date(user.paidUntil)
        : new Date();
      base.setUTCDate(base.getUTCDate() + ACCESS_DAYS_PER_CHARGE);
      await store.setSubscription(event.customerEmail, event.plan, 'active', base.toISOString());
      break;
    }
    case 'charge_failed':
      await store.setSubscription(event.customerEmail, event.plan, 'past_due');
      break;
  }

  return NextResponse.json({ ok: true });
}
