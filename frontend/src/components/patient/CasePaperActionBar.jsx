import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Save, ClipboardList, Receipt, CalendarClock, ChevronDown, FileText } from 'lucide-react';
import { nextVisitSummary, NOT_SPECIFIED } from '../../utils/nextVisit';

/**
 * The case paper's action bar, docked to the bottom of the work area.
 *
 * It began as a floating pill pinned to the bottom-right corner, which sat on
 * top of whatever was underneath it — the last invoice row, the right-hand end
 * of the perio grid — with no way to see what it covered. Being `fixed` to the
 * window it also knew nothing about the sidebar, so its anchor drifted as the
 * sidebar collapsed.
 *
 * `position: sticky` was the obvious fix and the wrong one. It works only while
 * every one of the five ancestors between this bar and the window keeps exactly
 * the right overflow and height, and one of them changing quietly stops it
 * pinning with no error anywhere.
 *
 * So it is not positioned at all. It renders through a portal into a slot that
 * sits AFTER the scroll area in the page's flex column, which makes it the
 * literal last row of the page: flush to the bottom by construction, never over
 * content, and inside the same column the sidebar sits beside, so it follows
 * the sidebar for free.
 */

/**
 * A count sitting on the corner of an action, same treatment as the header
 * bell. It answers "is there already something behind this button?" without
 * the doctor having to open it and find out.
 */
const CountBadge = ({ count }) => {
  if (!count) return null;
  return (
    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center border-2 border-white">
      {count > 99 ? '99+' : count}
    </span>
  );
};

const ACTION =
  'relative inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold whitespace-nowrap ' +
  'cursor-pointer transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2';

const CasePaperActionBar = ({
  form,
  onSave,
  onPrescription,
  onInvoice,
  onNextVisit,
  onClinicalSummary,
  prescriptionCount = 0,
  invoiceCount = 0,
  hasExistingInvoice = false
}) => {
  const label = form.next_visit_recommendation || NOT_SPECIFIED;
  const isSet = label !== NOT_SPECIFIED;

  /* The slot is rendered by the patient page. Resolved after mount because the
     node does not exist during this component's first render. */
  const [dock, setDock] = useState(null);
  useEffect(() => { setDock(document.getElementById('case-paper-dock')); }, []);

  const bar = (
    <div
      /* Spans the full work area; the row inside lines its contents up with
         the same centred column the case paper above it uses. */
      className="w-full bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 md:px-6 py-3">
        {/* Next visit is a decision, not a dropdown pick, so it opens properly. */}
        <button
          type="button"
          onClick={onNextVisit}
          className="inline-flex items-center gap-2.5 h-10 px-3 -ml-1 rounded-lg text-left cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e]"
        >
          <CalendarClock size={18} className={isSet ? 'text-[#2a276e]' : 'text-gray-400'} />
          <span className="min-w-0">
            <span className="block text-[11px] font-medium text-gray-500 leading-none mb-1">Next visit</span>
            <span className={`block text-sm font-semibold leading-none truncate ${isSet ? 'text-[#2a276e]' : 'text-gray-400'}`}>
              {nextVisitSummary(label, form.next_visit_date)}
            </span>
          </span>
          <ChevronDown size={14} className="text-gray-400 shrink-0" />
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onSave}
            className={`${ACTION} bg-gray-50 text-gray-600 hover:bg-gray-100 focus-visible:outline-gray-400`}
          >
            <Save size={17} />
            <span>Save records</span>
          </button>

          {/* The whole visit as one document. Sits next to Save because it is
              what you reach for when the visit is finished. */}
          <button
            type="button"
            onClick={onClinicalSummary}
            className={`${ACTION} bg-gray-50 text-gray-600 hover:bg-gray-100 focus-visible:outline-gray-400`}
          >
            <FileText size={17} />
            <span>Summary</span>
          </button>

          <button
            type="button"
            onClick={onPrescription}
            className={`${ACTION} bg-[#2a276e] text-white hover:bg-[#1a1548] focus-visible:outline-[#2a276e]`}
          >
            <ClipboardList size={17} />
            <span>Prescription</span>
            <CountBadge count={prescriptionCount} />
          </button>

          <button
            type="button"
            onClick={onInvoice}
            className={`${ACTION} ${
              hasExistingInvoice
                ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 focus-visible:outline-blue-500'
                : 'bg-[#00ba7c] text-white hover:bg-[#009e6a] focus-visible:outline-[#00ba7c]'
            }`}
          >
            <Receipt size={17} />
            <span>{hasExistingInvoice ? 'View invoice' : 'Invoice'}</span>
            <CountBadge count={invoiceCount} />
          </button>
        </div>
      </div>
    </div>
  );

  // Inline fallback so the actions are never simply missing if the slot is not
  // on the page — a case paper you cannot save would be far worse than one
  // whose bar sits in the flow.
  return dock ? createPortal(bar, dock) : bar;
};

export default CasePaperActionBar;
