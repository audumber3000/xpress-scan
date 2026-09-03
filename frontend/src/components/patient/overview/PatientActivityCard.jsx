import React, { useEffect, useState } from 'react';
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

const KINDS = {
  registered:   { Icon: UserPlus,     ring: 'bg-violet-50 text-violet-600 border-violet-200',    badge: 'bg-violet-50 text-violet-700' },
  appointment:  { Icon: CalendarDays, ring: 'bg-blue-50 text-blue-600 border-blue-200',          badge: 'bg-blue-50 text-blue-700' },
  walk_in:      { Icon: DoorOpen,     ring: 'bg-sky-50 text-sky-600 border-sky-200',             badge: 'bg-sky-50 text-sky-700' },
  check_in:     { Icon: DoorOpen,     ring: 'bg-sky-50 text-sky-600 border-sky-200',             badge: 'bg-sky-50 text-sky-700' },
  case_paper:   { Icon: FileText,     ring: 'bg-indigo-50 text-indigo-600 border-indigo-200',    badge: 'bg-indigo-50 text-indigo-700' },
  prescription: { Icon: Pill,         ring: 'bg-teal-50 text-teal-600 border-teal-200',          badge: 'bg-teal-50 text-teal-700' },
  invoice:      { Icon: ReceiptText,  ring: 'bg-indigo-50 text-indigo-600 border-indigo-200',    badge: 'bg-indigo-50 text-indigo-700' },
  payment:      { Icon: Check,        ring: 'bg-emerald-50 text-emerald-600 border-emerald-200', badge: 'bg-emerald-50 text-emerald-700' },
};
const FALLBACK = { Icon: FileText, ring: 'bg-gray-50 text-gray-400 border-gray-200', badge: 'bg-gray-100 text-gray-600' };

// A date with no time (a walk-in, a registration) should not claim one.
const hasTime = (iso) => typeof iso === 'string' && iso.includes('T');

const Event = ({ event, last }) => {
  const { Icon, ring, badge } = KINDS[event.kind] || FALLBACK;
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
        className={`absolute left-0 top-0 w-6 h-6 rounded-full border flex items-center justify-center ${ring}`}
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
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap flex-shrink-0 ${badge}`}>
          {event.label}
        </span>
      </div>

      {event.amount != null && (
        <p className={`text-xs font-bold tabular-nums mt-0.5 ${isPayment ? 'text-emerald-600' : 'text-gray-700'}`}>
          {money(event.amount)}
        </p>
      )}

      {detail && (
        <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-2" title={detail}>{detail}</p>
      )}

      {event.by && (
        <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={event.by}>
          {isPayment || event.kind === 'invoice' ? 'Recorded by' : 'By'} {event.by}
        </p>
      )}
    </li>
  );
};

const PatientActivityCard = ({ patientId, reloadKey = 0, onOpen }) => {
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

  return (
    <OverviewCard title="Activity" onOpen={onOpen} action="Visits">
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

      {!loading && !error && events.length > 0 && (
        <ol className="relative px-4 py-3.5 max-h-[26rem] overflow-y-auto">
          {events.map((e, i) => (
            <Event
              key={`${e.kind}-${e.at}-${i}`}
              event={e}
              last={i === events.length - 1}
            />
          ))}
        </ol>
      )}
    </OverviewCard>
  );
};

export default PatientActivityCard;
