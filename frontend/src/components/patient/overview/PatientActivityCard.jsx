import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check, CalendarDays, DoorOpen, FileText, Pill, ReceiptText, UserPlus,
} from 'lucide-react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import Spinner from '../../common/Spinner';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import { getCurrencySymbol } from '../../../utils/currency';
import { formatDate, formatTime } from '../../../utils/datetime';

/**
 * Everything that has happened to this patient, newest first.
 *
 * Replaces the two cards that stood here before, "Latest visit" and "Recent
 * visits", which showed the same case papers twice, could not say who anything
 * was by, and between them told you nothing about the appointment that brought
 * the patient in or the money that went out afterwards. One feed answers the
 * question they were both circling: what has actually happened to this person.
 *
 * The kind drives the icon; the badge carries the kind in words. That is not
 * the duplication the invoice timeline deliberately removed, where a pill
 * repeated the heading word for word. Here the heading is the date and the
 * badge is the event, so they say different things.
 *
 * This one fetches, unlike its neighbours, because the merge behind it spans
 * six tables and PatientProfile holds none of it in that shape. `reloadKey` is
 * how the parent says "something changed, look again" without this card having
 * to know what.
 */
const money = (n) =>
  `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

/**
 * A colour per category, not per kind.
 *
 * Eight events do not need eight colours. A colour has to earn itself by making
 * a distinction the words do not already make, and "case paper" versus
 * "prescription" is a distinction the badge makes perfectly well on its own. So
 * the eight kinds share five tones, grouped by what the event actually is:
 *
 *   slate    the file beginning, a fact rather than something somebody did
 *   teal     the patient turned up: booked, walked in, checked in
 *   indigo   the clinic wrote something clinical down
 *   ochre    money asked for
 *   green    money received
 *
 * Money in and money asked for are the pair that most needs telling apart at a
 * glance, and they are the two that differ most.
 *
 * Muted hex rather than Tailwind's palette. The -50/-600 pairs an earlier pass
 * used came out neon on a card that sits beside the dental chart all day: seven
 * fluorescent dots, each reading as an alert. These are mid-tone and
 * desaturated, close enough in weight to look like one family, with the house
 * indigo among them rather than beside them.
 *
 * Inline styles, not Tailwind classes: arbitrary values have to appear as
 * literal strings for the JIT to emit them, so a colour looked up from a map
 * would silently produce no CSS.
 */
const SLATE  = '#6b7280';
const TEAL   = '#29828a';   // the Control Center accent
const INDIGO = '#2a276e';   // the house colour
const OCHRE  = '#a86f3d';
const GREEN  = '#3f8f6f';

const KINDS = {
  registered:   { Icon: UserPlus,     tone: SLATE },
  appointment:  { Icon: CalendarDays, tone: TEAL },
  walk_in:      { Icon: DoorOpen,     tone: TEAL },
  check_in:     { Icon: DoorOpen,     tone: TEAL },
  case_paper:   { Icon: FileText,     tone: INDIGO },
  prescription: { Icon: Pill,         tone: INDIGO },
  invoice:      { Icon: ReceiptText,  tone: OCHRE },
  payment:      { Icon: Check,        tone: GREEN },
};
const FALLBACK = { Icon: FileText, tone: SLATE };

// The same hue at 8%, for the badge behind it.
const tint = (hex) => `${hex}14`;

// A date with no time (a walk-in, a registration) should not claim one.
const hasTime = (iso) => typeof iso === 'string' && iso.includes('T');

const Event = ({ event, last }) => {
  const { Icon, tone } = KINDS[event.kind] || FALLBACK;
  const isPayment = event.kind === 'payment';

  const detail = [
    event.method,
    event.reference && event.kind !== 'appointment' ? event.reference : null,
    event.detail,
  ].filter(Boolean).join(' · ');

  return (
    <li className="relative pl-8 pb-4 last:pb-0">
      {!last && <span className="absolute left-[11px] top-7 bottom-0 w-px bg-gray-200" aria-hidden="true" />}
      <span
        className="absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-white"
        style={{ backgroundColor: tone }}
        aria-hidden="true"
      >
        <Icon size={12} strokeWidth={2.5} />
      </span>

      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="text-xs font-semibold text-gray-900 truncate">
          {formatDate(event.at)}
          {hasTime(event.at) && (
            <span className="font-medium text-gray-500">, {formatTime(event.at)}</span>
          )}
        </p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0"
          style={{ backgroundColor: tint(tone), color: tone }}
        >
          {event.label}
        </span>
      </div>

      {event.amount != null && (
        <p
          className="text-xs font-bold tabular-nums mt-0.5"
          style={{ color: isPayment ? GREEN : '#374151' }}
        >
          {money(event.amount)}
        </p>
      )}

      {detail && (
        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={detail}>{detail}</p>
      )}

      {/* The verb comes from the server, not from the kind. "Recorded by" on a
          case paper and "By" on a payment are both wrong, and only the row
          knows which relationship it is describing: who booked the appointment,
          who examined the patient, who took the money. */}
      {event.by && (
        <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={`${event.by_verb || 'By'} ${event.by}`}>
          {event.by_verb || 'By'} {event.by}
        </p>
      )}
    </li>
  );
};

const PatientActivityCard = ({ patientId, reloadKey = 0, onOpen, className = '' }) => {
  const listRef = useRef(null);
  // Whether there is feed below the fold. Content hidden with no cue may as
  // well not exist, and this one hides a lot: a patient of a few years runs to
  // several times the height of the card. The card's own height is set by the
  // column beside it rather than by anything here, so it is watched rather
  // than worked out once.
  const [more, setMore] = useState(false);
  const checkMore = useCallback(() => {
    const el = listRef.current;
    setMore(!!el && el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  }, []);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!patientId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(`/patients/${patientId}/activity`)
      .then((res) => { if (!cancelled) setEvents(Array.isArray(res) ? res : []); })
      .catch((e) => {
        if (!cancelled) setError(getFriendlyErrorMessage(e, "Couldn't load this patient's history."));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId, reloadKey]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return undefined;
    checkMore();
    const ro = new ResizeObserver(checkMore);
    ro.observe(el);
    return () => ro.disconnect();
  }, [events, checkMore]);

  return (
    <OverviewCard title="Activity" onOpen={onOpen} action="Visits" className={`flex flex-col ${className}`}>
      {loading && (
        <div className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-gray-500">
          <Spinner className="w-4 h-4" /> Loading
        </div>
      )}

      {/* An empty feed and a failed one look identical if both print "nothing
          yet", and the second one is a lie. */}
      {!loading && error && (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <OverviewEmpty>Nothing recorded for this patient yet.</OverviewEmpty>
      )}

      {/* The cap is the column itself at xl, where the card shares a fixed
          height with the prescriptions below it. A fixed one under that, where
          there is no column to borrow a height from and an unbounded feed would
          just make the page longer.

          The fade is the cue that there is more. It is drawn over the scroll
          edge and goes when you reach the end, so it never suggests content
          that is not there. Not a shadow: cards here are border-only. */}
      {!loading && !error && events.length > 0 && (
        <div className="relative min-h-0 flex flex-col">
          <ol
            ref={listRef}
            onScroll={checkMore}
            className="relative px-4 py-3.5 min-h-0 overflow-y-auto max-h-[26rem] xl:max-h-none"
          >
            {events.map((e, i) => (
              <Event
                key={`${e.kind}-${e.at}-${i}`}
                event={e}
                last={i === events.length - 1}
              />
            ))}
          </ol>
          {more && (
            <div
              className="pointer-events-none absolute inset-x-px bottom-px h-9 rounded-b-xl bg-gradient-to-t from-white via-white/85 to-transparent"
              aria-hidden="true"
            />
          )}
        </div>
      )}
    </OverviewCard>
  );
};

export default PatientActivityCard;
