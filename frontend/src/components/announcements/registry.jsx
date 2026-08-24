import { Laptop, Smartphone, Star, Sparkles, Tag } from 'lucide-react';
import { DESKTOP_APP, MOBILE_WEB, DESKTOP_WEB } from './surface';

/**
 * Everything the app announces to itself, in one list.
 *
 * THIS IS THE FILE YOU EDIT. Shipping a release note, a store review ask or an
 * app download nudge is a new entry here, not a new component. The host picks
 * the single highest-priority entry this device is eligible for and shows it,
 * once, at the cadence the entry asks for. One at a time, deliberately: two
 * nags stacked on a login screen is how people learn to close things without
 * reading them.
 *
 * Fields
 *   id             stable and unique. It is the localStorage key, so changing
 *                  it re-shows the item to everybody. For release notes that is
 *                  the point: use a fresh id per release.
 *   priority       higher wins when several are eligible.
 *   surfaces       which builds it applies to (see surface.js).
 *   os             optional narrowing: 'windows' | 'mac' | 'android' | 'ios'.
 *   minDaysUsing   days this device has had MolarPlus before we ask.
 *   maxShows       total times it may ever appear on one device.
 *   repeatAfterDays  cooling-off between appearances.
 *   startsAt/endsAt  optional ISO dates, for anything time-boxed.
 *   art            which drawn scene heads the modal: 'notifications',
 *                  'rating', 'phone', 'desktop' or 'pricing'. See
 *                  AnnouncementArt.jsx. Every entry should name one.
 *   image          an import from assets/announcements/ for a real screenshot,
 *                  which beats a drawing for a specific feature. Optional, and
 *                  overrides `art` when present.
 *   actions        buttons. `resolve` says what the click means:
 *                    'acted'   did the thing, never ask again
 *                    'dismiss' not now, comes back after repeatAfterDays
 *                    'never'   said no, never ask again
 *
 * Two links that look alike and are not:
 *   https://apps.microsoft.com/detail/9N78RX7PHV9K  opens the Store listing in
 *     the system browser, which then hands off to the Store app. Reliable
 *     everywhere, so it is the primary action.
 *   ms-windows-store://review/?ProductId=9N78RX7PHV9K  opens the review dialog
 *     directly inside the Store app. Nicer when it works, but it depends on the
 *     webview passing an unknown scheme through to the Rust navigation hook, so
 *     it is not what a primary button hangs on.
 */

const MS_STORE_LISTING = 'https://apps.microsoft.com/detail/9N78RX7PHV9K';
const APP_STORE = 'https://apps.apple.com/app/molarplus';
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.molarplus.app&pcampaignid=web_share';
const R2 = 'https://pub-376f22e59eee415286747973b95ba075.r2.dev';

export const ANNOUNCEMENTS = [
  {
    // ── The plans changed ──────────────────────────────────────────────────
    // The single most important thing this list will ever say, because it is
    // the only one that changes what a clinic pays. Highest priority so it
    // outranks a release note, and no `maxShows` beyond one: being told once
    // that your billing changed is the minimum, being told twice is nagging.
    //
    // ►► SET `startsAt` TO THE DAY THE MIGRATION ACTUALLY RUNS. ◄◄
    // Until that date this is invisible, which is correct: announcing a plan
    // change before every clinic has been moved onto Plus would send people to
    // a Subscription page still showing the old world.
    id: 'plans-v2-launch',
    priority: 40,
    surfaces: [DESKTOP_APP, DESKTOP_WEB, MOBILE_WEB],
    startsAt: '2026-09-01',
    endsAt: '2026-10-31',
    minDaysUsing: 0,
    maxShows: 1,
    icon: Tag,
    art: 'pricing',
    image: null,
    eyebrow: 'Your plan',
    title: 'MolarPlus now has three plans',
    body: 'Nothing changes for you today, and nothing clinical has moved behind a higher plan. You are on Plus at no charge while we make the switch.',
    highlights: [
      'Plus covers one clinic, Pro adds branches, Growth removes the limits',
      'Charting, billing, prescriptions and reports stay on every plan',
      'Your Subscription page shows what you are using against your plan',
    ],
    actions: [
      { label: 'See my plan', to: '/admin/subscription', kind: 'primary', resolve: 'acted' },
      { label: 'Close', kind: 'ghost', resolve: 'dismiss' },
    ],
  },

  {
    // ── Release notes ──────────────────────────────────────────────────────
    // Bump the id every release. The old id keeps its "already seen" record,
    // so people who saw August do not see it again, and everybody sees the
    // new one once.
    id: 'whats-new-2026-08',
    priority: 30,
    surfaces: [DESKTOP_APP, DESKTOP_WEB, MOBILE_WEB],
    minDaysUsing: 0,
    maxShows: 1,
    icon: Sparkles,
    art: 'notifications',
    image: null, // a real screenshot of the bell would beat the drawing here
    eyebrow: "What's new",
    title: 'The bell finally tells you something',
    body: 'It used to show the last ten things that happened, with no way to mark any of them read. Now it carries what actually needs you, and it reaches your phone too.',
    highlights: [
      'A morning digest, and a nudge when bills go past two weeks unpaid',
      'A calendar rebuilt around the appointment card, so a day reads at a glance',
      'One inbox for WhatsApp and email, instead of two tabs',
      'A public page for your clinic, which you control and can switch off',
    ],
    actions: [
      { label: 'Have a look', to: '/dashboard', kind: 'primary', resolve: 'acted' },
      { label: 'Close', kind: 'ghost', resolve: 'dismiss' },
    ],
  },

  {
    // ── Microsoft Store review ─────────────────────────────────────────────
    // Only inside the Windows desktop build, and only after a week of use. A
    // review ask on day one is a review from somebody with nothing to say.
    id: 'ms-store-review',
    priority: 20,
    surfaces: [DESKTOP_APP],
    os: ['windows'],
    minDaysUsing: 7,
    maxShows: 2,
    repeatAfterDays: 90,
    icon: Star,
    art: 'rating',
    image: null,
    eyebrow: 'One small favour',
    title: 'Would you rate MolarPlus on the Microsoft Store?',
    body: 'Ratings are how other clinics find us, and a line from a dentist who actually runs the software counts for more than anything we can write ourselves. It takes about a minute.',
    actions: [
      { label: 'Rate on the Store', href: MS_STORE_LISTING, kind: 'primary', resolve: 'acted' },
      { label: 'Not now', kind: 'ghost', resolve: 'dismiss' },
      { label: 'Do not ask again', kind: 'quiet', resolve: 'never' },
    ],
    // Deliberately offered next to the ask: somebody having a bad week should
    // reach us before they reach a star rating.
    footnote: { text: 'Something not working? Tell us instead', to: '/support' },
  },

  {
    // ── The phone app, pitched from a big screen ───────────────────────────
    // Different from get-mobile-app below: that one catches somebody already
    // on a phone browser. This one tells a desktop user the phone app exists,
    // which is the only way most of them will ever find out.
    id: 'mobile-app-from-desktop',
    priority: 15,
    surfaces: [DESKTOP_APP, DESKTOP_WEB],
    minDaysUsing: 14,
    maxShows: 2,
    repeatAfterDays: 120,
    icon: Smartphone,
    art: 'phone',
    image: null,
    eyebrow: 'Also on your phone',
    title: 'Today’s schedule, in your pocket',
    body: 'Check the day, take intraoral photos straight into the patient file, and get notified when the front desk books somebody in. Same login, same clinic.',
    stores: true,
    actions: [
      { label: 'Maybe later', kind: 'ghost', resolve: 'dismiss' },
      { label: 'Do not ask again', kind: 'quiet', resolve: 'never' },
    ],
  },

  {
    // ── The two originals, absorbed from DeviceUpsellModal ─────────────────
    id: 'get-mobile-app',
    priority: 12,
    surfaces: [MOBILE_WEB],
    minDaysUsing: 0,
    maxShows: 4,
    repeatAfterDays: 7,
    icon: Smartphone,
    art: 'phone',
    image: null,
    eyebrow: 'Get the app',
    title: 'MolarPlus fits in your pocket',
    body: 'Capture intraoral photos, book appointments, and check today’s schedule wherever the patient is.',
    stores: true,
    actions: [
      { label: 'Maybe later', kind: 'ghost', resolve: 'dismiss' },
      { label: 'Do not ask again', kind: 'quiet', resolve: 'never' },
    ],
  },

  {
    id: 'get-desktop-app',
    priority: 10,
    surfaces: [DESKTOP_WEB],
    os: ['windows', 'mac'],
    minDaysUsing: 0,
    maxShows: 4,
    repeatAfterDays: 7,
    icon: Laptop,
    art: 'desktop',
    image: null,
    eyebrow: 'Get the app',
    title: 'MolarPlus runs faster as an app',
    body: 'Skip the browser tabs. Launch in one click, stay signed in, and keep your clinic always one keystroke away. X-ray capture needs it too.',
    actions: [
      {
        label: (ctx) => (ctx.os === 'mac' ? 'Download for Mac' : 'Download for Windows'),
        href: (ctx) => (ctx.os === 'mac' ? `${R2}/MolarPlus-mac.dmg` : `${R2}/MolarPlus-windows.msi`),
        kind: 'primary',
        resolve: 'acted',
      },
      { label: 'Maybe later', kind: 'ghost', resolve: 'dismiss' },
      { label: 'Do not ask again', kind: 'quiet', resolve: 'never' },
    ],
    footnote: (ctx) => ({
      text: `Free, ${ctx.os === 'mac' ? 'macOS 10.15 and up' : 'Windows 10 and 11'}, updates itself`,
    }),
  },
];

export const STORE_BADGES = [
  { href: APP_STORE, src: '/badges/app-store.svg', alt: 'Download on the App Store', className: 'h-11 w-auto' },
  { href: PLAY_STORE, src: '/badges/google-play.svg', alt: 'Get it on Google Play', className: 'h-14 w-auto' },
];
