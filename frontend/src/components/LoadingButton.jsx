import React, { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import GearLoader from './GearLoader';

/**
 * A button that reports on its own action.
 *
 * Tier 2 of the feedback rule in `utils/notify.js`, success half. When a save
 * changes something you can see, the screen is the confirmation and nothing
 * else is needed. When it does not — a toggle, a preference, a re-send — the
 * button says so itself, where the click happened, instead of firing a toast
 * into the corner.
 *
 * Pass `saved` and the label becomes "Saved ✓" for a beat, then goes back on
 * its own. The caller flips one boolean and forgets about it; the revert is
 * handled here so every screen holds it for the same length of time.
 *
 *   const [saved, setSaved] = useState(false);
 *   ...
 *   await api.put(...);
 *   setSaved(true);            // no toast
 *
 *   <LoadingButton loading={saving} saved={saved} onSaved={() => setSaved(false)}>
 *     Save changes
 *   </LoadingButton>
 */
const HOLD_MS = 1500;

const LoadingButton = ({
  children,
  loading = false,
  saved = false,
  savedLabel = 'Saved',
  onSaved,
  disabled = false,
  className = "",
  onClick,
  type = "button",
  title = "",
  ...props
}) => {
  const [showSaved, setShowSaved] = useState(false);
  // Held in a ref so the timer effect does not restart every time the parent
  // re-renders with a new inline arrow function.
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (!saved) return;
    setShowSaved(true);
    const t = setTimeout(() => {
      setShowSaved(false);
      onSavedRef.current?.();   // let the caller reset its own flag
    }, HOLD_MS);
    return () => clearTimeout(t);
  }, [saved]);

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-2 transition-all duration-200 ${className} ${
        disabled || loading ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      title={title}
      {...props}
    >
      {loading && <GearLoader size="w-4 h-4" />}
      {/* The tick is the whole message, so it replaces the label rather than
          crowding in beside it. No animation on the swap: a button that pulses
          every time you save it becomes the thing you notice instead of the
          work. */}
      {showSaved && !loading ? (
        <>
          <Check size={16} strokeWidth={3} />
          {savedLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
};

export default LoadingButton;
