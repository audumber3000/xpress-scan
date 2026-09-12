import { colors } from '../../shared/constants/colors';
import type { AttendanceDayCell } from '../../services/api/attendance.api';

/**
 * What one day in the attendance month means, and what colour it wears.
 *
 * Kept apart from the calendar component because the month grid, the day sheet
 * and the shift list all have to agree, and because the mapping is the part
 * worth testing: the three empty-looking states are genuinely different.
 *
 *   future      nothing has happened yet, so nothing is claimed (faded)
 *   blank       the day came and went unmarked (plain, outlined)
 *   a record    on time, late, absent or holiday, in the status colours
 *
 * The names and colours come straight from what the server calls a day, so the
 * employee's month and the owner's grid can never disagree about one.
 */
export type DayKind = 'future' | 'blank' | 'on_time' | 'late' | 'absent' | 'holiday';

export const DAY_TONE: Record<string, { bg: string; text: string; label: string }> = {
  on_time: { bg: colors.successBadgeBg, text: '#047857', label: 'Present' },
  late:    { bg: colors.warningLight,   text: '#B45309', label: 'Late' },
  absent:  { bg: colors.errorLight,     text: '#B91C1C', label: 'Absent' },
  holiday: { bg: colors.gray100,        text: colors.gray600, label: 'Holiday' },
};

export const cellKind = (value: AttendanceDayCell | undefined): DayKind => {
  if (value === null) return 'future';
  if (!value || !(value as any).status) return 'blank';
  const status = String((value as any).status);
  // An unknown status reads as unmarked rather than crashing the grid: the
  // server is free to add a word, and a month that fails to draw is worse than
  // one plain cell.
  return (status in DAY_TONE ? status : 'blank') as DayKind;
};

/** True for a day with something real on it, so the shift list can skip the rest. */
export const isRecorded = (value: AttendanceDayCell | undefined): boolean => {
  const kind = cellKind(value);
  return kind !== 'future' && kind !== 'blank';
};
