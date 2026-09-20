import React, { useId } from 'react';

/**
 * Flat illustrations for the header's ambient strip.
 *
 * ─── Why these are not icons, and not emoji ─────────────────────────────
 *
 * Everything else on this dashboard is a lucide stroke icon, because
 * everything else is a control or a label. These are neither: they are the
 * one decorative thing on the page, and the strip only works if they carry
 * enough colour to be read at 28px without being read as a button.
 *
 * Emoji were the obvious shortcut and are the wrong answer twice over: they
 * render as a different typeface on every OS, so the strip would look
 * hand-made on a Mac and clip-arty on Windows, and the 3D ones sit in a
 * completely different visual language from the flat festival art beside
 * them.
 *
 * ─── One palette, one language ──────────────────────────────────────────
 *
 * Weather and festivals share the same six colours and the same construction
 * (solid shapes, no outlines, no gradients, no shadows), so a rainy Tuesday
 * and Diwali look like they came out of the same set. Deliberately separate
 * from the chart palette in chartTheme: those colours carry data and have to
 * pass contrast and CVD gates. These carry nothing — the word beside them is
 * the information — so they are free to be bright, and must never be used on
 * a mark that means something.
 */
const ART = {
  red:    '#EF4136',
  pink:   '#EC5E92',
  blue:   '#2B4BD6',
  gold:   '#E9B23C',
  deep:   '#15443F',
  green:  '#1E7F4C',
  // Weather greys. Cool rather than neutral, so a cloud reads as sky and not
  // as a disabled control.
  cloud:  '#B9C4DC',
  cloud2: '#D6DEEE',
};

const Svg = ({ children, title }) => (
  <svg viewBox="0 0 32 32" width="100%" height="100%" role="img" aria-label={title}>
    {children}
  </svg>
);

// A cloud built from three circles and a bar. `y` shifts it up when something
// has to hang underneath (rain, a bolt, fog bars).
const Cloud = ({ fill = ART.cloud, y = 0 }) => (
  <g transform={`translate(0 ${y})`}>
    <circle cx="11" cy="17" r="6" fill={fill} />
    <circle cx="21" cy="15.5" r="7.5" fill={fill} />
    <rect x="5" y="16" width="22" height="9" rx="4.5" fill={fill} />
  </g>
);

const SunRays = ({ cx = 16, cy = 16, inner = 10.5, outer = 14 }) => {
  // Coerced, because these are arithmetic and JSX hands you whatever the call
  // site wrote. <SunRays cx="11" /> made x1 into "11" + 7 === "117" and threw
  // every ray off the canvas — the sun rendered as a bare disc and only the
  // default-props caller looked right.
  const x = Number(cx);
  const y = Number(cy);
  return (
    <g stroke={ART.gold} strokeWidth="2.4" strokeLinecap="round">
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={x + inner * Math.cos(r)} y1={y + inner * Math.sin(r)}
            x2={x + outer * Math.cos(r)} y2={y + outer * Math.sin(r)}
          />
        );
      })}
    </g>
  );
};

/* ── Weather ─────────────────────────────────────────────────────────── */

const Clear = () => (
  <Svg title="Clear">
    <SunRays />
    <circle cx="16" cy="16" r="7" fill={ART.gold} />
  </Svg>
);

const Partly = () => (
  <Svg title="Partly cloudy">
    {/* The shared Cloud is too big and too far left to leave the sun
        anywhere to be: it swallowed it whole and all that showed at 28px
        was one gold ray poking out of the top. This one is smaller and
        pushed right, so the sun clears it and the two overlap the way a
        partly-cloudy mark is supposed to. */}
    <SunRays cx={12} cy={11} inner={7} outer={9.8} />
    <circle cx="12" cy="11" r="5" fill={ART.gold} />
    <g fill={ART.cloud}>
      <circle cx="14" cy="20" r="5" />
      <circle cx="22" cy="18.5" r="6.5" />
      <rect x="9" y="19" width="18" height="8" rx="4" />
    </g>
  </Svg>
);

const Cloudy = () => (
  <Svg title="Cloudy">
    <circle cx="20" cy="12" r="6" fill={ART.cloud2} />
    <Cloud y={1} />
  </Svg>
);

const Rain = () => (
  <Svg title="Rain">
    <Cloud y={-3} />
    <g stroke={ART.blue} strokeWidth="2.6" strokeLinecap="round">
      <line x1="11" y1="24" x2="9.5" y2="29" />
      <line x1="16.5" y1="24" x2="15" y2="29" />
      <line x1="22" y1="24" x2="20.5" y2="29" />
    </g>
  </Svg>
);

const Storm = () => (
  <Svg title="Thunderstorm">
    <Cloud y={-4} />
    <path d="M18 21 L12.5 27 L15.5 27 L13.5 31 L20 24.5 L16.5 24.5 Z" fill={ART.gold} />
  </Svg>
);

const Fog = () => (
  <Svg title="Fog">
    <Cloud y={-4} />
    <g fill={ART.cloud2}>
      <rect x="6" y="24" width="20" height="2.6" rx="1.3" />
      <rect x="9" y="28.5" width="14" height="2.6" rx="1.3" />
    </g>
  </Svg>
);

const Snow = () => (
  <Svg title="Snow">
    <Cloud y={-3} />
    <g fill={ART.blue}>
      <circle cx="11" cy="27" r="2" />
      <circle cx="16.5" cy="29.5" r="2" />
      <circle cx="22" cy="27" r="2" />
    </g>
  </Svg>
);

/* ── Festivals ───────────────────────────────────────────────────────── */

const Diya = () => (
  <Svg title="Diya">
    <path d="M16 4 C19.5 8.5 19.5 12 16 14.5 C12.5 12 12.5 8.5 16 4 Z" fill={ART.gold} />
    <path d="M16 8 C17.8 10.4 17.8 12 16 13.4 C14.2 12 14.2 10.4 16 8 Z" fill={ART.red} />
    <path d="M3 18 Q16 30 29 18 Z" fill={ART.pink} />
    <path d="M6.5 20.5 Q16 26.5 25.5 20.5" stroke={ART.blue} strokeWidth="2.4" fill="none" strokeLinecap="round" />
  </Svg>
);

const Lantern = () => (
  <Svg title="Lantern">
    {/* Cap, body, cap, tassels. The first version was a very round body with
        a triangle on top and three dangling legs, which at 28px was a
        jellyfish. What makes a lantern legible is the two flat end caps
        squaring it off, so those do the work and the body's corners came
        right down. */}
    <line x1="16" y1="1" x2="16" y2="4" stroke={ART.blue} strokeWidth="1.6" strokeLinecap="round" />
    <rect x="10.5" y="4" width="11" height="2.8" rx="1.4" fill={ART.blue} />
    <rect x="5" y="7.5" width="22" height="13" rx="3.5" fill={ART.pink} />
    <path d="M7 14 Q11.5 11.5 16 14 T25 14" stroke={ART.gold} strokeWidth="2" fill="none" strokeLinecap="round" />
    <g fill={ART.red}>
      <circle cx="10" cy="12.4" r="1.1" /><circle cx="16" cy="13.2" r="1.1" /><circle cx="22" cy="12.4" r="1.1" />
    </g>
    <rect x="10.5" y="21.2" width="11" height="2.8" rx="1.4" fill={ART.blue} />
    <g fill={ART.gold}>
      <rect x="11.5" y="24.5" width="1.8" height="5" rx="0.9" />
      <rect x="15.1" y="24.5" width="1.8" height="6.5" rx="0.9" />
      <rect x="18.7" y="24.5" width="1.8" height="5" rx="0.9" />
    </g>
  </Svg>
);

const Colors = () => (
  <Svg title="Holi colours">
    <circle cx="11" cy="12.5" r="7.5" fill={ART.pink} />
    <circle cx="21.5" cy="11.5" r="6" fill={ART.gold} />
    <circle cx="16" cy="22" r="7" fill={ART.blue} />
    <g fill={ART.red}>
      <circle cx="27" cy="21" r="2" /><circle cx="4.5" cy="22.5" r="1.6" /><circle cx="24" cy="27.5" r="1.4" />
    </g>
  </Svg>
);

const Flag = () => (
  <Svg title="Indian flag">
    <rect x="5.5" y="3" width="2.6" height="26" rx="1.3" fill={ART.deep} />
    <rect x="8.1" y="5" width="18" height="5.3" fill="#FF9933" />
    {/* The white band needs an edge or it disappears into the card. */}
    <rect x="8.1" y="10.3" width="18" height="5.3" fill="#FFFFFF" stroke={ART.cloud2} strokeWidth="0.6" />
    <rect x="8.1" y="15.6" width="18" height="5.3" fill={ART.green} />
    <circle cx="17.1" cy="12.95" r="1.7" fill="none" stroke={ART.blue} strokeWidth="1.1" />
  </Svg>
);

const Moon = () => {
  // A crescent as one path needs two arcs whose chord is almost exactly their
  // own diameter, which is the degenerate case: the first attempt here drew
  // nothing at all and the icon shipped as a lone red star. Two circles and a
  // mask is unambiguous — one disc, minus a disc offset from it.
  //
  // useId because SVG ids are document-global: two moons on one page with a
  // hardcoded id would both use whichever mask parsed last.
  const id = useId();
  return (
    <Svg title="Crescent moon">
      <mask id={id}>
        <rect width="32" height="32" fill="#000" />
        <circle cx="14.5" cy="17" r="12.5" fill="#fff" />
        <circle cx="21.5" cy="13" r="11.5" fill="#000" />
      </mask>
      <rect width="32" height="32" fill={ART.gold} mask={`url(#${id})`} />
      <path d="M25.5 3 L26.6 6 L29.6 7.1 L26.6 8.2 L25.5 11.2 L24.4 8.2 L21.4 7.1 L24.4 6 Z" fill={ART.red} />
    </Svg>
  );
};

const Tree = () => (
  <Svg title="Christmas tree">
    <path d="M16 1.5 L17.2 4.6 L20.3 5.8 L17.2 7 L16 10.1 L14.8 7 L11.7 5.8 L14.8 4.6 Z" fill={ART.gold} />
    <polygon points="16,9 23,17 9,17" fill={ART.green} />
    <polygon points="16,14 25.5,23 6.5,23" fill={ART.green} />
    <rect x="14" y="23" width="4" height="6" rx="1" fill={ART.deep} />
    <g fill={ART.red}>
      <circle cx="13" cy="15.5" r="1.3" /><circle cx="19.5" cy="20.5" r="1.3" /><circle cx="11.5" cy="21" r="1.3" />
    </g>
  </Svg>
);

const Kite = () => (
  <Svg title="Kite">
    <polygon points="16,2 27,13 16,24 5,13" fill={ART.pink} />
    <polygon points="16,2 16,24 5,13" fill={ART.blue} />
    <polygon points="16,2 27,13 16,13" fill={ART.gold} />
    <path d="M16 24 Q12.5 27 16 29 Q19.5 30.5 16 32" stroke={ART.deep} strokeWidth="1.4" fill="none" strokeLinecap="round" />
  </Svg>
);

const Rakhi = () => (
  <Svg title="Rakhi">
    <path d="M1.5 25 Q7 20 11 17" stroke={ART.pink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    <path d="M30.5 25 Q25 20 21 17" stroke={ART.pink} strokeWidth="2.6" fill="none" strokeLinecap="round" />
    <g fill={ART.gold}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return <circle key={deg} cx={16 + 7.2 * Math.cos(r)} cy={14 + 7.2 * Math.sin(r)} r="3" />;
      })}
    </g>
    <circle cx="16" cy="14" r="6.5" fill={ART.pink} />
    <circle cx="16" cy="14" r="2.8" fill={ART.red} />
  </Svg>
);

const Modak = () => (
  <Svg title="Sweets">
    <circle cx="16" cy="17" r="13" fill={ART.deep} />
    <g fill={ART.gold}>
      <circle cx="11" cy="13" r="3.4" /><circle cx="21" cy="13" r="3.4" />
      <circle cx="16" cy="17.5" r="3.4" />
      <circle cx="11" cy="22" r="3.4" /><circle cx="21" cy="22" r="3.4" />
    </g>
    <g fill={ART.pink}>
      <circle cx="11" cy="12" r="1.1" /><circle cx="21" cy="12" r="1.1" />
      <circle cx="16" cy="16.5" r="1.1" />
      <circle cx="11" cy="21" r="1.1" /><circle cx="21" cy="21" r="1.1" />
    </g>
  </Svg>
);

const Sparkle = () => (
  <Svg title="Celebration">
    <g strokeWidth="2.6" strokeLinecap="round">
      {[
        [0, ART.red], [45, ART.gold], [90, ART.blue], [135, ART.pink],
        [180, ART.gold], [225, ART.blue], [270, ART.red], [315, ART.gold],
      ].map(([deg, color]) => {
        const r = (deg * Math.PI) / 180;
        return (
          <line
            key={deg} stroke={color}
            x1={16 + 5.5 * Math.cos(r)} y1={16 + 5.5 * Math.sin(r)}
            x2={16 + 13 * Math.cos(r)} y2={16 + 13 * Math.sin(r)}
          />
        );
      })}
    </g>
    <circle cx="16" cy="16" r="3.2" fill={ART.pink} />
  </Svg>
);

export const WEATHER_ART = {
  clear: Clear, partly: Partly, cloud: Cloudy,
  rain: Rain, storm: Storm, fog: Fog, snow: Snow,
};

export const FESTIVAL_ART = {
  diya: Diya, lantern: Lantern, colors: Colors, flag: Flag,
  moon: Moon, tree: Tree, kite: Kite, rakhi: Rakhi,
  modak: Modak, sparkle: Sparkle,
};

// An unknown key must still render something. The backend and this file are
// two lists that can drift, and a missing illustration should cost a generic
// burst rather than a hole in the header.
export const weatherArt = (key) => WEATHER_ART[key] || Cloudy;
export const festivalArt = (key) => FESTIVAL_ART[key] || Sparkle;
