/**
 * The appointment lifecycle, the same six words the server uses.
 *
 * Mirrors backend/domains/scheduling/appointment_status.py. The server moved to
 * this vocabulary on Aug 11; the phone kept "confirmed = pending", "accepted"
 * and "checking", so it showed no buttons for a booking in `scheduled`, moved a
 * patient-confirmed booking backwards when "Accept" was pressed, and could not
 * check anybody in. Everything that reads a status goes through normalizeStatus.
 *
 *   scheduled ──► confirmed ──► arrived ──► completed
 *        │             │            │
 *        └─────────────┴────────────┴──────► cancelled / no_show
 */
export const SCHEDULED = 'scheduled';
export const CONFIRMED = 'confirmed';
export const ARRIVED = 'arrived';
export const COMPLETED = 'completed';
export const NO_SHOW = 'no_show';
export const CANCELLED = 'cancelled';

export type AppointmentStatus =
  | typeof SCHEDULED | typeof CONFIRMED | typeof ARRIVED
  | typeof COMPLETED | typeof NO_SHOW | typeof CANCELLED;

const ALL: AppointmentStatus[] = [SCHEDULED, CONFIRMED, ARRIVED, COMPLETED, NO_SHOW, CANCELLED];

/** What older records and older builds wrote, and where each one lands. */
const LEGACY: Record<string, AppointmentStatus> = {
  accepted: SCHEDULED,
  pending: SCHEDULED,
  booked: SCHEDULED,
  registered: ARRIVED,
  checking: ARRIVED,
  'checked in': ARRIVED,
  checked_in: ARRIVED,
  encounter: ARRIVED,
  'in progress': ARRIVED,
  in_progress: ARRIVED,
  finished: COMPLETED,
  done: COMPLETED,
  rejected: CANCELLED,
  canceled: CANCELLED,
  'no-show': NO_SHOW,
  noshow: NO_SHOW,
};

/** Unknown values read as `scheduled`: visible and actionable, never swallowed. */
export const normalizeStatus = (value?: string | null): AppointmentStatus => {
  const key = String(value || '').trim().toLowerCase();
  if ((ALL as string[]).includes(key)) return key as AppointmentStatus;
  return LEGACY[key] || SCHEDULED;
};

export const isOpen = (s?: string | null) => [SCHEDULED, CONFIRMED, ARRIVED].includes(normalizeStatus(s));
export const isTerminal = (s?: string | null) => !isOpen(s);

export const STATUS_META: Record<AppointmentStatus, { label: string; color: string; bg: string; border: string }> = {
  scheduled: { label: 'Scheduled', color: '#374151', bg: '#F3F4F6', border: '#6B7280' },
  confirmed: { label: 'Confirmed', color: '#B45309', bg: '#FFF4E5', border: '#E29312' },
  arrived: { label: 'Arrived', color: '#065F46', bg: '#D1FAE5', border: '#10B981' },
  completed: { label: 'Completed', color: '#1e429f', bg: '#e1effe', border: '#0694a2' },
  no_show: { label: 'No-show', color: '#92400E', bg: '#FEF3C7', border: '#D97706' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2', border: '#EF4444' },
};

export const statusMeta = (s?: string | null) => STATUS_META[normalizeStatus(s)];
