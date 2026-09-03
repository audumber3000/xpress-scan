import React from 'react';
import { X, ArrowRight } from 'lucide-react';
import { getCurrencySymbol } from '../../../utils/currency';
import { formatDate } from '../../../utils/datetime';

const money = (n) => `${getCurrencySymbol()}${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Which bill is this money for?
 *
 * Record payment used to answer that on the user's behalf: it opened whichever
 * invoice was oldest and still owing. With one outstanding bill that guess is
 * always right and the question is not worth asking. With three it is a coin
 * toss, and getting it wrong puts a patient's cash against the wrong invoice —
 * which then needs a master password to undo.
 *
 * So the rule is: ask only when there is genuinely something to ask. One
 * outstanding bill goes straight through.
 *
 * Ordered oldest first, because that is the one a clinic chasing money means.
 */
const PickInvoiceModal = ({ invoices = [], onPick, onClose }) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
    <div className="bg-white rounded-xl border border-gray-200 w-full max-w-md max-h-[85vh] flex flex-col">
      <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-gray-900">Which invoice is this for?</h2>
          <p className="text-[12px] text-gray-500 mt-0.5">
            {invoices.length} bills still have a balance.
          </p>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1.5 hover:bg-gray-100 rounded-full">
          <X size={18} className="text-gray-500" />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {invoices.map((inv) => (
          <li key={inv.id}>
            <button
              type="button"
              onClick={() => onPick(inv)}
              className="w-full text-left px-5 py-3 flex items-center gap-3 hover:bg-indigo-50/40 transition min-w-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-gray-900 truncate">
                  {inv.invoice_number || `Invoice #${inv.id}`}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {formatDate(inv.finalized_at || inv.created_at)}
                  {Number(inv.paid_amount || 0) > 0
                    ? ` · ${money(inv.paid_amount)} already paid`
                    : ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[14px] font-bold text-amber-700 tabular-nums">{money(inv.due_amount)}</p>
                <p className="text-[11px] text-gray-500">due</p>
              </div>
              <ArrowRight size={14} className="text-gray-400 shrink-0" />
            </button>
          </li>
        ))}
      </ul>

      <div className="px-5 py-3 border-t border-gray-200 bg-gray-50">
        <button
          onClick={onClose}
          className="w-full px-3.5 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 text-[13px] font-semibold hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
);

export default PickInvoiceModal;
