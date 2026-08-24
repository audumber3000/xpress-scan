import React, { useEffect, useState } from 'react';
import { ANNOUNCEMENTS } from './registry';
import { currentSurface, currentOs, MOBILE_APP } from './surface';
import { readState, recordShown, recordDismissed, recordActed, recordNever } from './state';
import { pickAnnouncement } from './schedule';
import AnnouncementModal from './AnnouncementModal';

/**
 * Picks the one thing worth saying right now, and says it.
 *
 * Replaces DeviceUpsellModal, which hard-coded a single decision (desktop or
 * mobile download) into a component. Everything it did is now two entries in
 * registry.jsx, alongside the release note and the Store review ask, and a new
 * announcement is a new entry rather than a new component wired into App.jsx.
 *
 * At most one shows per page load, highest priority first. The others are not
 * marked as seen, so they simply come round next time.
 */

const AnnouncementHost = () => {
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const ctx = { surface: currentSurface(), os: currentOs() };

    // Inside the React Native shell the app has its own update and rating
    // flows, and an in-webview modal about downloading an app you are holding
    // is nonsense.
    if (ctx.surface === MOBILE_APP) return undefined;

    // A beat, so the page somebody just signed into is the first thing they
    // see. The delay is also what keeps this from fighting the welcome
    // checklist a brand new clinic gets.
    const timer = setTimeout(() => {
      const item = pickAnnouncement(ANNOUNCEMENTS, readState(), ctx);
      if (!item) return;
      recordShown(item.id);
      setCurrent({ item, ctx });
    }, 1200);

    return () => clearTimeout(timer);
  }, []);

  if (!current) return null;

  const onResolve = (outcome) => {
    if (outcome === 'acted') recordActed(current.item.id);
    else if (outcome === 'never') recordNever(current.item.id);
    else recordDismissed(current.item.id);
    setCurrent(null);
  };

  return (
    <AnnouncementModal
      announcement={current.item}
      ctx={current.ctx}
      onResolve={onResolve}
    />
  );
};

export default AnnouncementHost;
