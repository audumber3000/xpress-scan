import { useCallback, useMemo, useState } from "react";

/**
 * Where the calendar is looking, and how you move it.
 *
 * The date and the view mode travel together: what a "previous" means depends
 * entirely on which view is on screen, so keeping them apart meant every caller
 * had to know both. Everything here is pure date arithmetic against those two
 * pieces of state, which is why it lifts cleanly out of the page.
 */

const pad = (n) => String(n).padStart(2, '0');

/**
 * A YYYY-MM-DD key in the clinic's own day, not UTC.
 *
 * toISOString resolves in UTC, so at IST (+5:30) local midnight is 18:30 the
 * day before and every key came out one day early. Exported because the grid
 * and the badges have to agree with this on what "the 14th" means.
 */
export const dateKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function useCalendarNavigation(initialView = 'week') {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState(initialView);

  const weekDates = useMemo(() => {
    const dates = [];
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push(d);
    }
    return dates;
  }, [currentDate]);

  // A step means a different amount in each view, which is the whole reason
  // date and view mode live together. One day, one month, or one week.
  const step = useCallback((direction) => {
    setCurrentDate((d) => {
      const next = new Date(d);
      if (viewMode === 'today') next.setDate(next.getDate() + direction);
      else if (viewMode === 'month') next.setMonth(next.getMonth() + direction);
      else next.setDate(next.getDate() + direction * 7);
      return next;
    });
  }, [viewMode]);

  const goToPrevious = useCallback(() => step(-1), [step]);
  const goToNext = useCallback(() => step(1), [step]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
    setViewMode('today');
  }, []);

  return {
    currentDate,
    setCurrentDate,
    viewMode,
    setViewMode,
    weekDates,
    goToPrevious,
    goToNext,
    goToToday,
  };
}

/** "Apr 28 to May 4, 2026", collapsing the parts both ends share. */
export const formatWeekRange = (dates) => {
  if (!dates || dates.length === 0) return '';
  const start = dates[0];
  const end = dates[dates.length - 1];
  const sm = start.toLocaleDateString('en-US', { month: 'short' });
  const em = end.toLocaleDateString('en-US', { month: 'short' });
  const sy = start.getFullYear();
  const ey = end.getFullYear();
  if (sy !== ey) return `${sm} ${start.getDate()}, ${sy} to ${em} ${end.getDate()}, ${ey}`;
  if (sm === em) return `${sm} ${start.getDate()} to ${end.getDate()}, ${sy}`;
  return `${sm} ${start.getDate()} to ${em} ${end.getDate()}, ${sy}`;
};

/** Today and its neighbours read better by name than by date. */
export const getRelativeDateLabel = (date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
