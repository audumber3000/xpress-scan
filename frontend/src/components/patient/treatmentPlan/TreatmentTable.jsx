import React, { useMemo } from 'react';
import { Pencil, Trash2, Minus, Plus, Check } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';
import {
  STATUS_META, STATUS_ORDER, statusOf, toothLabel, isCombined,
  qtyOf, unitPrice, itemTotal, planTotal, sortedForTable, formatDate, surfacesLabel,
} from './planUtils';

/**
 * The plan as a list you can read in one pass.
 *
 * The board answers "where is this work up to". This answers "what did we agree
 * to, and what does it come to" — the question asked when a patient is sitting
 * across the desk, and the one the board is worst at, because reading eight
 * cards spread over three columns and adding them up in your head is not
 * reading. It also lets a doctor mark four procedures complete without dragging
 * four cards, which is the single most repeated action here.
 *
 * Status changes route through the same onUpdatePlan as the board, so the
 * auto-billing sync in CasePapersTab fires identically from either view.
 */
const CELL = 'px-4 py-3 align-middle';

/**
 * Mark it done.
 *
 * Marking work complete is the most repeated action on this screen, and going
 * through a dropdown to do it is three interactions for a yes. A tick is one.
 * The dropdown stays for the three-way move, since "in progress" has no
 * checkbox shape.
 *
 * Ticking is not cosmetic: completing a procedure bills it to the visit's draft
 * invoice through the same sync the board uses. Untick puts it back to planned
 * and pulls the line again.
 */
const DoneBox = ({ done, label, onChange }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={done}
    aria-label={`Mark ${label} complete`}
    title={done ? 'Completed — click to reopen' : 'Mark complete'}
    onClick={() => onChange(!done)}
    className="p-1 -m-1 rounded-lg cursor-pointer transition-transform duration-150 ease-out active:scale-[0.9] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
  >
    <span
      className={`w-5 h-5 flex items-center justify-center rounded-md border transition-[background-color,border-color] duration-150 ease-out ${
        done
          ? 'bg-emerald-500 border-emerald-500'
          : 'bg-white border-gray-300 hover:border-emerald-400'
      }`}
    >
      {done && <Check size={13} strokeWidth={3.5} className="text-white" />}
    </span>
  </button>
);

const TreatmentTable = ({
  treatmentPlan = [],
  currentUserName,
  onUpdatePlan,
  onEditStart,
  onDelete,
}) => {
  const rows = useMemo(() => sortedForTable(treatmentPlan), [treatmentPlan]);
  const doneCount = useMemo(
    () => treatmentPlan.filter((i) => statusOf(i) === 'completed').length,
    [treatmentPlan]
  );
  const total = useMemo(() => planTotal(treatmentPlan), [treatmentPlan]);
  const symbol = getCurrencySymbol();

  const patch = (item, changes) =>
    onUpdatePlan(treatmentPlan.map((p) => (p.id === item.id ? { ...p, ...changes } : p)));

  if (rows.length === 0) {
    return (
      <div className="py-16 text-center bg-white border border-gray-200 rounded-xl animate-view-fade-in">
        <p className="text-sm font-semibold text-gray-500">No procedures planned yet</p>
        <p className="mt-1 text-xs text-gray-400">Pick a tooth on the chart above to add one.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden animate-view-fade-in">
      {/* The table scrolls inside its own box so the case paper never scrolls
          sideways underneath it. */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full min-w-[940px] text-sm">
          <thead className="bg-[#f8fafc] border-b border-gray-200">
            <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              <th className={`${CELL} w-[52px]`}><span className="sr-only">Done</span></th>
              <th className={CELL}>Tooth</th>
              <th className={CELL}>Procedure</th>
              <th className={CELL}>Diagnosis</th>
              <th className={`${CELL} w-[150px]`}>Status</th>
              <th className={`${CELL} w-[120px]`}>Qty</th>
              <th className={`${CELL} text-right w-[110px]`}>Fee</th>
              <th className={`${CELL} text-right w-[120px]`}>Total</th>
              <th className={`${CELL} w-[90px]`}><span className="sr-only">Actions</span></th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {rows.map((item) => {
              const status = statusOf(item);
              const meta = STATUS_META[status];
              const price = unitPrice(item);
              const teeth = toothLabel(item);

              const done = status === 'completed';

              return (
                <tr
                  key={item.id}
                  className={`transition-colors duration-150 hover:bg-gray-50/70 ${done ? 'bg-emerald-50/30' : ''}`}
                >
                  <td className={CELL}>
                    <DoneBox
                      done={done}
                      label={item.procedure || 'this procedure'}
                      onChange={(next) => patch(item, { status: next ? 'completed' : 'planned' })}
                    />
                  </td>

                  <td className={CELL}>
                    {teeth ? (
                      <span className={`inline-block font-bold text-gray-900 ${isCombined(item) ? 'text-xs leading-snug' : 'text-sm'}`}>
                        {teeth}
                      </span>
                    ) : (
                      <span className="text-xs font-bold tracking-wider text-gray-400">GENERAL</span>
                    )}
                  </td>

                  <td className={CELL}>
                    <p className={`font-semibold ${done ? 'text-gray-500' : 'text-gray-900'}`}>
                      {item.procedure || <span className="text-gray-400 font-normal italic">Untitled procedure</span>}
                      {surfacesLabel(item) && (
                        <span className="ml-1.5 text-xs font-bold text-gray-400">{surfacesLabel(item)}</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {formatDate(item.date || item.appointment_date)}
                      {' · '}
                      {item.doctor || currentUserName || 'Treating doctor'}
                    </p>
                  </td>

                  <td className={`${CELL} text-gray-600`}>
                    {item.diagnosis || <span className="text-gray-400 italic">Not recorded</span>}
                  </td>

                  <td className={CELL}>
                    {/* Changing status here does everything the board's buttons
                        do, auto-billing included. */}
                    <select
                      value={status}
                      onChange={(e) => patch(item, { status: e.target.value })}
                      aria-label={`Status for ${item.procedure || 'this procedure'}`}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer outline-none transition-[border-color,box-shadow] duration-150 ease-out focus:ring-2 focus:ring-[#2a276e]/15 ${meta.chip}`}
                    >
                      {STATUS_ORDER.map((s) => (
                        <option key={s} value={s}>{STATUS_META[s].label}</option>
                      ))}
                    </select>
                  </td>

                  <td className={CELL}>
                    <div className="flex items-center gap-1 w-max p-0.5 bg-white border border-gray-200 rounded-lg">
                      <button
                        type="button" aria-label="Decrease quantity"
                        onClick={() => patch(item, { qty: Math.max(1, qtyOf(item) - 1) })}
                        className="h-6 w-6 flex items-center justify-center rounded text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-900 active:scale-[0.9]"
                      >
                        <Minus size={12} strokeWidth={3} />
                      </button>
                      <span className="w-6 text-center text-sm font-bold text-gray-900">{qtyOf(item)}</span>
                      <button
                        type="button" aria-label="Increase quantity"
                        onClick={() => patch(item, { qty: qtyOf(item) + 1 })}
                        className="h-6 w-6 flex items-center justify-center rounded text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:bg-gray-100 hover:text-gray-900 active:scale-[0.9]"
                      >
                        <Plus size={12} strokeWidth={3} />
                      </button>
                    </div>
                  </td>

                  <td className={`${CELL} text-right font-medium text-gray-600`}>
                    {price === null
                      ? <span className="text-gray-400 italic font-normal">Not set</span>
                      : `${symbol}${price.toLocaleString('en-IN')}`}
                  </td>

                  <td className={`${CELL} text-right font-bold text-gray-900`}>
                    {price === null ? '—' : `${symbol}${itemTotal(item).toLocaleString('en-IN')}`}
                  </td>

                  <td className={CELL}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button" onClick={() => onEditStart(item)}
                        title="Edit procedure" aria-label="Edit procedure"
                        className="p-1.5 rounded-lg text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:text-[#2a276e] hover:bg-gray-100 active:scale-[0.97]"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button" onClick={() => onDelete(item)}
                        title="Remove from plan" aria-label="Remove from plan"
                        className="p-1.5 rounded-lg text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:text-red-600 hover:bg-red-50 active:scale-[0.97]"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          <tfoot className="bg-[#f8fafc] border-t border-gray-200">
            <tr>
              <td className={`${CELL} text-xs font-semibold uppercase tracking-wider text-gray-500`} colSpan={7}>
                {rows.length} procedure{rows.length === 1 ? '' : 's'}
                {doneCount > 0 && (
                  <span className="ml-2 normal-case tracking-normal text-emerald-600">
                    · {doneCount} completed
                  </span>
                )}
              </td>
              <td className={`${CELL} text-right text-base font-black text-gray-900`}>
                {symbol}{total.toLocaleString('en-IN')}
              </td>
              <td className={CELL} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default TreatmentTable;
