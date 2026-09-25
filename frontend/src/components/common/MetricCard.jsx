import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';
import KpiSparkline from './KpiSparkline';
import { describeDelta } from '../../utils/delta';

/**
 * A KPI card that says what its number means.
 *
 * Shared by the dashboard and the Payments screen — one component, so the two
 * can't drift apart. `icon` is a rendered node rather than a key into a lookup
 * table, which is what lets the two screens use different icon sets without
 * this file knowing about either.
 *
 * Four variants share one shell:
 *   hero      — filled navy, the one number worth reading first; carries
 *               either bars (sparkline) or a meter, whichever it is given
 *   spark     — the card's own metric over the card's own period
 *   meter     — a part-of-whole bar (collected-of-billed, aged-of-outstanding)
 *   breakdown — labelled rows, for a value that is really a sum of parts
 *
 * What the lower part may show (every card is held to this):
 *   - a meter only where there is a real 100% and both sides count the same
 *     thing over the same window
 *   - bars only for this card's metric over this card's period, or a
 *     distribution whose buckets are labelled
 *   - rows only when they add something the headline does not already say
 *   - captions describe the thing they sit under, never repeat the badge
 *   - no trend pill without a real previous window (pass change: null)
 * When nothing qualifies, show nothing: the story sentence is enough.
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

const DeltaPill = ({ change, changeType, previous, value, isMoney, invert, hero, label }) => {
  // No comparison available is different from a comparison that came out flat.
  // Payments' summary has no period-over-period figure, so rendering "— 0%" on
  // every card there would be four pills asserting something nobody measured.
  //
  // describeDelta also decides whether a percentage is honest at this size. A
  // clinic going from one patient to nine used to render "▲ 800%", which is
  // true, useless, and the loudest possible signal that a screen is showing
  // seeded data. Cards that pass `previous` get "+8" instead; cards that don't
  // (Payments, Expenses) behave exactly as they did.
  const d = describeDelta({ change, changeType, previous, value, isMoney });
  if (!d) return null;

  const flat = d.tone === 'flat';
  // ▲ and ▼ were text glyphs sitting beside lucide icons everywhere else on
  // the page: a different baseline, a different weight, and whatever the
  // system font felt like on the day.
  const Icon = d.up ? ArrowUp : ArrowDown;
  const arrow = flat ? null : <Icon size={11} strokeWidth={2.75} aria-hidden="true" />;
  const body = <>{arrow}{flat ? 'no change' : d.text}</>;

  if (hero) {
    return (
      <span title={label} className="inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/20 text-white whitespace-nowrap">
        {body}
      </span>
    );
  }

  const tone = deltaTone(changeType, invert);
  const cls = flat
    ? 'bg-gray-100 text-gray-500'
    : tone === 'good'
      ? 'bg-green-50 text-green-700'
      : 'bg-red-50 text-red-600';

  return (
    <span title={label} className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
      {body}
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

// `hint` is an optional quiet second figure on the right ("3 cases", "42%").
// `compact` lays the rows out two to a line, for a card whose rows are short
// counts (Done 11 · Upcoming 4); four stacked rows made it the tallest card and
// stretched the whole row with it.
const CompactBreakdown = ({ rows }) => (
  // Two per line only where the card is wide enough for the labels; on a
  // narrow card they stack rather than truncate to "Upc…".
  <div className="relative grid grid-cols-1 xl:grid-cols-2 gap-x-3 gap-y-1 mt-auto pt-1.5 border-t border-gray-100">
    {rows.map(({ label, value, color }) => (
      <div key={label} className="flex items-center gap-1.5 text-[11px] min-w-0">
        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
        <span className="text-gray-500 truncate">{label}</span>
        <span className="ml-auto font-bold text-gray-800 tabular-nums">{value}</span>
      </div>
    ))}
  </div>
);

const Breakdown = ({ rows }) => (
  <div className="relative flex flex-col gap-1 mt-auto">
    {rows.map(({ label, value, color, hint }) => (
      <div key={label} className="flex items-center gap-2 pt-1 border-t border-gray-100 text-[11px]">
        <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
        <span className="text-gray-500 flex-1 truncate">{label}</span>
        {hint && <span className="text-gray-400 tabular-nums">{hint}</span>}
        <span className="font-bold text-gray-800 tabular-nums">{value}</span>
      </div>
    ))}
  </div>
);

// Fades the photo out toward the left (into the headline) and toward the
// bottom (under the rows and bars), so the text always sits on white.
const PHOTO_FADE = {
  WebkitMaskImage:
    'linear-gradient(to left, rgba(0,0,0,.95) 0%, rgba(0,0,0,.55) 40%, transparent 100%),' +
    'linear-gradient(to bottom, #000 0%, #000 45%, transparent 92%)',
  maskImage:
    'linear-gradient(to left, rgba(0,0,0,.95) 0%, rgba(0,0,0,.55) 40%, transparent 100%),' +
    'linear-gradient(to bottom, #000 0%, #000 45%, transparent 92%)',
  WebkitMaskComposite: 'source-in',
  maskComposite: 'intersect',
};

const MetricCard = ({
  title,
  display,          // pre-formatted headline string
  change,
  changeType,
  // The value the percentage was measured against, and the current value.
  // Optional: with both, the pill can drop a percentage that is too small a
  // base to mean anything. See describeDelta.
  previous,
  value,
  // Whether `value` is money, so a small-base delta comes out as "+₹1.2k"
  // rather than a bare "+1200". KpiDetailDrawer already reads this off the
  // same card object, so the name is shared rather than invented here.
  isMoney,
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
  sparklineLabels,
  rows,
  rowsLayout,       // 'compact' puts two rows on each line
  onClick,
  // What the drawer behind this card is called. Shown on hover, so it should
  // finish the sentence "…" rather than repeat the card's own title.
  actionLabel = 'See the breakdown',
  // A photo on the right that fades out toward the text. Decorative only.
  image,
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
      {image && !hero && (
        <img
          src={image}
          alt=""
          aria-hidden="true"
          loading="lazy"
          // Narrower and lighter where the card is narrow, so a wrapped
          // sentence never runs across the photo; off on phones.
          className="pointer-events-none select-none absolute top-0 right-0 h-full hidden md:block w-[34%] opacity-70 xl:w-[48%] xl:opacity-100 object-cover"
          style={PHOTO_FADE}
        />
      )}

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
        <DeltaPill change={change} changeType={changeType} previous={previous} value={value} isMoney={isMoney} invert={invert} hero={hero} label={changeLabel} />
        {badge && <Badge text={badge} tone={badgeTone} />}
      </div>

      {/* mt-auto, so the bars sit on the floor of the card rather than
          floating in the middle of it. The KPI row stretches every card to the
          tallest one (the hero, which carries a meter), and without this the
          sparkline stopped halfway down and left the bottom third of the
          Patients card empty. The meter below already does the same thing. */}
      {/* Fewer than three points is not a shape; one bar just fills the card. */}
      {(variant === 'spark' || (hero && meterPercent == null)) && sparkline?.length >= 3 && (
        <KpiSparkline
          data={sparkline}
          highlight={sparklineHighlight}
          labels={sparklineLabels}
          hero={hero}
          className="relative mt-auto"
        />
      )}

      {variant === 'breakdown' && rows?.length > 0 && (
        rowsLayout === 'compact' ? <CompactBreakdown rows={rows} /> : <Breakdown rows={rows} />
      )}

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
