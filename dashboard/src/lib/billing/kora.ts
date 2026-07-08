import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { BillingEvent, BillingProvider, Plan } from './types';
import { PLAN_PRICES_USD } from './types';

/**
 * Kora (Korapay) — Nigerian payment gateway that onboards individual
 * businesses. NOT a merchant of record: we are the seller; Kora processes
 * cards (incl. international Visa/Mastercard) via a hosted checkout.
 *
 * No native subscriptions → each successful charge grants 31 days of access
 * (paid_until); a cron emails a renewal link before expiry.
 *
 * API: POST /merchant/api/v1/charges/initialize → { data: { checkout_url } }
 * Webhook: `x-korapay-signature` = HMAC-SHA256 (hex) of JSON.stringify(payload.data)
 * signed with the Kora secret key.
 *
 * TODO(before launch): sandbox-test against the live Kora dashboard — confirm
 * USD availability on the account (fallback: NGN with converted amounts),
 * amount units, and webhook payload field names.
 */

const API_BASE = 'https://api.korapay.com/merchant/api/v1';

function secretKey(): string {
  const key = process.env.KORA_SECRET_KEY;
  if (!key) throw new Error('KORA_SECRET_KEY not configured');
  return key;
}

/**
 * Kora caps `reference` at 50 chars, so it carries only the plan; the
 * customer email travels in `metadata` (echoed back in webhooks) and in
 * `customer.email`.
 */
export function buildReference(plan: Plan): string {
  return `lm-${plan}-${randomBytes(8).toString('hex')}`; // max 24 chars
}

export function planFromReference(reference: string): Plan | null {
  const m = /^lm-(solo|team)-[a-f0-9]{16}$/.exec(reference);
  return m ? (m[1] as Plan) : null;
}

export const koraProvider: BillingProvider = {
  name: 'kora',

  async createCheckout(plan: Plan, email: string): Promise<string> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const currency = process.env.KORA_CURRENCY ?? 'USD';

    const res = await fetch(`${API_BASE}/charges/initialize`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secretKey()}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        amount: PLAN_PRICES_USD[plan],
        currency,
        reference: buildReference(plan),
        narration: `LMSpend ${plan} - 31 days`,
        customer: { email },
        redirect_url: `${appUrl}/dashboard?welcome=1`,
        notification_url: `${appUrl}/api/webhooks/billing`,
        metadata: { plan, email },
      }),
    });

    const body = (await res.json()) as {
      status?: boolean;
      message?: string;
      data?: { checkout_url?: string };
    };
    if (!res.ok || !body.status || !body.data?.checkout_url) {
      throw new Error(`Kora charge init failed: ${body.message ?? res.status}`);
    }
    return body.data.checkout_url;
  },

  verifyWebhook(payload: string, headers: Headers): void {
    const signature = headers.get('x-korapay-signature');
    if (!signature) throw new Error('missing x-korapay-signature header');

    let data: unknown;
    try {
      data = (JSON.parse(payload) as { data?: unknown }).data;
    } catch {
      throw new Error('invalid webhook JSON');
    }
    if (data === undefined) throw new Error('webhook payload has no data field');

    const expected = createHmac('sha256', secretKey())
      .update(JSON.stringify(data))
      .digest('hex');

    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error('invalid webhook signature');
    }
  },

  mapEvent(payload: string): BillingEvent | null {
    const body = JSON.parse(payload) as {
      event?: string;
      data?: {
        reference?: string;
        status?: string;
        metadata?: { plan?: string; email?: string };
        customer?: { email?: string };
      };
    };
    const d = body.data;
    if (!body.event || !d?.reference) return null;

    const email = d.customer?.email ?? d.metadata?.email;
    const plan = (d.metadata?.plan === 'team' || d.metadata?.plan === 'solo')
      ? d.metadata.plan
      : planFromReference(d.reference);
    if (!email || !plan) return null;

    switch (body.event) {
      case 'charge.success':
        return { type: 'charge_succeeded', customerEmail: email, plan, reference: d.reference };
      case 'charge.failed':
        return { type: 'charge_failed', customerEmail: email, plan, reference: d.reference };
      default:
        return null;
    }
  },
};
