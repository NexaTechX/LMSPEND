'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * When real-time is on, poll the server for fresh data and show a live pulse.
 * router.refresh() re-runs the server component without a full navigation.
 */
export function LiveRefresh({ intervalMs = 12000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const refresh = setInterval(() => {
      router.refresh();
      setSecondsAgo(0);
    }, intervalMs);
    const tick = setInterval(() => setSecondsAgo((s) => s + 1), 1000);
    return () => {
      clearInterval(refresh);
      clearInterval(tick);
    };
  }, [router, intervalMs]);

  return (
    <span className="live-pill" title="Real-time tracking is on">
      <span className="live-dot" />
      LIVE
      <span className="live-age">updated {secondsAgo}s ago</span>
    </span>
  );
}
