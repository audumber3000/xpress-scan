import React from 'react';
import KpiSparkline from './KpiSparkline';

/**
 * A KPI card that says what its number means.
 *
 * Shared by the dashboard and the Payments screen — one component, so the two
 * can't drift apart. `icon` is a rendered node rather than a key into a lookup
 * table, which is what lets the two screens use different icon sets without
 * this file knowing about either.
 *
 * Four variants share one shell:
 *   hero      — filled navy, the one number worth reading first
 *   spark     — 7-day shape under the value
 *   meter     — a part-of-whole bar (collected-of-billed, aged-of-outstanding)
 *   breakdown — labelled rows, for a value that is really a sum of parts
 *
 * Every variant carries a `story`: one plain sentence naming the figures behind
 * the headline. That sentence is the point — a number with a percentage next to
 * it isn't information.
 *
 * A card that opens a drawer says so. Doctors were not finding the detail views
 * because a card with a hover border reads as decoration, and Tailwind v4 gives
 * a <button> `cursor: default`, so even the pointer said "not clickable". On
 * hover the story line swaps for the invitation — same line, same height, so
 * nothing shifts. A card with no `onClick` now stays inert on hover instead of
 * lighting up like the ones that do something.
 */

// A rise is good for revenue and patients, bad for outstanding dues. Without
// this an increase in money owed renders in confident green.
const deltaTone = (changeType, invert) => {
  const rising = changeType === 'up';
  const good = invert ? !rising : rising;
  return good ? 'good' : 'bad';
};

const DeltaPill = ({ change, changeType, invert, hero, label }) => {
  // No comparison available is different from a comparison that came out flat.
  // Payments' summary has no period-over-period figure, so rendering "— 0%" on
  // every card there would be four pills asserting something nobody measured.
  if (change === undefined || change === null) return null;

  const flat = Math.abs(Number(change)) === 0;
  const tone = deltaTone(changeType, invert);

  if (hero) {
    return (
      <span title={label} className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white whitespace-nowrap">
        {flat ? '— 0%' : `${changeType === 'up' ? '▲' : '▼'} ${Math.abs(change)}%`}
      </span>
    );
  }

  const cls = flat
    ? 'bg-gray-100 text-gray-500'
    : tone === 'good'
      ? 'bg-green-50 text-green-700'
      : 'bg-red-50 text-red-600';

  return (
    <span title={label} className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {flat ? '— 0%' : `${changeType === 'up' ? '▲' : '▼'} ${Math.abs(change)}%`}
    </span>
  );
};

/**
 * A pill that states a fact rather than a change — "2 overdue", "5 unbilled".
 * Separate from DeltaPill because it carries no direction and must never be
 * read as a trend.
 */
const Badge = ({ text, tone = 'warn' }) => {
  const cls = tone === 'bad'
    ? 'bg-red-50 text-red-600'
    : tone === 'good'
      ? 'bg-green-50 text-green-700'
      : 'bg-amber-50 text-amber-700';
  return (
    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {text}
    </span>
  );
};

const Meter = ({ percent, hero, tone = 'primary' }) => {
  const width = `${Math.min(100, Math.max(0, Number(percent) || 0))}%`;
  const fill = hero ? 'bg-white' : tone === 'warn' ? 'bg-amber-500' : 'bg-[#2a276e]';
  return (
    <div className={`h-1.5 rounded-full overflow-hidden ${hero ? 'bg-white/25' : 'bg-gray-100'}`}>
      <div className={`h-full rounded-full transition-all duration-500 ${fill}`} style={{ width }} />
    </div>
  );
};

const Breakdown = ({ rows }) => (
  <div className="flex flex-col gap-1">
    {rows.map(({ label, value, color }) => (
      <div key={label} className="flex items-center gap-2 pt-1 border-t border-gray-100 text-[11px]">
        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
        <span className="text-gray-500 flex-1 truncate">{label}</span>
        <span className="font-bold text-gray-800 tabular-nums">{value}</span>
      </div>
    ))}
  </div>
);

const MetricCard = ({
  title,
  display,          // pre-formatted headline string
  change,
  changeType,
  // What the pill compared, in words. Payments measures its arrows over a
  // month while the headline covers everything the filters select, so the two
  // windows differ and the pill has to be able to say so.
  changeLabel,
  invert = false,
  badge,
  badgeTone,
  icon,
  variant = 'plain',
  story,            // narrative sentence (desktop / tablet)
  storyShort,       // shorter variant for phones, where cards are 2-up
  meterPercent,
  meterTone,
  meterLeft,
  meterRight,
  sparkline,
  sparklineHighlight,
  rows,
  onClick,
  // What the drawer behind this card is called. Shown on hover, so it should
  // finish the sentence "…" rather than repeat the card's own title.
  actionLabel = 'See the breakdown',
  className = '',
}) => {
  const hero = variant === 'hero';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative overflow-hidden rounded-xl p-3.5 md:p-4 flex flex-col gap-2 min-w-0 min-h-[6.5rem] text-left border transition-colors ${
        onClick ? 'cursor-pointer' : 'cursor-default'
      } ${
        hero
          ? `bg-[#2a276e] border-[#2a276e] text-white ${onClick ? 'hover:bg-[#231f5e]' : ''}`
          : `bg-white border-gray-200 ${onClick ? 'hover:border-[#2a276e]/35' : ''}`
      } ${className}`}
    >
      {/* Soft highlight so the filled card has some depth without a shadow. */}
      {hero && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -bottom-24 w-48 h-48 rounded-full bg-white/[0.06]"
        />
      )}

      <div className="relative flex items-center gap-2 min-w-0">
        <span
          className={`w-7 h-7 rounded-lg grid place-items-center flex-shrink-0 text-base ${
            hero ? 'bg-white/15 text-white' : 'bg-[#9B8CFF]/12 text-[#2a276e]'
          }`}
        >
          {icon}
        </span>
        <span className={`text-[11px] font-semibold truncate ${hero ? 'text-white/80' : 'text-gray-500'}`}>
          {title}
        </span>
      </div>

      <div className="relative flex items-center gap-2 flex-wrap">
        <span
          className={`font-extrabold tracking-tight leading-none tabular-nums ${
            hero ? 'text-[1.75rem] md:text-[2rem]' : 'text-xl md:text-2xl'
          }`}
        >
          {display}
        </span>
        <DeltaPill change={change} changeType={changeType} invert={invert} hero={hero} label={changeLabel} />
        {badge && <Badge text={badge} tone={badgeTone} />}
      </div>

      {variant === 'spark' && sparkline?.length > 0 && (
        <KpiSparkline data={sparkline} highlight={sparklineHighlight} className="relative" />
      )}

      {variant === 'breakdown' && rows?.length > 0 && <Breakdown rows={rows} />}

      {(story || onClick) && (
        <p className={`relative text-[11px] leading-snug m-0 ${hero ? 'text-white/75' : 'text-gray-500'}`}>
          {/* Cards sit 2-up below `md`, so the long sentence gets swapped for a
              short one rather than wrapping to four lines. Switches at the same
              768px boundary as useBreakpoint, so the text and the chart
              geometry change together rather than at two different widths. */}
          {story && (
            <span className={onClick ? 'group-hover:hidden' : undefined}>
              <span className="md:hidden">{storyShort || story}</span>
              <span className="hidden md:inline">{story}</span>
            </span>
          )}
          {onClick && (
            <span
              className={`${story ? 'hidden group-hover:inline' : 'inline'} font-semibold ${
                hero ? 'text-white' : 'text-[#2a276e]'
              }`}
            >
              {actionLabel} <span aria-hidden="true">&rarr;</span>
            </span>
          )}
        </p>
      )}

      {(variant === 'meter' || (hero && meterPercent != null)) && (
        <div className="relative flex flex-col gap-1 mt-auto">
          <Meter percent={meterPercent} hero={hero} tone={meterTone} />
          {(meterLeft || meterRight) && (
            <div className={`flex justify-between text-[10px] tabular-nums ${hero ? 'text-white/70' : 'text-gray-400'}`}>
              <span className="truncate">{meterLeft}</span>
              <span className="truncate flex-shrink-0 pl-2">{meterRight}</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
};

export default MetricCard;
