import React from 'react';
import { weatherArt, festivalArt } from './ambientArt';

/**
 * The two ambient notes at the top of the dashboard: the weather where the
 * clinic is, and the next festival worth knowing about.
 *
 * ─── Why it is this small ───────────────────────────────────────────────
 *
 * The first version of this space was an action card — "4 of today's 9 aren't
 * confirmed yet" with a Send reminders button. That was the wrong object for
 * the position. The top of the page is read before anyone has decided to do
 * anything, and putting a button there makes the first thing on screen a
 * demand. These are the opposite: two facts about the day, sized so they are
 * read in passing and never compete with the KPI row underneath.
 *
 * So: no card, no border, no heading. Illustration, two lines, a number. It
 * anchors to the right edge of the quick-actions row and is allowed to be
 * completely absent — a clinic with no coordinates outside India renders
 * nothing here, and the row simply has quick actions in it.
 *
 * Nothing animates and nothing rotates. A carousel in a header steals the eye
 * every few seconds from whatever the doctor is actually reading, and it hides
 * half its content behind a wait.
 */

const Item = ({ art: Art, title, sub, value, valueSub, className = '' }) => (
  <div className={`flex items-center gap-2.5 min-w-0 ${className}`}>
    <span className="w-7 h-7 flex-shrink-0">
      <Art />
    </span>
    <span className="min-w-0 leading-tight">
      <span className="block text-[12.5px] font-semibold text-gray-700 truncate">{title}</span>
      {sub && <span className="block text-[10.5px] text-gray-400 truncate">{sub}</span>}
    </span>
    {value && (
      // Proportional figures, not tabular: these are two standalone readings,
      // not a column, and equal-width digits make "31" look gappy at this size.
      <span className="flex items-baseline flex-shrink-0 ml-0.5">
        <span className="text-[15px] font-semibold text-gray-800 leading-none">{value}</span>
        {valueSub && <span className="text-[11px] text-gray-400 leading-none">/{valueSub}</span>}
      </span>
    )}
  </div>
);

const AmbientStrip = ({ data }) => {
  const weather = data?.weather;
  const festival = data?.festival;
  if (!weather && !festival) return null;

  const items = [];

  if (weather) {
    items.push({
      key: 'weather',
      urgent: false,
      art: weatherArt(weather.icon),
      title: weather.label,
      sub: weather.city || 'Today',
      value: `${weather.high}°`,
      valueSub: weather.low != null ? `${weather.low}°` : null,
    });
  }

  if (festival) {
    items.push({
      key: 'festival',
      // A festival this week outranks the weather for the one slot a narrow
      // screen has. Three weeks out it is a note; on Thursday it is a staffing
      // question.
      urgent: festival.days_away <= 7,
      art: festivalArt(festival.icon),
      title: festival.name,
      sub: festival.when,
    });
  }

  // Whichever matters more takes the single slot a narrow screen can show.
  items.sort((a, b) => Number(b.urgent) - Number(a.urgent));

  return (
    <div className="flex items-center gap-4 min-w-0">
      {items.map((item, i) => (
        <React.Fragment key={item.key}>
          {i > 0 && <span className="hidden lg:block w-px h-7 bg-gray-200 flex-shrink-0" />}
          <Item
            {...item}
            // Only the first item survives a narrow viewport. Two of these
            // side by side below lg would either wrap under the quick actions
            // or squeeze both titles into ellipses.
            className={i > 0 ? 'hidden lg:flex' : ''}
          />
        </React.Fragment>
      ))}
    </div>
  );
};

export default AmbientStrip;
