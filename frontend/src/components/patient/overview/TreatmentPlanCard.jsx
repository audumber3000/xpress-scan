import React from 'react';
import OverviewCard, { OverviewEmpty } from './OverviewCard';
import { getCurrencySymbol } from '../../../utils/currency';

/**
 * The active treatment plan, straight off `Patient.treatment_plan`.
 *
 * Its items are `{ tooth, procedure, status, cost, qty }`, which is exactly the
 * table the reference drew, so nothing here is derived or guessed.
 *
 * The footer line is not decoration. These costs are typed into the tooth
 * drawer as estimates and have no connection to any invoice; without saying so,
 * a plan totalling more than the bills reads as money owed.
 */
const STATUS = {
  planned: { label: 'Planned', cls: 'bg-[#2a276e]/[0.08] text-[#2a276e]' },
  'in-progress': { label: 'In progress', cls: 'bg-amber-50 text-amber-700' },
  in_progress: { label: 'In progress', cls: 'bg-amber-50 text-amber-700' },
  completed: { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700' },
};

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN')}`;

const TreatmentPlanCard = ({ plan = [], onOpen, isDental = true }) => {
  const items = Array.isArray(plan) ? plan : [];
  const lineTotal = (i) => Number(i.cost || 0) * (i.qty || 1);
  const isDone = (i) => String(i.status || 'planned').toLowerCase() === 'completed';
  // Three figures, all from the plan and all about the plan. The reference put
  // Paid and Remaining here, but money paid lives on invoices — reading a
  // payment against an estimate is what made its three totals contradict.
  // A general paper plans procedures, not teeth: the column would be "General"
  // on every row, and the empty state would send the reader to a chart that is
  // not on their screen. Resolved by the Overview tab, which holds the patient.
  const estimated = items.reduce((sum, i) => sum + lineTotal(i), 0);
  const done = items.filter(isDone).reduce((sum, i) => sum + lineTotal(i), 0);
  const remaining = estimated - done;

  return (
    <OverviewCard title="Active Treatment Plan" action="View Full Treatment Plan" onOpen={onOpen}>
      {items.length === 0 ? (
        <OverviewEmpty action="Plan a treatment" onAction={onOpen}>
          {isDental
            ? 'No treatment planned yet. Pick a tooth on the chart to start one.'
            : 'No treatment planned yet. Add one from the case paper.'}
        </OverviewEmpty>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {isDental && (
                    <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Tooth</th>
                  )}
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Treatment</th>
                  <th className="px-4 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-4 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Est. cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.slice(0, 6).map((item, i) => {
                  const s = STATUS[String(item.status || 'planned').toLowerCase()] || STATUS.planned;
                  return (
                    <tr key={item.id ?? `${item.tooth}-${i}`}>
                      {isDental && (
                        <td className="px-4 py-2.5 text-xs font-bold text-gray-900 whitespace-nowrap">
                          {item.tooth || 'General'}
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-xs text-gray-700">
                        <span className="block truncate max-w-[14rem]" title={item.procedure}>{item.procedure}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs font-semibold text-gray-900 text-right tabular-nums whitespace-nowrap">
                        {money(Number(item.cost || 0) * (item.qty || 1))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* The plan's own arithmetic, in its own panel. Every figure here is
              an estimate somebody typed on a tooth; none of it is owed by
              anyone until an invoice is raised, which the footnote says out
              loud because a total this size reads as a debt otherwise. */}
          <div className="p-4 bg-gray-50/60 border-t lg:border-t-0 lg:border-l border-gray-100 flex flex-col justify-center">
            <div className="flex items-center justify-between gap-3 py-1.5">
              <span className="text-xs text-gray-600">Estimated total</span>
              <span className="text-sm font-bold text-gray-900 tabular-nums">{money(estimated)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5 border-t border-gray-200/70">
              <span className="text-xs text-gray-600">Completed</span>
              <span className="text-sm font-bold text-emerald-600 tabular-nums">{money(done)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 py-1.5 border-t border-gray-200/70">
              <span className="text-xs text-gray-600">Still to do</span>
              <span className="text-sm font-bold text-[#2a276e] tabular-nums">{money(remaining)}</span>
            </div>
            <p className="text-[11px] text-gray-400 leading-snug mt-2.5 pt-2.5 border-t border-gray-200/70">
              Estimates. Nothing here is billed until you raise an invoice.
              {items.length > 6 && <span className="block">Showing 6 of {items.length} lines.</span>}
            </p>
          </div>
        </div>
      )}
    </OverviewCard>
  );
};

export default TreatmentPlanCard;
