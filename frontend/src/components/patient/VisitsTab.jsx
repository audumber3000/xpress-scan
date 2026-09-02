import React, { useMemo, useState } from 'react';
import EmptyState from '../common/EmptyState';
import { noData } from '../../assets/illustrations';
import FileFilterBar from './files/FileFilterBar';
import NextAppointmentCard from './overview/NextAppointmentCard';
import VisitSummaryCard from './visits/VisitSummaryCard';
import VisitRow from './visits/VisitRow';

/**
 * Every visit this patient has had, as a timeline.
 *
 * Two thirds list, one third context. The list is what you came for; the
 * summary and the next booking are what you check on the way past, and neither
 * deserves half the screen.
 *
 * Built from case papers, which is where a visit is actually recorded. The
 * linked appointment supplies the two things a case paper has no column for —
 * what the visit was booked as, and how long it ran — and both are simply
 * absent on a walk-in that never had one.
 */
const SORTS = [
  { value: 'newest', label: 'Sort: Newest first' },
  { value: 'oldest', label: 'Sort: Oldest first' },
];

const VisitsTab = ({
  casePapers = [],
  appointments = [],
  nextAppointment,
  onOpenVisit,
  onBookAppointment,
  onOpenCalendar,
}) => {
  const [query, setQuery] = useState('');
  const [doctor, setDoctor] = useState('all');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('newest');

  // A case paper carries no title, type or duration. Where it links to an
  // appointment, that appointment has both — so the pair is joined here rather
  // than leaving two columns permanently blank.
  const visits = useMemo(() => {
    const byId = new Map(appointments.map((a) => [a.id, a]));
    return casePapers.map((cp) => {
      const appt = cp.appointment_id ? byId.get(cp.appointment_id) : null;
      const complaint = Array.isArray(cp.chief_complaint)
        ? cp.chief_complaint.filter(Boolean).join(', ')
        : cp.chief_complaint;
      return {
        id: cp.id,
        date: cp.date || cp.created_at,
        title: appt?.procedure || complaint || 'Visit',
        type: appt?.procedure || null,
        doctor: cp.dentist_name || null,
        duration: appt?.duration || null,
        status: cp.status || 'In Progress',
        note: cp.next_visit_recommendation
          ? `Next step: ${cp.next_visit_recommendation}`
          : (cp.diagnosis ? `Diagnosis: ${cp.diagnosis}` : ''),
      };
    });
  }, [casePapers, appointments]);

  const doctors = useMemo(
    () => [...new Set(visits.map((v) => v.doctor).filter(Boolean))].sort(),
    [visits],
  );
  const types = useMemo(
    () => [...new Set(visits.map((v) => v.type).filter(Boolean))].sort(),
    [visits],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = visits.filter((v) => {
      if (doctor !== 'all' && v.doctor !== doctor) return false;
      if (type !== 'all' && v.type !== type) return false;
      if (!q) return true;
      return [v.title, v.note, v.doctor].filter(Boolean)
        .some((f) => String(f).toLowerCase().includes(q));
    });
    return out.sort((a, b) => (sort === 'oldest'
      ? new Date(a.date || 0) - new Date(b.date || 0)
      : new Date(b.date || 0) - new Date(a.date || 0)));
  }, [visits, query, doctor, type, sort]);

  // Only offered when there is something to choose between. A "All Doctors"
  // select on a single-dentist clinic is a control that can never do anything.
  const filters = [];
  if (types.length > 1) {
    filters.push({
      key: 'type', label: 'Type', value: type, onChange: setType,
      options: [{ value: 'all', label: 'All types' }, ...types.map((t) => ({ value: t, label: t }))],
    });
  }
  if (doctors.length > 1) {
    filters.push({
      key: 'doctor', label: 'Doctor', value: doctor, onChange: setDoctor,
      options: [{ value: 'all', label: 'All doctors' }, ...doctors.map((d) => ({ value: d, label: d }))],
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <div className="lg:col-span-2 min-w-0">
        <FileFilterBar
          query={query}
          onQuery={setQuery}
          placeholder="Search visits…"
          filters={filters}
          sort={sort}
          onSort={setSort}
          sortOptions={SORTS}
        />

        <div className="bg-white border border-gray-200 rounded-xl">
          {visible.length === 0 ? (
            <div className="px-4 py-10">
              <EmptyState
                image={noData}
                title={visits.length === 0 ? 'No visits recorded yet' : 'Nothing matches that'}
                subtitle={visits.length === 0
                  ? 'Every case paper you start shows up here as a visit.'
                  : 'Try a different filter or clear the search.'}
              />
            </div>
          ) : (
            visible.map((visit, i) => (
              <VisitRow
                key={visit.id}
                visit={visit}
                latest={i === 0 && sort === 'newest'}
                onOpen={() => onOpenVisit?.(visit)}
              />
            ))
          )}
        </div>
      </div>

      <div className="space-y-4 min-w-0">
        <NextAppointmentCard
          appointment={nextAppointment}
          onBook={onBookAppointment}
          onOpenCalendar={onOpenCalendar}
        />
        <VisitSummaryCard visits={visits} appointments={appointments} />
      </div>
    </div>
  );
};

export default VisitsTab;
