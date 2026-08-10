import { useState, useEffect } from 'react';

/**
 * Which of the three layouts the viewport is currently in.
 *
 * Thresholds match Tailwind's `md` (768px) and `lg` (1024px) so JS-driven
 * decisions (chart heights, how many buckets to draw) land on the same
 * boundaries as the CSS-driven ones. If these drift from the class names in the
 * markup you get charts resizing at a different width than the grid around
 * them, which reads as a bug even though both halves "work".
 *
 *   mobile   < 768   phone, single column
 *   tablet   768–1023  iPad portrait, two columns
 *   desktop  >= 1024   iPad landscape and up, full layout
 */
const query = (bp) => {
  if (bp === 'mobile') return '(max-width: 767px)';
  if (bp === 'tablet') return '(min-width: 768px) and (max-width: 1023px)';
  return '(min-width: 1024px)';
};

const current = () => {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(query('mobile')).matches) return 'mobile';
  if (window.matchMedia(query('tablet')).matches) return 'tablet';
  return 'desktop';
};

export function useBreakpoint() {
  const [bp, setBp] = useState(current);

  useEffect(() => {
    // One listener per band rather than a resize handler: matchMedia only fires
    // when the answer actually changes, so dragging a window edge doesn't
    // re-render the whole dashboard on every pixel.
    const lists = ['mobile', 'tablet', 'desktop'].map((name) => window.matchMedia(query(name)));
    const onChange = () => setBp(current());
    lists.forEach((l) => l.addEventListener('change', onChange));
    onChange();
    return () => lists.forEach((l) => l.removeEventListener('change', onChange));
  }, []);

  return bp;
}

export const isMobile = (bp) => bp === 'mobile';

export default useBreakpoint;
