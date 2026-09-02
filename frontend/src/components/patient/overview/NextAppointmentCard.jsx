import React from 'react';
import { CalendarClock } from 'lucide-react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import { formatDate } from '../../../utils/datetime';

/**
 * The next booking, or an honest gap.
 *
 * No "Send reminder" button, though the reference had one: reminders are
 * scheduled per clinic and there is no endpoint to fire one at a single
 * appointment. A button that cannot do the thing it names is worse than its
 * absence.
 *
 * `recall` is the doctor's own "come back in a month" off the last case paper.
 * It is not a booking, so it never outranks one, but when nothing is booked it
 * is the difference between "not booked" and "not booked, and they were due
 * three weeks ago". That warning used to live as a chip in the header; this is
 * where it belongs, next to the thing it is about.
 */
const NextAppointmentCard = ({ appointment, recall, onBook, onOpenCalendar }) => (
  <OverviewCard title="Next Appointment" action="View Calendar" onOpen={onOpenCalendar}>
    {!appointment ? (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-gray-500">Nothing booked for this patient.</p>
        {recall && (
          <p className={`mt-2 inline-block px-2.5 py-1 rounded text-[11px] font-bold ${
            recall.overdue ? 'bg-amber-50 text-amber-700' : 'bg-[#2a276e]/[0.07] text-[#2a276e]'
          }`}>
            {recall.text}
          </p>
        )}
        {/* Books here, with this patient already filled in. It used to drop
            you on the calendar page to start over from an empty form. */}
        <button
          type="button"
          onClick={onBook}
          className="mt-3 w-full py-2.5 rounded-lg bg-[#2a276e] text-white text-sm font-semibold hover:bg-[#1a1548] transition-colors cursor-pointer"
        >
          Book appointment
        </button>
      </div>
    ) : (
      <div className="p-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-lg bg-[#2a276e]/[0.08] text-[#2a276e] grid place-items-center flex-shrink-0">
            <CalendarClock size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900">
              {formatDate(appointment.date)}
              {appointment.time && (
                <span className="font-semibold text-gray-500"> · {appointment.time}</span>
              )}
            </p>
            {appointment.procedure && (
              <p className="text-xs text-gray-600 mt-0.5 truncate" title={appointment.procedure}>{appointment.procedure}</p>
            )}
            {appointment.doctor && (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate" title={appointment.doctor}>{appointment.doctor}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            type="button"
            onClick={onOpenCalendar}
            className="py-2 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Reschedule
          </button>
          <button
            type="button"
            onClick={onBook}
            className="py-2 rounded-lg bg-[#2a276e] text-white text-xs font-semibold hover:bg-[#1a1548] transition-colors cursor-pointer"
          >
            Book another
          </button>
        </div>
      </div>
    )}
  </OverviewCard>
);

export default NextAppointmentCard;
