import React, { useMemo } from 'react';
import DentalChartCard from './overview/DentalChartCard';
import TreatmentPlanCard from './overview/TreatmentPlanCard';
import NextAppointmentCard from './overview/NextAppointmentCard';
import FinancialSummaryCard from './overview/FinancialSummaryCard';
import PatientActivityCard from './overview/PatientActivityCard';
import QuickActionsCard from './overview/QuickActionsCard';
import ToothSummaryCard from './overview/ToothSummaryCard';
import PrescriptionsCard from './overview/PrescriptionsCard';
import DiagnosesCard from './overview/DiagnosesCard';
import { daysBetween } from '../../utils/nextVisit';
import { useIsDentalPatient } from '../../utils/casePaper';
import { clinicToday, formatDate } from '../../utils/datetime';

/**
 * The patient file's Overview: what is wrong with this person, when are they
 * back, and what do they owe — the three things that used to need three tabs.
 *
 * Composition only. Every block is its own file under `overview/`, and this
 * layer does nothing but choose the newest case paper, the soonest appointment
 * and the arrangement. Nothing here fetches, with one exception: `PatientProfile`
 * already holds everything else, so a second copy would only be a way for the
 * two to disagree, but the activity feed is a merge across six tables that it
 * holds in no usable shape. That card fetches for itself and is told when to
 * look again.
 */
const PatientOverviewTab = ({
  patient,
  casePapers = [],
  appointments = [],
  invoices = [],
  prescriptions = [],
  outstandingDue = 0,
  onOpenTab,
  onQuickAction,
  onOpenCalendar,
  onBookAppointment,
  onRecordPayment,
  onNewInvoice,
  onNewPrescription,
  onOpenPrescription,
}) => {
  // Which record THIS patient's file keeps: their own setting when they have
  // one, the clinic's otherwise. A general clinic was being shown a tooth chart
  // and a per-tooth summary on every patient, always empty, because this tab
  // never asked at all.
  const isDental = useIsDentalPatient(patient);
  // Newest first. The list arrives in whatever order the endpoint returns, and
  // "latest visit" has to mean latest.
  const latestCasePaper = useMemo(
    () => [...casePapers].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0] || null,
    [casePapers],
  );

  // The soonest booking still ahead of us, not merely the first in the array.
  const nextAppointment = useMemo(() => {
    const now = new Date();
    return [...appointments]
      // `date`, not `appointment_date`. PatientProfile renames every field as
      // it loads them, so the raw names are never present here.
      .filter((a) => a.date && new Date(a.date) >= now)
      .filter((a) => !['cancelled', 'no_show', 'no-show'].includes(String(a.status || '').toLowerCase()))
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;
  }, [appointments]);

  // The doctor's own "come back in a month", and whether that day has passed.
  // Only surfaced when nothing is booked: a real appointment is a firmer answer
  // than a recommendation.
  const recall = useMemo(() => {
    const due = latestCasePaper?.next_visit_date;
    if (!due) return null;
    const days = daysBetween(clinicToday(), due);
    if (days < 0) {
      const late = Math.abs(days);
      return { text: `Was due back ${late} day${late === 1 ? '' : 's'} ago`, overdue: true };
    }
    return { text: `Due back ${formatDate(due)}`, overdue: false };
  }, [latestCasePaper]);

  // The feed is derived from records this tab is already holding counts of, so
  // a change in any of them is the signal to refetch. Cheaper and more honest
  // than a timer, and it does not need PatientProfile to announce anything.
  const activityKey = useMemo(
    () => [casePapers, appointments, invoices, prescriptions].map((a) => a.length).join('-'),
    [casePapers, appointments, invoices, prescriptions],
  );

  return (
    // Three columns down to `xl`, two at `lg`, one on a phone. The chart needs
    // the width, the clinical column and the money column do not, and at `lg`
    // the money column drops under rather than squeezing all three.
    //
    // No `items-start` any more: the columns stretch so the feed has a row
    // height to fill. Stretching only affects these three wrappers, not the
    // cards inside them, which keep their own heights as before.
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.15fr_1fr_0.95fr] gap-4">
      <div className="space-y-4 min-w-0">
        {isDental ? (
          <>
            <DentalChartCard
              teethData={patient?.dental_chart}
              onOpen={() => onOpenTab('case-papers')}
            />
            <ToothSummaryCard
              plan={patient?.treatment_plan}
              onOpen={() => onOpenTab('case-papers')}
            />
          </>
        ) : (
          <DiagnosesCard
            casePapers={casePapers}
            onOpen={() => onOpenTab('case-papers')}
          />
        )}
      </div>

      {/* The feed is the one card here with no natural length: a patient of ten
          years has ten years of it. Left to grow it would set the height of the
          whole row and push the money column's cards, Record payment among
          them, below the fold on a long-standing patient.

          So the cell owns the height and the column inside it divides it up.
          `absolute` is what buys that: the column contributes nothing to the
          row, takes whatever the other two settle on, and shares it out.

          Prescriptions are back under the feed rather than under the chart. A
          feed running the whole height of the page on its own was a lot of one
          thing, and it is also what keeps the feed honest: it now has to end
          somewhere above the bottom of the column, so it can never be the only
          thing in view.

          The split is by shrink, not by grow. Prescriptions keep their natural
          height and the feed gives up whatever is left over, scrolling inside
          rather than pushing anything off. Nothing is stretched to fill: a
          patient with two events gets a short card, not a tall empty one.

          Only at xl, where the columns are actually side by side. Below that
          they stack, there is nothing to line up with, and both go back to
          plain cards with the feed capped on its own. */}
      <div className="min-w-0 relative">
        <div className="space-y-4 xl:space-y-0 xl:absolute xl:inset-0 xl:flex xl:flex-col xl:gap-4">
          <PatientActivityCard
            patientId={patient?.id}
            reloadKey={activityKey}
            onOpen={() => onOpenTab('visits')}
            className="min-h-0"
          />
          <PrescriptionsCard
            prescriptions={prescriptions}
            onNew={onNewPrescription}
            onOpen={onOpenPrescription}
            className="flex-none"
          />
        </div>
      </div>

      <div className="space-y-4 min-w-0 lg:col-span-2 xl:col-span-1">
        <NextAppointmentCard
          appointment={nextAppointment}
          recall={recall}
          onBook={onBookAppointment}
          onOpenCalendar={onOpenCalendar}
        />
        <FinancialSummaryCard
          invoices={invoices}
          onOpenBilling={() => onOpenTab('billing')}
          onRecordPayment={onRecordPayment}
          onNewInvoice={onNewInvoice}
        />
        <QuickActionsCard onAction={onQuickAction} />
      </div>

      {/* The plan is a table, so it takes the full width rather than being
          folded into a column where every row would truncate. */}
      <div className="min-w-0 lg:col-span-2 xl:col-span-3">
        <TreatmentPlanCard
          plan={patient?.treatment_plan}
          isDental={isDental}
          onOpen={() => onOpenTab('case-papers')}
        />
      </div>
    </div>
  );
};

export default PatientOverviewTab;
