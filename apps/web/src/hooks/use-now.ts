import { useEffect, useState } from 'react';

/** Re-renders every `ms` (for live elapsed timers). Pass null to pause. */
export function useNow(ms: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ms) return;
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
