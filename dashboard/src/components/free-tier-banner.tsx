import { paymentsEnabled } from '@/lib/billing/types';

/** Shown while free access is the only live plan (payments not enabled). */
export function FreeTierBanner() {
  if (paymentsEnabled()) return null;

  return (
    <div className="free-tier-banner" role="status">
      <span className="badge badge-amber">Early access</span>
      <p>
        You currently have complimentary Free access, including sync and current-month reporting.
        Solo and Team plans will be available when billing launches.
      </p>
    </div>
  );
}
