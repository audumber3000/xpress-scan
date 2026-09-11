import React, { useState } from 'react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import RealisticDentalChart from '../RealisticDentalChart';

/**
 * The chart as a signal, not a document.
 *
 * Read-only (`editable={false}`) and reusing the same component the Dental Chart
 * tab draws, so there is one chart in the app rather than a summary version that
 * slowly stops matching. At this width a tooth is about 13px: enough to see that
 * something is wrong at 46, not enough to work from. The link out is the point.
 */
const DentalChartCard = ({ teethData, onOpen }) => {
  // Adult vs child is the doctor's call, not something to infer from an age
  // that is often missing or wrong on an imported row.
  const [dentition, setDentition] = useState('adult');
  // Anything recorded on a tooth, not just a change to how it is drawn. This
  // used to count only a non-"present" status, so a patient with pulpitis on
  // 46, or caries on three surfaces, was told "Nothing marked on this chart yet"
  // — an empty-state that was simply false.
  const marked = Object.entries(teethData || {}).filter(([, t]) => {
    if (!t || typeof t !== 'object') return false;
    if (t.status && t.status !== 'present') return true;
    if (t.condition && t.condition !== 'sound') return true;
    if (t.work) return true;
    if (Array.isArray(t.conditions) && t.conditions.length) return true;
    if (Array.isArray(t.findings) && t.findings.length) return true;
    if (Array.isArray(t.marks) && t.marks.length) return true;
    return Object.values(t.surfaces || {}).some((v) => v && v !== 'none');
  });

  return (
    <OverviewCard
      title="Dental Chart"
      action="Open chart"
      onOpen={onOpen}
      headerExtra={
        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
          {['adult', 'primary'].map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setDentition(mode)}
              className={`px-3 py-1 text-[11px] font-semibold transition-colors cursor-pointer ${
                dentition === mode ? 'bg-[#2a276e] text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {mode === 'adult' ? 'Adult' : 'Child'}
            </button>
          ))}
        </div>
      }
    >
      {marked.length === 0 ? (
        <OverviewEmpty action="Open the chart" onAction={onOpen}>
          Nothing marked on this chart yet.
        </OverviewEmpty>
      ) : (
        <>
          <div className="p-3 overflow-x-auto">
            <RealisticDentalChart teethData={teethData || {}} editable={false} dentition={dentition} showLegend={false} />
          </div>
          <p className="px-4 py-2.5 text-[11px] text-gray-500 bg-gray-50/60 border-t border-gray-100">
            {marked.length} {marked.length === 1 ? 'tooth' : 'teeth'} marked.
            Open the chart to see or change any of them.
          </p>
        </>
      )}
    </OverviewCard>
  );
};

export default DentalChartCard;
