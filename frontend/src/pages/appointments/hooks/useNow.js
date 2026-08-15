import { useEffect, useState } from "react";

/**
 * The current time, as state that actually advances.
 *
 * The grid's now-line was computed with a bare `new Date()` during render, so
 * it only moved when something unrelated caused a re-render. On a screen left
 * open at the front desk all day, that is most of the day: the red line sat
 * where it was when the page loaded, which is worse than not drawing it, since
 * it looks authoritative.
 *
 * Ticks on the minute boundary rather than every 60s from mount, so the
 * displayed time changes when the clock does.
 */
export default function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer;
    const tick = () => {
      setNow(new Date());
      // Re-align to the next boundary each time; a fixed interval drifts, and a
      // drifted clock shows the wrong minute for up to a minute.
      timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    };
    timer = setTimeout(tick, intervalMs - (Date.now() % intervalMs));
    return () => clearTimeout(timer);
  }, [intervalMs]);

  return now;
}
