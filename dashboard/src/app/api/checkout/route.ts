import { NextRequest, NextResponse } from 'next/server';
import { koraProvider } from '@/lib/billing/kora';
import type { Plan } from '@/lib/billing/types';
import { currentUserEmail } from '@/lib/auth';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const plan = req.nextUrl.searchParams.get('plan');
  if (plan !== 'solo' && plan !== 'team') {
    return NextResponse.json({ error: 'plan must be solo or team' }, { status: 400 });
  }

  const email = await currentUserEmail();
  if (!email) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=/api/checkout?plan=${plan}`;
    return NextResponse.redirect(url);
  }

  if (!process.env.KORA_SECRET_KEY) {
    return NextResponse.json(
      { error: 'Payments not configured yet — set KORA_SECRET_KEY (see docs/payments.md)' },
      { status: 503 },
    );
  }

  try {
    const checkoutUrl = await koraProvider.createCheckout(plan as Plan, email);
    return NextResponse.redirect(checkoutUrl);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'checkout unavailable' },
      { status: 503 },
    );
  }
}
