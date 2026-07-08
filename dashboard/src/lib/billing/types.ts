export type Plan = 'solo' | 'team';

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'expired' | 'none';

export const PLAN_PRICES_USD: Record<Plan, number> = { solo: 19, team: 49 };

/** Days of access granted per successful charge (no native subscriptions on Kora). */
export const ACCESS_DAYS_PER_CHARGE = 31;

/**
 * Normalized billing event — whatever the gateway sends, it maps to one of
 * these. Everything downstream (store, access control) only sees this shape,
 * so swapping Kora → Paddle later touches only the provider module.
 */
export interface BillingEvent {
  type: 'charge_succeeded' | 'charge_failed';
  customerEmail: string;
  plan: Plan;
  reference: string;
}

export interface BillingProvider {
  name: string;
  /** Create a hosted USD checkout and return its URL. */
  createCheckout(plan: Plan, email: string): Promise<string>;
  /** Verify webhook authenticity. Throws on invalid signature. */
  verifyWebhook(payload: string, headers: Headers): void;
  /** Map a raw webhook body to a normalized BillingEvent (null = ignore event). */
  mapEvent(payload: string): BillingEvent | null;
}
