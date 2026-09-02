import React, { useMemo } from 'react';
import { Stethoscope } from 'lucide-react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import { formatDate } from '../../../utils/datetime';
import { asText } from './clinicalText';

/**
 * What this patient has been diagnosed with, most recent first.
 *
 * The general-paper counterpart to the tooth summary. A dental file answers
 * "what is going on with this patient" through the chart and the per-tooth
 * plan; a clinic that keeps the general paper has neither, and without this the
 * Overview would say nothing clinical at all beyond the last visit.
 *
 * Deliberately not a derm-specific card. `case_paper_type` is general vs
 * dental, not dermatology vs dental, so a body-site map would be as wrong for
 * an ENT or cardiology clinic as the tooth chart is for them today. Diagnosis is
 * a field every one of them fills in.
 */
const DiagnosesCard = ({ casePapers = [], onOpen }) => {
  const items = useMemo(() => (
    (casePapers || [])
      .map((cp) => ({ id: cp.id, date: cp.date, text: asText(cp.diagnosis) }))
      .filter((d) => d.text)
      .slice(0, 5)
  ), [casePapers]);

  if (!items.length) {
    return (
      <OverviewCard title="Diagnoses" onOpen={onOpen}>
        <OverviewEmpty>No diagnosis recorded for this patient yet.</OverviewEmpty>
      </OverviewCard>
    );
  }

  return (
    <OverviewCard title="Diagnoses" onOpen={onOpen}>
      <ul className="divide-y divide-gray-100">
        {items.map((d) => (
          <li key={d.id} className="px-4 py-2.5 flex items-start gap-2.5 min-w-0">
            <span className="mt-0.5 text-[#2a276e] flex-shrink-0"><Stethoscope size={13} /></span>
            <div className="min-w-0">
              <p className="text-xs text-gray-800 leading-snug break-words">{d.text}</p>
              {d.date && <p className="text-[11px] text-gray-400 mt-0.5">{formatDate(d.date)}</p>}
            </div>
          </li>
        ))}
      </ul>
    </OverviewCard>
  );
};

export default DiagnosesCard;
