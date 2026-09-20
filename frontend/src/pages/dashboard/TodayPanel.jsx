import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, FlaskConical, UserX, CalendarClock, Package, CheckCircle2, ChevronRight, Stethoscope } from 'lucide-react';
import { SkeletonBox } from '../../components/Skeleton';
import MonthCalendar from './MonthCalendar';
import { formatCompactMoney } from './format';
import { api } from '../../utils/api';
import { formatDate, formatTime } from '../../utils/datetime';
import { generatePatientPersona, generateInitialsAvatar } from '../../utils/avatar';

/**
 * Words a receptionist would use, not the values the database stores.
 *
 * These also had to be updated: the map still keyed on 'checking' and
 * 'accepted', which stopped existing when the statuses were renamed, so most
 * rows fell through to the grey default and every state looked the same.
 *
 * ─── Three weights, not seven fills ──────────────────────────────────────
 *
 * Every status used to carry its own tinted pill — grey, lavender, green,
 * emerald, amber, struck-through grey — and the interleaved list added a navy
 * "In chair" and an emerald "Registered" on top of that. Eight fills in one
 * narrow column, which is past the point where colour classes stop separating
 * and start blurring, and it made the column impossible to skim: everything
 * was shouting equally.
 *
 * There are only three things this column has to say, so there are three
 * weights:
 *
 *   NOW    solid fill      somebody is in the building and you should look up
 *   AHEAD  light tint      still to come
 *   DONE   muted ink only  finished, and out of the way
 *
 * A no-show is DONE by weight — the visit is over — but keeps amber ink,
 * because it is the one finished state that still owes you an action. That is
 * one ink colour, not a fourth fill.
 */
const WEIGHT = {
  now:    'bg-[#4b45b5] text-white',
  ahead:  'bg-[#efeefb] text-[#4b45b5]',
  done:   'text-gray-400',
  missed: 'text-amber-700',
};

const STATUS_STYLES = {
  scheduled:  { label: 'Booked',    weight: 'ahead' },
  confirmed:  { label: 'Confirmed', weight: 'ahead' },
  arrived:    { label: 'Here now',  weight: 'now' },
  completed:  { label: 'Seen',      weight: 'done' },
  no_show:    { label: 'No show',   weight: 'missed' },
  'no-show':  { label: 'No show',   weight: 'missed' },
  cancelled:  { label: 'Cancelled', weight: 'done' },
};

const StatusBadge = ({ status }) => {
  const s = STATUS_STYLES[status]
    || { label: String(status || '').replace('_', ' '), weight: 'ahead' };
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${WEIGHT[s.weight]}`}>
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

/**
 * One booked visit.
 *
 * Split out of the panel when the schedule and the day's registrations became a
 * single interleaved list: two row shapes inline in one map is where a render
 * function stops being readable.
 */
const AppointmentRow = ({ a, isNext, onOpen }) => {
  const done = ['completed', 'no_show', 'no-show', 'cancelled'].includes(a.status);
  return (
    <button
      onClick={onOpen}
      title={`Open ${a.name}'s appointment`}
      className={`w-full text-left flex items-center gap-2.5 py-2 px-1.5 -mx-1.5 rounded-lg border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50 group cursor-pointer ${
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
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 inline-flex items-center gap-1 whitespace-nowrap ${WEIGHT.now}`}>
          <Stethoscope size={10} /> In chair
        </span>
      ) : (
        <StatusBadge status={a.status} />
      )}

      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#2a276e] flex-shrink-0 transition-colors" />
    </button>
  );
};

/**
 * One patient registered on the selected day.
 *
 * Same gutter, avatar and chevron as AppointmentRow so the merged list reads as
 * one list. What separates the two is the pill on the right, which is the only
 * thing either row needs to say about which kind it is.
 */
const RegistrationRow = ({ pt, activeDate, onOpen }) => {
  // The day this list is bucketed by is the day the record
  // was created. When staff back-dated the registration to
  // an earlier visit, the row says so rather than quietly
  // contradicting the register.
  const backDated = pt.registered_on && pt.registered_on !== activeDate;
  const meta = [
    pt.age ? `${pt.age}y` : null,
    pt.gender || null,
    pt.phone || null,
  ].filter(Boolean).join(' · ');
  return (
    <button
      onClick={onOpen}
      title={`Open ${pt.name}'s profile`}
      className="w-full text-left flex items-center gap-2.5 py-2 px-1.5 -mx-1.5 rounded-lg border-b border-gray-50 last:border-0 transition-colors hover:bg-gray-50 group cursor-pointer"
    >
      {/* Same 12-wide gutter and the same grey as the
          appointment rows, so the two lists share one left
          edge and one reading. A timestamp carries no
          verdict; the green belongs on the calendar badge,
          where it means a new patient. */}
      <span className="w-12 flex-shrink-0 text-center">
        <span className="block text-[11px] font-bold tabular-nums text-gray-700">
          {/* 24h on purpose: the appointment rows above
              put a bare "10:30" in this same 48px gutter,
              and "10:23 AM" would wrap out of it. */}
          {pt.at ? formatTime(pt.at, { hour: '2-digit', minute: '2-digit', hour12: false }) : '—'}
        </span>
      </span>

      <img
        src={generatePatientPersona({ name: pt.name }, 64)}
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = generateInitialsAvatar(pt.name || 'Patient');
        }}
        alt=""
        className="w-7 h-7 rounded-full object-cover border border-gray-100 flex-shrink-0"
      />

      <span className="flex-1 min-w-0">
        <span className="block text-xs font-semibold text-gray-900 truncate">{pt.name}</span>
        <span className="block text-[11px] text-gray-400 truncate">
          {meta || 'No details recorded'}
        </span>
      </span>

      {backDated && (
        <span
          title={`Registration date set to ${formatDate(pt.registered_on)}`}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 flex-shrink-0 whitespace-nowrap"
        >
          for {formatDate(pt.registered_on)}
        </span>
      )}

      {/* The kind pill. It sits in the same slot an appointment's status badge
          uses, so the interleaved list has exactly one pill per row and you can
          read the column straight down: Booked, Registered, Seen, Registered.

          DONE weight: a registration is a thing that has already happened, and
          it was the loudest pill in the column while being the one that never
          asks for anything. */}
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap ${WEIGHT.done}`}>
        Registered
      </span>

      <ChevronRight size={14} className="text-gray-300 group-hover:text-[#2a276e] flex-shrink-0 transition-colors" />
    </button>
  );
};

/**
 * Where the clock is, in a list of times.
 *
 * A hairline and one word. It is not a row and must never look like one, so it
 * carries no avatar gutter, no pill and no hover state — the eye should land
 * on it once, take the position, and move on.
 */
const NowLine = ({ innerRef }) => (
  <div ref={innerRef} className="flex items-center gap-2 py-1.5" aria-label="Current time">
    <span className="text-[9px] font-bold uppercase tracking-wider text-[#4b45b5] flex-shrink-0">
      Now
    </span>
    <span className="flex-1 h-px bg-[#4b45b5]/25" />
  </div>
);

const TodayPanel = ({ data, loading }) => {
  const [selectedDate, setSelectedDate] = useState(null);
  const navigate = useNavigate();

  const month = data?.month;

  // Which month the calendar is showing. Null means the one the dashboard
  // payload already carries, so the common case costs no extra request.
  const [view, setView] = useState(null);
  const [viewDays, setViewDays] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);

  const shownYear = view ? view.year : month?.year;
  const shownMonth = view ? view.month : month?.month;
  const shownDays = view ? (viewDays || []) : (month?.days || []);

  // The grid is drawn from year/month alone, so an arrow redraws the dates at
  // once and this only fills in the dots behind them.
  useEffect(() => {
    if (!view) return undefined;
    let cancelled = false;
    const key = `${view.year}-${String(view.month).padStart(2, '0')}`;
    setViewLoading(true);
    api.get('/dashboard/month-activity', { params: { month: key } })
      .then((res) => { if (!cancelled) setViewDays(res?.days || []); })
      .catch(() => { if (!cancelled) setViewDays([]); })
      .finally(() => { if (!cancelled) setViewLoading(false); });
    return () => { cancelled = true; };
  }, [view]);

  const stepMonth = (offset) => {
    if (!shownYear || !shownMonth) return;
    const next = new Date(shownYear, shownMonth - 1 + offset, 1);
    const isCurrent = month && next.getFullYear() === month.year && next.getMonth() + 1 === month.month;
    setViewDays(null);
    setView(isCurrent ? null : { year: next.getFullYear(), month: next.getMonth() + 1 });
  };

  // Every day in that grid is clickable, so every day has to answer. Today
  // ships with the dashboard payload; any other day is fetched, and kept in a
  // cache so clicking back and forth costs one request per day rather than one
  // per click.
  const isOtherDay = selectedDate && month && selectedDate !== month.today;
  const [dayCache, setDayCache] = useState({});
  const [dayLoading, setDayLoading] = useState(false);

  useEffect(() => {
    // `in`, not a truthy check: a failed day is cached as null, and a
    // truthy guard would read that as "not fetched yet" and refetch it on
    // every render for as long as the day stayed selected.
    if (!isOtherDay || selectedDate in dayCache) return undefined;
    let cancelled = false;
    setDayLoading(true);
    api.get('/dashboard/day', { params: { date: selectedDate } })
      .then((res) => { if (!cancelled) setDayCache((prev) => ({ ...prev, [selectedDate]: res })); })
      .catch(() => {
        // An empty day and a failed request look the same to the panel, so the
        // failure is cached as empty rather than retried on every re-render.
        if (!cancelled) setDayCache((prev) => ({ ...prev, [selectedDate]: null }));
      })
      .finally(() => { if (!cancelled) setDayLoading(false); });
    return () => { cancelled = true; };
  }, [isOtherDay, selectedDate, dayCache]);

  const day = isOtherDay ? dayCache[selectedDate] : data;
  const dayAppointments = day?.appointments || [];
  const daySummary = day?.summary;
  const dayPatients = day?.patients || [];
  const dayPatientsTotal = day?.patients_total || dayPatients.length;
  const showingToday = !isOtherDay;
  const activeDate = selectedDate || month?.today;

  // Both lists interleaved into the order the day actually happened, rather
  // than a block of visits followed by a block of registrations. An
  // appointment carries a clinic-local "HH:MM"; a registration carries a UTC
  // timestamp, so it is rendered to clinic time before being compared, or the
  // two would sort against different clocks. Anything with no time sinks to
  // the bottom instead of claiming midnight.
  const dayRows = useMemo(() => {
    const rows = [
      ...dayAppointments.map((a) => ({
        kind: 'appointment',
        key: `a${a.id}`,
        at: a.time ? toMinutes(a.time) : null,
        data: a,
      })),
      ...dayPatients.map((pt) => ({
        kind: 'registration',
        key: `p${pt.id}`,
        at: pt.at
          ? toMinutes(formatTime(pt.at, { hour: '2-digit', minute: '2-digit', hour12: false }))
          : null,
        data: pt,
      })),
    ];
    return rows.sort((x, y) => {
      if (x.at === null) return 1;
      if (y.at === null) return -1;
      return x.at - y.at;
    });
  }, [dayAppointments, dayPatients]);

  const heading = useMemo(() => {
    if (!selectedDate || !month) return 'Today';
    const d = new Date(`${selectedDate}T00:00:00`);
    return selectedDate === month.today
      ? 'Today'
      : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
  }, [selectedDate, month]);

  // The first appointment still to happen. Anchored on the clock rather than
  // just "the first open one", so a morning nobody closed out does not leave
  // NEXT sitting on 9am all afternoon. Only today has a "next": on the 3rd of
  // last month nothing is up next, and the badge would be a small lie.
  const nextUpId = useMemo(() => {
    if (!showingToday) return null;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const open = dayAppointments.filter(
      (a) => !['completed', 'no_show', 'no-show', 'cancelled'].includes(a.status)
    );
    const upcoming = open.find((a) => toMinutes(a.time) + (a.duration || 30) >= mins);
    return (upcoming || open[0])?.id ?? null;
  }, [dayAppointments, showingToday]);

  // Where "now" falls in the day's list.
  //
  // A day list with no time marker makes the reader work out where they are by
  // reading times and comparing them to the clock, every time they glance at
  // it. One hairline removes that. Only today gets one: on the 3rd of last
  // month there is no "now" in the list, and drawing one would be a small lie
  // of the same kind the NEXT badge avoids above.
  //
  // The index is the first row that has not happened yet — which is also the
  // first untimed row, since those sort to the bottom — so a fully finished
  // day puts the line at the end rather than not at all.
  const nowIndex = useMemo(() => {
    if (!showingToday || dayRows.length === 0) return -1;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const idx = dayRows.findIndex((r) => r.at === null || r.at >= mins);
    return idx === -1 ? dayRows.length : idx;
  }, [dayRows, showingToday]);

  const scrollerRef = useRef(null);
  const nowRef = useRef(null);
  const [atBottom, setAtBottom] = useState(true);

  // Open on the part of the day that is still ahead. A busy clinic's morning
  // is above the fold by 4pm otherwise, and the rows you can still do anything
  // about are the ones off-screen.
  //
  // scrollTop rather than scrollIntoView: the latter walks up to the nearest
  // scrollable ancestor, which here is the whole dashboard, so it would yank
  // the page down past the KPI row on load.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const marker = nowRef.current;
    if (!scroller || !marker) return;
    scroller.scrollTop = Math.max(0, marker.offsetTop - scroller.clientHeight / 2);
  }, [nowIndex, activeDate]);

  const onScroll = useCallback((e) => {
    const el = e.currentTarget;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
  }, []);

  // Reset when the day changes: a short day has nothing below the fold, and a
  // stale `false` would leave a fade hanging under a list that already ended.
  useEffect(() => { setAtBottom(true); }, [activeDate]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3.5 md:p-5 mb-4 md:mb-5">
      {loading ? (
        <TodayPanelSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1.1fr_1fr] gap-5 md:gap-6">
            <MonthCalendar
              year={shownYear}
              month={shownMonth}
              today={month?.today}
              days={shownDays}
              loading={viewLoading}
              selected={selectedDate}
              onSelect={setSelectedDate}
              onNavigate={stepMonth}
              onToday={() => { setView(null); setViewDays(null); setSelectedDate(null); }}
            />

            <div className="min-w-0 flex flex-col">
              {/* The day's progress as a rail rather than a sentence.
                  "12 booked · 5 done · 7 left" made the reader do the division
                  to find out how far through the day the clinic is, which is
                  the only thing that line was for. The numbers stay; the bar
                  answers first. */}
              <div className="mb-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <h4 className="text-sm font-bold text-gray-800 tracking-tight">{heading}</h4>
                  {daySummary?.total > 0 && (
                    <span className="text-[11px] text-gray-400 font-medium tabular-nums whitespace-nowrap">
                      {daySummary.completed} of {daySummary.total} done
                    </span>
                  )}
                </div>
                {daySummary?.total > 0 && (
                  <div
                    className="h-1 rounded-full bg-gray-100 overflow-hidden mt-1.5"
                    role="img"
                    aria-label={`${daySummary.completed} of ${daySummary.total} appointments done, ${daySummary.remaining} left`}
                  >
                    <div
                      className="h-full rounded-full bg-[#4b45b5] transition-[width] duration-500"
                      style={{ width: `${Math.round((daySummary.completed / daySummary.total) * 100)}%` }}
                    />
                  </div>
                )}
              </div>

              {dayLoading && !day ? (
                <div className="flex-1 min-h-[8rem] space-y-2 pt-1">
                  {[0, 1, 2].map((i) => <SkeletonBox key={i} className="h-10 w-full rounded-lg" />)}
                </div>
              ) : dayAppointments.length === 0 && dayPatients.length === 0 ? (
                <div className="flex-1 min-h-[8rem] rounded-lg border border-dashed border-gray-200 grid place-items-center text-center px-4">
                  <span>
                    <span className="block text-xs font-semibold text-gray-600">
                      {showingToday ? 'Nothing booked today' : `Nothing on ${heading}`}
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">
                      {showingToday ? 'New bookings show up here' : 'No visits booked, nobody registered'}
                    </span>
                  </span>
                </div>
              ) : (
                // One scroller holding both lists rather than a tab each: the
                // day's two answers are worth reading side by side, and a tab
                // would hide one of them behind a click.
                //
                // Fills the column rather than guessing a pixel height: beside
                // the calendar it stops exactly where the calendar does, so a
                // busy day scrolls instead of leaving a row sliced in half.
                // Stacked on a phone there's no column to match, so it caps.
                // The scroller has to cap on desktop too. It used to be
                // md:max-h-none with flex-1 doing the work, but the two columns
                // are grid cells that size to their content, so flex-1 had
                // nothing to push against and twenty registrations stretched
                // the card halfway down the page. flex-1 now sits on the
                // wrapper and the scroller takes its height, which keeps that
                // fix while giving the fade something to be positioned against.
                //
                // The wrapper exists for that fade. A hard clip gave no sign
                // there was anything below it, and on a busy afternoon the
                // rows still ahead of you are exactly the ones off-screen.
                <div className="relative md:flex-1 md:min-h-0">
                  <div
                    ref={scrollerRef}
                    onScroll={onScroll}
                    className={`space-y-0 max-h-[15rem] md:max-h-[18rem] md:h-full overflow-y-auto pr-1 -mr-1 transition-opacity ${
                      dayLoading ? 'opacity-50' : ''
                    }`}
                  >
                    {dayRows.map((row, i) => (
                      <React.Fragment key={row.key}>
                        {i === nowIndex && <NowLine innerRef={nowRef} />}
                        {row.kind === 'appointment' ? (
                          <AppointmentRow
                            a={row.data}
                            isNext={!!nextUpId && row.data.id === nextUpId}
                            onOpen={() => navigate(`/calendar?appointment=${row.data.id}`)}
                          />
                        ) : (
                          <RegistrationRow
                            pt={row.data}
                            activeDate={activeDate}
                            onOpen={() => navigate(`/patient-profile/${row.data.id}`)}
                          />
                        )}
                      </React.Fragment>
                    ))}

                    {/* A day where everything has already happened still gets
                        the line, at the end, rather than silently losing it. */}
                    {nowIndex === dayRows.length && <NowLine innerRef={nowRef} />}

                    {dayPatientsTotal > dayPatients.length && (
                      <button
                        onClick={() => navigate('/patients')}
                        className="w-full text-left py-2 px-1.5 -mx-1.5 rounded-lg text-[11px] font-semibold text-[#4b45b5] hover:bg-gray-50 transition-colors cursor-pointer"
                      >
                        {dayPatientsTotal - dayPatients.length} more registered this day, open in Patients
                      </button>
                    )}
                  </div>

                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-white to-transparent transition-opacity duration-200 ${
                      atBottom ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
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
