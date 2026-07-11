import Link from 'next/link';
import { paymentsEnabled } from '@/lib/billing/types';

/** Paid-plan CTA — links to checkout when live, otherwise a disabled button. */
export function UpgradeCta({
  href,
  className,
  children,
  disabledLabel = 'Available at launch',
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  disabledLabel?: string;
}) {
  if (!paymentsEnabled()) {
    return (
      <button
        type="button"
        className={className}
        disabled
        title="Solo and Team plans will be available when billing launches"
      >
        {disabledLabel}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
