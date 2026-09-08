import React from 'react';
import { SEXTANTS, BPE_CODES, BPE_GUIDANCE, FURCATION_STAR } from './perioConstants';
import { setBpe, worstBpeCode, anyFurcationStar } from './perioUtils';

/**
 * BPE: six scores, thirty seconds, and it is what most practices actually
 * record at a recall.
 *
 * This is the default view on purpose. A full six-point chart takes ten to
 * fifteen minutes, which is why a lot of software has a beautiful one that
 * nobody fills in. Screening first, and the full chart is one tap away for the
 * cases that earn it.
 */
const CodeButton = ({ code, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    title={code.detail}
    className={`h-9 min-w-9 px-2 rounded-lg border text-sm font-bold cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.94] ${
      active ? `${code.tone} ring-2 ring-offset-1 ring-[#2a276e]/30` : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700'
    }`}
  >
    {code.code}
  </button>
);

const SextantCell = ({ sextant, value, onChange }) => {
  const base = String(value || '').replace(FURCATION_STAR, '');
  const starred = String(value || '').includes(FURCATION_STAR);
  const meta = BPE_CODES.find((c) => c.code === base);

  const pick = (code) => {
    if (base === code) return onChange(null);            // tap the same score to clear it
    onChange(starred && code !== 'X' ? code + FURCATION_STAR : code);
  };

  const toggleStar = () => {
    if (!base || base === 'X') return;
    onChange(starred ? base : base + FURCATION_STAR);
  };

  return (
    <div className="flex-1 min-w-[172px] p-3 rounded-xl border border-gray-200 bg-white">
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-xs font-bold text-gray-900">{sextant.label}</span>
        <span className="text-[11px] font-medium text-gray-400">{sextant.range}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {BPE_CODES.map((c) => (
          <CodeButton key={c.code} code={c} active={base === c.code} onClick={() => pick(c.code)} />
        ))}
        <button
          type="button"
          onClick={toggleStar}
          disabled={!base || base === 'X'}
          aria-pressed={starred}
          title="Furcation involvement, or recession with a pocket of 7mm or more"
          className={`h-9 min-w-9 px-2 rounded-lg border text-sm font-black cursor-pointer transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.94] disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
            starred ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          *
        </button>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-gray-500 min-h-[28px]">
        {meta ? meta.detail : <span className="text-gray-300">Not scored yet</span>}
      </p>
    </div>
  );
};

const BpeChart = ({ chart, onChange, onOpenFull }) => {
  const worst = worstBpeCode(chart);
  const starred = anyFurcationStar(chart);
  const scored = SEXTANTS.filter((s) => chart.bpe?.[s.id]).length;
  const needsFullChart = worst === '4' || worst === '3' || starred;

  return (
    <div className="space-y-5">
      {['upper', 'lower'].map((arch) => (
        <div key={arch}>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
            {arch === 'upper' ? 'Upper' : 'Lower'}
          </p>
          <div className="flex flex-wrap gap-3">
            {SEXTANTS.filter((s) => s.arch === arch).map((s) => (
              <SextantCell
                key={s.id}
                sextant={s}
                value={chart.bpe?.[s.id]}
                onChange={(code) => onChange(setBpe(chart, s.id, code))}
              />
            ))}
          </div>
        </div>
      ))}

      {/* What the worst score means. The point of a screening score is the
          decision that follows it, so the decision is on screen rather than in
          the clinician's memory of a table. */}
      {worst && (
        <div className={`flex flex-wrap items-start gap-x-4 gap-y-3 p-4 rounded-xl border ${
          needsFullChart ? 'bg-amber-50/60 border-amber-200' : 'bg-emerald-50/60 border-emerald-200'
        }`}>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gray-900">
              Worst score: {worst}{starred ? '*' : ''} · {scored} of 6 sextants recorded
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-gray-700">
              {BPE_GUIDANCE[worst]}
              {starred && ' A starred sextant means furcation involvement, which needs charting in full whatever the score.'}
            </p>
          </div>
          {needsFullChart && (
            <button
              type="button"
              onClick={onOpenFull}
              className="shrink-0 inline-flex items-center h-9 px-3.5 rounded-lg bg-[#2a276e] text-white text-[13px] font-semibold cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:bg-[#1a1548] active:scale-[0.97]"
            >
              Chart in full
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BpeChart;
