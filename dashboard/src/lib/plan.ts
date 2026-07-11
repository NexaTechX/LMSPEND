import { paymentsEnabled } from './billing/types';
import type { UserRecord } from './store';

/**
 * One source of truth for what a user actually gets. A signed-in account with
 * no active payment is FREE — `users.plan` only says which plan they'd renew.
 */

export type EffectivePlan = 'free' | 'solo' | 'team';

function paidWindowOpen(u: UserRecord): boolean {
  return u.paidUntil !== null && new Date(u.paidUntil) > new Date();
}

export function effectivePlan(u: UserRecord): EffectivePlan {
  // Free-tier beta: paid plans stay locked until Kora payments go live.
  if (!paymentsEnabled()) return 'free';
  // past_due keeps access while the paid window is still open (grace, no cliff)
  if ((u.subscriptionStatus === 'active' || u.subscriptionStatus === 'past_due') && paidWindowOpen(u)) {
    return u.plan;
  }
  return 'free';
}

export function isPaid(u: UserRecord): boolean {
  return effectivePlan(u) !== 'free';
}

/** What features each tier unlocks — gate against THIS, never against u.plan. */
export function can(u: UserRecord) {
  const plan = effectivePlan(u);
  return {
    plan,
    history: plan !== 'free',        // months beyond the current one
    budgets: plan !== 'free',        // budget + unusual-day alert emails
    emailReports: plan !== 'free',   // monthly report email
    realtime: plan !== 'free',       // live watch daemon + auto-refreshing dashboard
    teamFeatures: plan === 'team',
  };
}

/** Badge label + css modifier for consistent display everywhere. */
export function planBadge(u: UserRecord): { label: string; className: string } {
  const plan = effectivePlan(u);
  if (plan === 'free') {
    if (!paymentsEnabled()) {
      return { label: 'free · early access', className: 'badge-amber' };
    }
    if (u.subscriptionStatus === 'expired' || u.subscriptionStatus === 'cancelled') {
      return { label: `free · ${u.plan} lapsed`, className: 'badge-warn' };
    }
    return { label: 'free', className: 'badge-free' };
  }
  if (u.subscriptionStatus === 'past_due') {
    return { label: `${plan} · payment issue`, className: 'badge-warn' };
  }
  return { label: plan, className: 'badge-active' };
}
