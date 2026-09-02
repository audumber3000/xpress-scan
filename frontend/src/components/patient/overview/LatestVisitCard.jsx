import React from 'react';
import { Stethoscope, ClipboardList, ArrowRightCircle } from 'lucide-react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import { formatDate, clinicDateKey, clinicToday } from '../../../utils/datetime';
import { asText } from './clinicalText';
import { useCasePaperLabels } from '../../../utils/casePaper';

/**
 * The most recent case paper, in three lines.
 *
 * Titled "Today's visit" only when the newest paper is actually dated today.
 * The reference this came from assumed a visit was always in progress, which is
 * true on the day and wrong the other 95% of the time; a card headed "Today's
 * Visit" showing work from three weeks ago is worse than no card.
 *
 * Deliberately not shown: "Treatment Done" and "Duration". Neither exists on a
 * case paper — duration lives on the appointment, and a case paper often has no
 * appointment behind it — so both would have been blank far more often than not.
 */
const Row = ({ icon, label, value }) => (
  <div className="flex items-start gap-2.5 px-4 py-2.5 border-b border-gray-50 last:border-0">
    <span className="mt-0.5 text-[#2a276e] flex-shrink-0">{icon}</span>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold text-gray-500">{label}</p>
      <p className="text-xs text-gray-800 leading-snug break-words">{value}</p>
    </div>
  </div>
);

const LatestVisitCard = ({ casePaper, onOpen, onStartVisit }) => {
  // "No dentist recorded" is wrong wording in a clinic that does not employ one.
  const { clinicianLabel } = useCasePaperLabels();
  if (!casePaper) {
    return (
      <OverviewCard title="Visits" action="Start New Visit" onOpen={onStartVisit || onOpen}>
        <OverviewEmpty action="Start a case paper" onAction={onStartVisit || onOpen}>
          No visit recorded for this patient yet.
        </OverviewEmpty>
      </OverviewCard>
    );
  }

  const day = casePaper.date ? clinicDateKey(casePaper.date) : null;
  const isToday = day && day === clinicToday();
  const complaint = asText(casePaper.chief_complaint);
  const diagnosis = asText(casePaper.diagnosis);
  const nextStep = asText(casePaper.next_visit_recommendation);

  return (
    <OverviewCard
      title={isToday ? "Today's visit" : `Last visit · ${formatDate(casePaper.date)}`}
      action="Start New Visit"
      onOpen={onStartVisit || onOpen}
    >
      {complaint && <Row icon={<Stethoscope size={14} />} label="Chief complaint" value={complaint} />}
      {diagnosis && <Row icon={<ClipboardList size={14} />} label="Diagnosis" value={diagnosis} />}
      {nextStep && <Row icon={<ArrowRightCircle size={14} />} label="Next step" value={nextStep} />}

      {!complaint && !diagnosis && !nextStep && (
        <OverviewEmpty>This case paper has no clinical notes on it yet.</OverviewEmpty>
      )}

      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-gray-50/60 border-t border-gray-100">
        <span className="text-[11px] text-gray-500 truncate" title={casePaper.dentist_name || undefined}>
          {casePaper.dentist_name || `No ${clinicianLabel.replace(/^Treating /, '').toLowerCase()} recorded`}
        </span>
        {casePaper.status && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded flex-shrink-0 ${
            casePaper.status === 'Completed'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-700'
          }`}>
            {casePaper.status}
          </span>
        )}
      </div>
    </OverviewCard>
  );
};

export default LatestVisitCard;
