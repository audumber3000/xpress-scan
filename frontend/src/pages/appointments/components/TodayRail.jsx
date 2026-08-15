import React, { useMemo } from "react";
import { RefreshCw, ChevronRight, AlertCircle } from "lucide-react";

/**
 * The day as a worklist, beside the grid.
 *
 * The grid answers "when", which is not the question the front desk has open
 * all day. Theirs is "who is still to come, who is waiting, and who did nobody
 * close off" — a list sorted by time, with state on it. That is why this earns
 * its width rather than repeating the grid in a narrower column.
 *
 * Deliberately not a copy of the competitor's rail: their In/Engaged split
 * needs a waiting-versus-in-chair distinction our status enum does not have,
 * and inventing one here would show a number nobody could act on.
 */

// Same vocabulary and the same colours as AppointmentCard, so a chip and its
// row in this list can never disagree about what a status looks like.
const PIPELINE = [
  { key: 'scheduled', short: 'Booked', dot: 'bg-gray-400', text: 'text-gray-600', border: 'border-l-gray-300' },
  { key: 'confirmed', short: 'Confirmed', dot: 'bg-[#2a276e]', text: 'text-[#2a276e]', border: 'border-l-[#2a276e]' },
  { key: 'arrived', short: 'In', dot: 'bg-green-500', text: 'text-green-700', border: 'border-l-green-500' },
  { key: 'completed', short: 'Seen', dot: 'bg-emerald-600', text: 'text-emerald-700', border: 'border-l-emerald-600' },
  { key: 'no_show', short: 'No show', dot: 'bg-amber-500', text: 'text-amber-700', border: 'border-l-amber-500' },
  { key: 'cancelled', short: 'Cancelled', dot: 'bg-gray-400', text: 'text-gray-500', border: 'border-l-gray-300' },
];
const STYLE = Object.fromEntries(PIPELINE.map((p) => [p.key, p]));

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const period = h >= 12 ? 'pm' : 'am';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m || 0).padStart(2, '0')} ${period}`;
};

/** "12 Aug" for a date that is not today. */
const shortDay = (value) => {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const durationOf = (a) => {
  if (Number(a?.duration) > 0) return Number(a.duration);
  const span = toMinutes(a?.endTime) - toMinutes(a?.startTime);
  return span > 0 ? span : 30;
};

const TodayRail = ({
  appointments,
  dayKey,
  isToday,
  onSelect,
  onRefresh,
  onCollapse,
  loading,
  // Past appointments nobody closed off. They used to sit in a banner above
  // the grid, which pushed the whole day down the page every morning. Same
  // list, same two actions, somewhere it costs no vertical space.
  needsOutcome,
  tab = 'day',
  onSetTab,
  onApplyOutcome,
  outcomeBusy,
}) => {
  const forDay = useMemo(
    () => appointments
      .filter((a) => a.date && String(a.date).slice(0, 10) === dayKey)
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)),
    [appointments, dayKey]
  );

  const counts = useMemo(() => {
    const c = {};
    forDay.forEach((a) => { c[a.status] = (c[a.status] || 0) + 1; });
    return c;
  }, [forDay]);

  // Past their slot and still not through the door. Only meaningful today:
  // on any other date "late" is not a thing anyone can act on.
  const lateCount = useMemo(() => {
    if (!isToday) return 0;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    return forDay.filter(
      (a) => ['scheduled', 'confirmed'].includes(a.status) && toMinutes(a.startTime) < mins
    ).length;
  }, [forDay, isToday]);

  const openCount = needsOutcome?.count || 0;
  const showing = tab === 'open' && openCount > 0 ? 'open' : 'day';

  return (
    <aside className="w-full lg:w-72 xl:w-80 lg:shrink-0 flex flex-col min-h-0 border border-gray-200 rounded-lg bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-200">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onCollapse}
            className="p-1 -ml-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors hidden lg:block"
            aria-label="Hide the day list"
          >
            <ChevronRight size={15} />
          </button>
          <h2 className="text-sm font-bold text-gray-900">
            {isToday ? 'Today' : 'That day'}
          </h2>
          <span className="text-sm font-bold text-gray-400 tabular-nums">{forDay.length}</span>
        </div>
        <button
          onClick={onRefresh}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Refresh the list"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {openCount > 0 && (
        <div className="flex border-b border-gray-200">
          {[
            { key: 'day', label: isToday ? 'Today' : 'That day', count: forDay.length },
            { key: 'open', label: 'Not closed off', count: openCount },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => onSetTab?.(t.key)}
              className={`flex-1 px-2 py-2 text-[11px] font-bold transition-colors border-b-2 -mb-px ${
                showing === t.key
                  ? (t.key === 'open'
                      ? 'border-amber-500 text-amber-800 bg-amber-50/60'
                      : 'border-[#2a276e] text-[#2a276e]')
                  : 'border-transparent text-gray-400 hover:text-gray-700'
              }`}
            >
              {t.label} <span className="tabular-nums">{t.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Past appointments nobody ever closed off. Surfaced, never auto-marked:
          guessing a no-show on a clinic's behalf would poison the exact number
          this is here to earn. */}
      {showing === 'open' ? (
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {(needsOutcome?.appointments || []).map((a) => (
            <div key={a.id} className="px-3 py-2 border-l-2 border-l-amber-400">
              <button data-appointment-id={a.id} onClick={() => onSelect(a, a.id)} className="block w-full text-left">
                <div className="text-[13px] font-semibold text-gray-900 truncate">{a.patientName || a.patient_name}</div>
                <div className="text-[11px] text-gray-500 tabular-nums">
                  {shortDay(a.date || a.appointment_date)} · {formatTime(a.startTime || a.start_time)}
                </div>
              </button>
              <div className="flex gap-1 mt-1">
                <button
                  onClick={() => onApplyOutcome(a.id, 'completed')}
                  disabled={outcomeBusy}
                  className="px-1.5 py-0.5 rounded text-[11px] font-bold text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  Seen
                </button>
                <button
                  onClick={() => onApplyOutcome(a.id, 'no_show')}
                  disabled={outcomeBusy}
                  className="px-1.5 py-0.5 rounded text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                >
                  No show
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
      <>
      {/* Where the day has got to. Only states that actually occur, so an empty
          morning is not six zeroes competing for attention. */}
      {forDay.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-3 py-2 border-b border-gray-200">
          {PIPELINE.filter((p) => counts[p.key]).map((p) => (
            <span key={p.key} className="inline-flex items-center gap-1.5 text-[11px]">
              <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
              <span className="text-gray-500">{p.short}</span>
              <span className={`font-bold tabular-nums ${p.text}`}>{counts[p.key]}</span>
            </span>
          ))}
        </div>
      )}

      {lateCount > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200">
          <AlertCircle size={13} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-[11px] font-semibold text-amber-900">
            {lateCount} {lateCount === 1 ? 'patient has' : 'patients have'} not checked in yet
          </p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {forDay.length === 0 ? (
          <p className="px-3 py-6 text-xs text-gray-400 text-center">
            {isToday ? 'Nobody is expected today yet.' : 'This day is clear.'}
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {forDay.map((a) => {
              const s = STYLE[a.status] || STYLE.scheduled;
              const off = a.status === 'cancelled';
              return (
                <li key={a.id}>
                  <button
                    data-appointment-id={a.id}
                    onClick={() => onSelect(a, a.id)}
                    className={`w-full text-left px-3 py-2 border-l-2 ${s.border} hover:bg-gray-50 transition-colors ${off ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className={`text-[13px] font-semibold text-gray-900 truncate ${off ? 'line-through' : ''}`}>
                        {a.patientName}
                      </span>
                      <span className={`text-[10px] font-bold flex-shrink-0 ${s.text}`}>{s.short}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 tabular-nums truncate">
                      {formatTime(a.startTime)} · {durationOf(a)} mins
                      {a.doctor && a.doctor !== 'Unassigned' && ` · ${a.doctor}`}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </>
      )}
    </aside>
  );
};

export default TodayRail;
