import React from 'react';
import { CalendarCheck, CalendarClock, IndianRupee, ArrowRight } from 'lucide-react';
import { formatDate } from '../../utils/datetime';
import { getCurrencySymbol } from '../../utils/currency';

/**
 * Last visit, next appointment, outstanding — the three things you open a
 * patient to find out, visible from every tab rather than only the Overview.
 *
 * One bordered group with hairline dividers, not three separate cards: they are
 * one answer in three parts, and three cards would compete with the safety band
 * directly beneath them.
 */
/**
 * `whitespace-nowrap` on the value, not `truncate`.
 *
 * These are dates and short amounts of known length, and truncating one to
 * "31 Aug 2..." destroys the only thing it was there to say. The cells size to
 * their content instead, and the group wraps to two rows before any of them
 * clips. The action label gets the same treatment — "View Details" was breaking
 * across two lines and pushing the row taller than its neighbours.
 */
const Stat = ({ icon, label, value, sub, action, onAction, tone }) => (
  <div className="flex items-start gap-2.5 px-3.5 py-3 min-w-0 flex-1">
    <span className={`w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 ${tone || 'bg-[#2a276e]/[0.08] text-[#2a276e]'}`}>
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">{label}</p>
      <p className="text-sm font-bold text-gray-900 whitespace-nowrap">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 whitespace-nowrap">{sub}</p>}
      {action && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-[#2a276e] hover:underline cursor-pointer whitespace-nowrap"
        >
          {action} <ArrowRight size={11} />
        </button>
      )}
    </div>
  </div>
);

// `nextAppointment` arrives already transformed by PatientProfile:
// appointment_date is `date` and start_time is `time`. Reading the raw column
// names here is what made this read "Not booked" for every patient.
const PatientHeaderStats = ({ lastVisit, nextAppointment, outstanding, onViewBilling }) => (
  <div className="flex flex-col sm:flex-row rounded-xl border border-gray-200 divide-y sm:divide-y-0 sm:divide-x divide-gray-200 bg-white overflow-hidden">
    <Stat
      icon={<CalendarCheck size={16} />}
      label="Last Visit"
      value={lastVisit ? formatDate(lastVisit) : 'No visits yet'}
    />
    <Stat
      icon={<CalendarClock size={16} />}
      label="Next Appointment"
      value={nextAppointment ? formatDate(nextAppointment.date) : 'Not booked'}
      sub={nextAppointment?.time}
    />
    <Stat
      icon={<IndianRupee size={16} />}
      label="Outstanding"
      tone={outstanding > 0 ? 'bg-red-50 text-red-500' : undefined}
      value={
        <span className={outstanding > 0 ? 'text-red-600' : undefined}>
          {getCurrencySymbol()}{Number(outstanding || 0).toLocaleString('en-IN')}
        </span>
      }
      action={outstanding > 0 ? 'View Details' : undefined}
      onAction={onViewBilling}
    />
  </div>
);

export default PatientHeaderStats;
