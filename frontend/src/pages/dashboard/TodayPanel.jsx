import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, FlaskConical, UserX, CalendarClock, Package, CheckCircle2, ChevronRight, Stethoscope } from 'lucide-react';
import { SkeletonBox } from '../../components/Skeleton';
import MonthCalendar from './MonthCalendar';
import { formatCompactMoney } from './format';
import { generatePatientPersona, generateInitialsAvatar } from '../../utils/avatar';

/**
 * Words a receptionist would use, not the values the database stores.
 *
 * These also had to be updated: the map still keyed on 'checking' and
 * 'accepted', which stopped existing when the statuses were renamed, so most
 * rows fell through to the grey default and every state looked the same.
 */
const STATUS_STYLES = {
  scheduled: { label: 'Booked',   cls: 'bg-gray-100 text-gray-600' },
  confirmed: { label: 'Confirmed', cls: 'bg-[#f0f0fd] text-[#2a276e]' },
  arrived:   { label: 'Here now',  cls: 'bg-green-50 text-green-700 ring-1 ring-green-200' },
  completed: { label: 'Seen',      cls: 'bg-emerald-50 text-emerald-700' },
  no_show:   { label: 'No show',   cls: 'bg-amber-50 text-amber-700' },
  'no-show': { label: 'No show',   cls: 'bg-amber-50 text-amber-700' },
  cancelled: { label: 'Cancelled', cls: 'bg-gray-100 text-gray-400 line-through' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status] || { label: String(status || '').replace('_', ' '), cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
};

const toMinutes = (t) => {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const fmt = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${period}`;
};

/**
 * Needs-attention as a chip strip.
 *
 * Was a stacked column of full-width tiles, which took a third of the panel's
 * height to say "3 things need doing". These carry the same counts and the same
 * destinations in one scrollable row.
 */
const AttentionChips = ({ attention }) => {
  const navigate = useNavigate();
  const dues = attention?.outstanding_dues || { count: 0, amount: 0 };

  const chips = [
    dues.count > 0 && {
      key: 'dues',
      icon: Wallet,
      text: `${formatCompactMoney(dues.amount)} due`,
      sub: `${dues.count} ${dues.count === 1 ? 'invoice' : 'invoices'}`,
      tone: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
      to: '/payments',
    },
    attention?.overdue_labs > 0 && {
      key: 'labs',
      icon: FlaskConical,
      text: `${attention.overdue_labs} lab ${attention.overdue_labs === 1 ? 'case' : 'cases'}`,
      sub: 'overdue',
      tone: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
      to: '/lab',
    },
    attention?.no_shows_today > 0 && {
      key: 'noshow',
      icon: UserX,
      text: `${attention.no_shows_today} no-${attention.no_shows_today === 1 ? 'show' : 'shows'}`,
      sub: 'rebook',
      tone: 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100',
      to: '/calendar',
    },
    attention?.expiring_soon > 0 && {
      key: 'expiring',
      icon: CalendarClock,
      text: `${attention.expiring_soon} expiring`,
      sub: 'within 30 days',
      tone: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
      to: '/vendors',
    },
    attention?.low_stock > 0 && {
      key: 'stock',
      icon: Package,
      text: `${attention.low_stock} low stock`,
      sub: 'reorder',
      tone: 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
      to: '/vendors',
    },
  ].filter(Boolean);

  if (chips.length === 0) {
    return (
      <div className="flex items-center gap-2 text-xs text-gray-500 px-1">
        <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" />
        All clear, nothing pending
      </div>
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [&::-webkit-scrollbar]:hidden">
      {chips.map(({ key, icon: Icon, text, sub, tone, to }) => (
        <button
          key={key}
          onClick={() => navigate(to)}
          className={`flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border text-left transition-colors flex-shrink-0 min-h-[2.25rem] ${tone}`}
        >
          <Icon size={15} className="flex-shrink-0" />
          <span className="leading-tight">
            <span className="block text-[11px] font-bold whitespace-nowrap">{text}</span>
            <span className="block text-[10px] opacity-75 whitespace-nowrap">{sub}</span>
          </span>
        </button>
      ))}
    </div>
  );
};

const TodayPanelSkeleton = () => (
  <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-5">
    {[0, 1].map((col) => (
      <div key={col} className="space-y-2.5">
        <SkeletonBox className="h-4 w-32 mb-3" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <SkeletonBox className="w-8 h-8 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <SkeletonBox className="h-3 w-2/3" />
              <SkeletonBox className="h-2.5 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    ))}
  </div>
);

const TodayPanel = ({ data, loading }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const navigate = useNavigate();

  const appointments = data?.appointments || [];
  const summary = data?.summary;
  const month = data?.month;

  // Selecting a day only filters when it's today — the payload carries today's
  // appointments, not the whole month. Any other day sends you to the calendar
  // rather than showing a misleadingly empty list.
  const isOtherDay = selectedDate && month && selectedDate !== month.today;

  const heading = useMemo(() => {
    if (!selectedDate || !month) return 'Today';
    const d = new Date(`${selectedDate}T00:00:00`);
    return selectedDate === month.today
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }, [selectedDate, month]);

  // The first appointment still to happen. Anchored on the clock rather than
  // just "the first open one", so a morning nobody closed out does not leave
  // NEXT sitting on 9am all afternoon.
  const nextUpId = useMemo(() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const open = appointments.filter(
      (a) => !['completed', 'no_show', 'no-show', 'cancelled'].includes(a.status)
    );
    const upcoming = open.find((a) => toMinutes(a.time) + (a.duration || 30) >= mins);
    return (upcoming || open[0])?.id ?? null;
  }, [appointments]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5 md:p-5 mb-4 md:mb-5">
      {loading ? (
        <TodayPanelSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr] gap-5 md:gap-6">
            <MonthCalendar month={month} selected={selectedDate} onSelect={setSelectedDate} />

            <div className="min-w-0 flex flex-col">
              <div className="flex items-baseline justify-between gap-2 mb-2.5">
                <h4 className="text-sm font-bold text-gray-800 tracking-tight">{heading}</h4>
                {summary && !isOtherDay && (
                  <span className="text-[11px] text-gray-400 font-medium tabular-nums whitespace-nowrap">
                    {summary.total} booked · {summary.completed} done · {summary.remaining} left
                  </span>
                )}
              </div>

              {isOtherDay ? (
                <button
                  onClick={() => navigate('/calendar')}
                  className="flex-1 min-h-[8rem] rounded-lg border border-dashed border-gray-200 grid place-items-center text-center px-4 hover:border-[#2a276e]/40 hover:bg-gray-50 transition-colors"
                >
                  <span>
                    <span className="block text-xs font-semibold text-gray-600">Open {heading} in the calendar</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">This panel only lists today's visits</span>
                  </span>
                </button>
              ) : appointments.length === 0 ? (
                <div className="flex-1 min-h-[8rem] rounded-lg border border-dashed border-gray-200 grid place-items-center text-center px-4">
                  <span>
                    <span className="block text-xs font-semibold text-gray-600">Nothing booked today</span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">New bookings show up here</span>
                  </span>
                </div>
              ) : (
                // Fills the column rather than guessing a pixel height: beside
                // the calendar it stops exactly where the calendar does, so a
                // busy day scrolls instead of leaving a row sliced in half.
                // Stacked on a phone there's no column to match, so it caps.
                <div className="space-y-0 max-h-[15rem] md:max-h-none md:flex-1 md:min-h-0 overflow-y-auto pr-1 -mr-1">
                  {appointments.map((a) => {
                    const done = ['completed', 'no_show', 'no-show', 'cancelled'].includes(a.status);
                    // Who is up next: the first appointment not yet dealt with
                    // whose time has not long passed. A dashboard glance is
                    // mostly asking this.
                    const isNext = !done && a.id === nextUpId;
                    return (
                      <button
                        key={a.id}
                        onClick={() => navigate(`/calendar?appointment=${a.id}`)}
                        title={`Open ${a.name}'s appointment`}
                        className={`w-full text-left flex items-center gap-2.5 py-2 px-1.5 -mx-1.5 rounded-lg border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50 group ${
                          done ? 'opacity-55' : ''
                        }`}
                      >
                        {/* Time, and how long they are in for. Two lines that
                            used to be one number with no sense of scale. */}
                        <span className="w-12 flex-shrink-0 text-center">
                          <span className={`block text-[11px] font-bold tabular-nums ${
                            isNext ? 'text-[#2a276e]' : 'text-gray-700'
                          }`}>
                            {a.time || '—'}
                          </span>
                          {a.duration > 0 && (
                            <span className="block text-[9px] text-gray-400 tabular-nums">
                              {a.duration}m
                            </span>
                          )}
                        </span>

                        <img
                          src={generatePatientPersona({ name: a.name }, 64)}
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = generateInitialsAvatar(a.name || 'Patient');
                          }}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover border border-gray-100 flex-shrink-0"
                        />

                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="text-xs font-semibold text-gray-900 truncate">{a.name}</span>
                            {isNext && (
                              <span className="text-[9px] font-bold text-[#2a276e] bg-[#f0f0fd] px-1.5 py-0.5 rounded flex-shrink-0">
                                NEXT
                              </span>
                            )}
                          </span>
                          {/* Treatment and doctor on one line. Either can be
                              missing, so the separator only appears when both
                              are actually there. */}
                          <span className="block text-[11px] text-gray-400 truncate">
                            {a.treatment}
                            {a.treatment && a.doctor_name && ' · '}
                            {a.doctor_name && (
                              <span className="text-gray-500">{a.doctor_name}</span>
                            )}
                            {!a.treatment && !a.doctor_name && 'No doctor assigned'}
                          </span>
                        </span>

                        {/* Started beats booked: once a visit is open, that is
                            the more useful thing to know. */}
                        {a.visit_started && !done ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#2a276e] text-white flex-shrink-0 inline-flex items-center gap-1 whitespace-nowrap">
                            <Stethoscope size={10} /> In chair
                          </span>
                        ) : (
                          <StatusBadge status={a.status} />
                        )}

                        <ChevronRight size={14} className="text-gray-300 group-hover:text-[#2a276e] flex-shrink-0 transition-colors" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-gray-100">
            <AttentionChips attention={data?.attention} />
          </div>
        </>
      )}
    </div>
  );
};

export default TodayPanel;
