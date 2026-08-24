import React from 'react';

/**
 * Flat illustrations for the announcement modals.
 *
 * These exist so an announcement never depends on somebody producing artwork
 * before it can ship. Every entry used to draw the same brand gradient with a
 * different generic icon dropped on it, which made five different messages look
 * like one repeated advert.
 *
 * Drawn rather than photographed on purpose:
 *   - they scale, stay sharp on every screen, and cost about 2KB instead of 300
 *   - they cannot go stale the way a screenshot of last year's UI does
 *   - nothing has to be commissioned before a release note can go out
 *
 * A real screenshot is still better for a specific feature, and any entry can
 * override this by setting `image` in registry.jsx. This is the floor, not the
 * ceiling.
 *
 * Palette is the brand's: #2a276e indigo, #9B8CFF violet, #29828a teal,
 * #F59E0B amber. All four sit on the same deep indigo ground so the set reads
 * as one family.
 */

const GROUND = (
  <>
    <rect width="320" height="180" fill="url(#mp-ground)" />
    <circle cx="290" cy="24" r="46" fill="#ffffff" opacity="0.05" />
    <circle cx="28" cy="168" r="58" fill="#ffffff" opacity="0.05" />
  </>
);

const Defs = () => (
  <defs>
    <linearGradient id="mp-ground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#2a276e" />
      <stop offset="100%" stopColor="#1a1548" />
    </linearGradient>
  </defs>
);

/** A bell over a stack of notification rows. */
const Notifications = () => (
  <>
    {GROUND}
    {[0, 1, 2].map((i) => (
      <g key={i} opacity={1 - i * 0.28}>
        <rect x={168} y={54 + i * 30} width={118} height={22} rx="6" fill="#ffffff" opacity="0.14" />
        <circle cx={181} cy={65 + i * 30} r="5" fill={['#29828a', '#9B8CFF', '#F59E0B'][i]} />
        <rect x={193} y={61 + i * 30} width={58} height={4} rx="2" fill="#ffffff" opacity="0.5" />
        <rect x={193} y={69 + i * 30} width={36} height={3} rx="1.5" fill="#ffffff" opacity="0.3" />
      </g>
    ))}
    <g transform="translate(62 90)">
      <circle r="42" fill="#ffffff" opacity="0.1" />
      <path
        d="M0 -22c-9 0-16 7-16 16v11l-5 7v3h42v-3l-5-7v-11c0-9-7-16-16-16z"
        fill="#ffffff"
      />
      <path d="M-6 18a6 6 0 0012 0z" fill="#ffffff" />
      <circle cx="15" cy="-18" r="8" fill="#F59E0B" />
    </g>
  </>
);

/** Five stars with the last one mid-fill. */
const Rating = () => {
  const star = "M0 -11L3.4 -3.6 11 -2.6 5.5 3 6.8 11 0 7.2 -6.8 11 -5.5 3 -11 -2.6 -3.4 -3.6Z";
  return (
    <>
      {GROUND}
      <rect x="46" y="58" width="228" height="64" rx="14" fill="#ffffff" opacity="0.1" />
      {[0, 1, 2, 3, 4].map((i) => (
        <g key={i} transform={`translate(${76 + i * 42} 90)`}>
          <path d={star} fill={i < 4 ? '#F59E0B' : '#ffffff'} opacity={i < 4 ? 1 : 0.25} />
        </g>
      ))}
      <rect x="112" y="136" width="96" height="6" rx="3" fill="#ffffff" opacity="0.25" />
    </>
  );
};

/** A phone showing a day's schedule. */
const Phone = () => (
  <>
    {GROUND}
    <g transform="translate(160 90)">
      <rect x="-42" y="-64" width="84" height="128" rx="12" fill="#ffffff" />
      <rect x="-42" y="-64" width="84" height="22" rx="12" fill="#2a276e" />
      <rect x="-10" y="-58" width="20" height="3" rx="1.5" fill="#ffffff" opacity="0.6" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={-34} y={-34 + i * 22} width="10" height="10" rx="3"
            fill={['#29828a', '#9B8CFF', '#F59E0B', '#29828a'][i]} />
          <rect x={-19} y={-32 + i * 22} width="48" height="4" rx="2" fill="#2a276e" opacity="0.5" />
          <rect x={-19} y={-25 + i * 22} width="30" height="3" rx="1.5" fill="#2a276e" opacity="0.22" />
        </g>
      ))}
    </g>
    <circle cx="74" cy="52" r="7" fill="#9B8CFF" opacity="0.7" />
    <circle cx="252" cy="132" r="10" fill="#29828a" opacity="0.6" />
  </>
);

/** A laptop with an app window open on it. */
const Desktop = () => (
  <>
    {GROUND}
    <g transform="translate(160 84)">
      <rect x="-84" y="-52" width="168" height="104" rx="9" fill="#ffffff" />
      <rect x="-84" y="-52" width="168" height="16" rx="9" fill="#2a276e" />
      <rect x="-84" y="-44" width="168" height="8" fill="#2a276e" />
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={-74 + i * 10} cy="-44" r="2.6" fill="#ffffff" opacity="0.55" />
      ))}
      <rect x="-76" y="-28" width="42" height="72" rx="6" fill="#2a276e" opacity="0.08" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={-70} y={-20 + i * 15} width="30" height="4" rx="2" fill="#2a276e" opacity="0.3" />
      ))}
      <rect x="-26" y="-28" width="102" height="30" rx="6" fill="#29828a" opacity="0.16" />
      <rect x="-26" y="8" width="48" height="36" rx="6" fill="#9B8CFF" opacity="0.28" />
      <rect x="28" y="8" width="48" height="36" rx="6" fill="#F59E0B" opacity="0.24" />
    </g>
    <rect x="52" y="140" width="216" height="8" rx="4" fill="#ffffff" opacity="0.28" />
  </>
);

/** A price tag, for anything about plans or billing. */
const Pricing = () => (
  <>
    {GROUND}
    {[0, 1, 2].map((i) => (
      <g key={i} transform={`translate(${76 + i * 84} ${96 - (i === 1 ? 14 : 0)})`}>
        <rect x="-32" y="-40" width="64" height="80" rx="10"
          fill="#ffffff" opacity={i === 1 ? 0.95 : 0.16} />
        <rect x="-20" y="-28" width="40" height="5" rx="2.5"
          fill={i === 1 ? '#2a276e' : '#ffffff'} opacity={i === 1 ? 0.75 : 0.45} />
        <rect x="-20" y="-14" width="26" height="12" rx="3"
          fill={i === 1 ? '#29828a' : '#ffffff'} opacity={i === 1 ? 1 : 0.35} />
        {[0, 1, 2].map((r) => (
          <rect key={r} x="-20" y={8 + r * 9} width={r === 2 ? 22 : 34} height="3.5" rx="1.75"
            fill={i === 1 ? '#2a276e' : '#ffffff'} opacity={i === 1 ? 0.28 : 0.28} />
        ))}
      </g>
    ))}
    <circle cx="160" cy="42" r="12" fill="#F59E0B" />
  </>
);

const SCENES = {
  notifications: Notifications,
  rating: Rating,
  phone: Phone,
  desktop: Desktop,
  pricing: Pricing,
};

const AnnouncementArt = ({ name }) => {
  const Scene = SCENES[name];
  if (!Scene) return null;
  return (
    <svg
      viewBox="0 0 320 180"
      className="block w-full"
      role="presentation"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <Defs />
      <Scene />
    </svg>
  );
};

export default AnnouncementArt;
