import React, { useEffect, useState, useMemo } from 'react';
import { api, getFriendlyErrorMessage } from '../../../utils/api';
import { clinicDateKey, clinicToday, formatDate } from '../../../utils/datetime';
import Spinner from '../../common/Spinner';
import TimelineEvent from './TimelineEvent';

/**
 * What has happened to this bill, newest first, grouped by the day it happened.
 *
 * The backend merges payments with the audit log, which has been recording the
 * acting user on every action since it was written without anything ever reading
 * it back. So this is mostly a matter of not getting in the way of data that was
 * already there.
 *
 * Days are the grouping because that is how somebody looks a bill up — "what
 * happened on the third" — and because a flat list repeats the same date on
 * every row for a bill raised and settled in one sitting.
 *
 * `reloadKey` is how the parent says "a payment just landed, fetch again"
 * without this component needing to know what changed.
 */
const PaymentTimeline = ({ invoiceId, reloadKey = 0 }) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!invoiceId || invoiceId === 'new') { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    setError('');
    api.get(`/invoices/${invoiceId}/timeline`)
      .then((res) => { if (!cancelled) setEvents(Array.isArray(res) ? res : []); })
      .catch((e) => { if (!cancelled) setError(getFriendlyErrorMessage(e, 'Could not load the history for this invoice.')); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [invoiceId, reloadKey]);

  const days = useMemo(() => {
    const out = [];
    for (const e of events) {
      // Grouped on the clinic's calendar day, not the viewer's: an evening entry
      // otherwise slides into the next date once IST crosses 18:30.
      const key = clinicDateKey(e.at || e.on) || 'undated';
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e);
      else out.push({ key, items: [e] });
    }
    return out;
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-[13px] text-gray-500">
        <Spinner className="w-4 h-4" /> Loading history
      </div>
    );
  }

  // An empty list and a failed request look identical if you only print
  // "No activity yet", and the second one is a lie.
  if (error) return <p className="py-4 text-[13px] text-red-600">{error}</p>;

  if (!events.length) {
    return <p className="py-4 text-[13px] text-gray-400">Nothing recorded against this invoice yet.</p>;
  }

  const today = clinicToday();

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.key}>
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2.5">
            {day.key === 'undated'
              ? 'Date not recorded'
              : day.key === today ? 'Today' : formatDate(day.key)}
          </h3>
          <ol className="relative">
            {day.items.map((e, i) => (
              <TimelineEvent
                key={`${e.kind}-${e.at || e.on}-${i}`}
                event={e}
                last={i === day.items.length - 1}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};

export default PaymentTimeline;
