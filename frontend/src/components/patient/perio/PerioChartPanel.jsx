import React, { useMemo, useRef, useCallback, useEffect } from 'react';
import { Stethoscope } from 'lucide-react';
import BpeChart from './BpeChart';
import PerioGrid from './PerioGrid';
import { ARCHES } from './perioConstants';
import {
  normaliseChart, chartSummary, setSiteValue, toggleSiteFlag, setToothValue,
} from './perioUtils';

/**
 * Periodontal charting for this visit.
 *
 * It saves onto the case paper next to the dental chart, tooth notes and the
 * treatment plan, because a perio chart is dated by its nature — the number
 * that matters is not "6mm" but "6mm, and it was 4mm in March". Storing it per
 * visit gives that comparison for free later, with no second place for the
 * truth to live.
 */
const ModeTab = ({ active, onClick, title, subtitle }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex-1 min-w-[180px] text-left px-4 py-3 rounded-xl border cursor-pointer transition-[background-color,border-color] duration-150 ease-out ${
      active
        ? 'bg-[#2a276e]/[0.04] border-[#2a276e]/30'
        : 'bg-white border-gray-200 hover:border-gray-300'
    }`}
  >
    <span className={`block text-sm font-bold ${active ? 'text-[#2a276e]' : 'text-gray-900'}`}>{title}</span>
    <span className="block mt-0.5 text-[11px] leading-snug text-gray-500">{subtitle}</span>
  </button>
);

const Stat = ({ label, value, tone = 'text-gray-900' }) => (
  <div className="px-3.5 py-2">
    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
    <p className={`mt-0.5 text-base font-black ${tone}`}>{value ?? '—'}</p>
  </div>
);

const PerioChartPanel = ({ chart: rawChart, onChange, teethData = {} }) => {
  const chart = useMemo(() => normaliseChart(rawChart), [rawChart]);

  /* The grid's callbacks must keep the same identity across renders or the
     per-tooth memo is worthless, so they read the current chart from a ref
     rather than closing over it. */
  const chartRef = useRef(chart);
  useEffect(() => { chartRef.current = chart; }, [chart]);

  const setMode = (mode) => onChange({ ...chartRef.current, mode });

  const onSetSite = useCallback((tooth, kind, site, value) => {
    onChange(setSiteValue(chartRef.current, tooth, kind, site, value));
  }, [onChange]);

  const onToggleFlag = useCallback((tooth, kind, site) => {
    onChange(toggleSiteFlag(chartRef.current, tooth, kind, site));
  }, [onChange]);

  const onSetTooth = useCallback((tooth, key, value) => {
    onChange(setToothValue(chartRef.current, tooth, key, value));
  }, [onChange]);

  const summary = useMemo(() => chartSummary(chart), [chart]);
  const isFull = chart.mode === 'full';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-[#2a276e]/5 text-[#2a276e] flex items-center justify-center">
          <Stethoscope size={18} />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Periodontal Chart</h3>
          <p className="text-xs text-gray-500 mt-0.5">Saved with this visit, so you can compare it against the last one.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <ModeTab
          active={!isFull}
          onClick={() => setMode('bpe')}
          title="Screening (BPE)"
          subtitle="Six sextant scores. About thirty seconds, and enough for a routine recall."
        />
        <ModeTab
          active={isFull}
          onClick={() => setMode('full')}
          title="Full chart"
          subtitle="Six sites a tooth, with recession, bleeding, mobility and furcation."
        />
      </div>

      {isFull ? (
        <>
          {/* The numbers a clinician would otherwise be working out on paper
              while the patient waits. */}
          <div className="flex flex-wrap items-center divide-x divide-gray-200 border border-gray-200 rounded-xl bg-white">
            <Stat label="Bleeding" value={summary.bopPercent === null ? null : `${summary.bopPercent}%`}
                  tone={summary.bopPercent >= 30 ? 'text-red-600' : 'text-gray-900'} />
            <Stat label="Plaque" value={summary.plaquePercent === null ? null : `${summary.plaquePercent}%`}
                  tone={summary.plaquePercent >= 30 ? 'text-amber-600' : 'text-gray-900'} />
            <Stat label="Sites 4mm+" value={summary.sitesDeep || (summary.recorded ? 0 : null)}
                  tone={summary.sitesDeep ? 'text-amber-600' : 'text-gray-900'} />
            <Stat label="Sites 6mm+" value={summary.sitesSevere || (summary.recorded ? 0 : null)}
                  tone={summary.sitesSevere ? 'text-red-600' : 'text-gray-900'} />
            <Stat label="Mean depth" value={summary.meanDepth === null ? null : `${summary.meanDepth}mm`} />
            <Stat label="Teeth charted" value={summary.recorded ? summary.teethCharted : null} />
          </div>

          <div className="space-y-4">
            {ARCHES.map((arch) => (
              <PerioGrid
                key={arch.id}
                arch={arch}
                chart={chart}
                teethData={teethData}
                onSetSite={onSetSite}
                onToggleFlag={onToggleFlag}
                onSetTooth={onSetTooth}
              />
            ))}
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Type digits only — each one fills the cell and moves to the next. A
            <kbd className="mx-1 px-1 py-0.5 rounded bg-gray-100 font-sans font-semibold text-gray-500">1</kbd>
            waits a beat so 10 to 15 stay typable. Attachment loss is worked out from
            depth plus recession, so there is nothing to enter for it. Teeth marked
            extracted on the dental chart are greyed out and skipped.
          </p>
        </>
      ) : (
        <BpeChart chart={chart} onChange={onChange} onOpenFull={() => setMode('full')} />
      )}

      <div>
        <label htmlFor="perio-notes" className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
          Periodontal notes
        </label>
        <textarea
          id="perio-notes"
          value={chart.notes || ''}
          onChange={(e) => onChange({ ...chartRef.current, notes: e.target.value })}
          rows={2}
          placeholder="Recession pattern, smoking, diabetes, response to the last course of treatment..."
          className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:border-[#2a276e] focus:bg-white focus:ring-2 focus:ring-[#2a276e]/15"
        />
      </div>
    </div>
  );
};

export default PerioChartPanel;
