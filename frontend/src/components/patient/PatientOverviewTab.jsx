import React, { useMemo } from 'react';
import DentalChartCard from './overview/DentalChartCard';
import TreatmentPlanCard from './overview/TreatmentPlanCard';
import LatestVisitCard from './overview/LatestVisitCard';
import NextAppointmentCard from './overview/NextAppointmentCard';
import FinancialSummaryCard from './overview/FinancialSummaryCard';
import RecentVisitsCard from './overview/RecentVisitsCard';
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
 * and the arrangement. Nothing here fetches: `PatientProfile` already holds all
 * of it, so a second copy would only be a way for the two to disagree.
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
  onNewPayment,
  onNewPrescription,
  onOpenPrescription,
  onStartVisit,
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

  return (
    // Three columns down to `xl`, two at `lg`, one on a phone. The chart needs
    // the width, the clinical column and the money column do not, and at `lg`
    // the money column drops under rather than squeezing all three.
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.15fr_1fr_0.95fr] gap-4 items-start">
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

      <div className="space-y-4 min-w-0">
        <LatestVisitCard
          casePaper={latestCasePaper}
          isDental={isDental}
          onOpen={() => onOpenTab('case-papers')}
          onStartVisit={onStartVisit}
        />
        <RecentVisitsCard casePapers={casePapers} onOpen={() => onOpenTab('case-papers')} />
        <PrescriptionsCard
          prescriptions={prescriptions}
          onNew={onNewPrescription}
          onOpen={onOpenPrescription}
        />
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
          onNewPayment={onNewPayment}
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
