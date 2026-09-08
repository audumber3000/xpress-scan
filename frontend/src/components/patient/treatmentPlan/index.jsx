import React, { useState, useMemo, useCallback } from 'react';
import { Share2, Activity } from 'lucide-react';
import TreatmentBoard from './TreatmentBoard';
import TreatmentTable from './TreatmentTable';
import PlanViewToggle from './PlanViewToggle';
import SharePlanModal from './SharePlanModal';
import ConfirmDialog from '../../common/ConfirmDialog';
import { getCurrencySymbol } from '../../../utils/currency';
import { planTotal, toothLabel } from './planUtils';

const VIEW_KEY = 'mp.tplan.view';

/**
 * The treatment plan, as a board or as a table.
 *
 * Two views because there are two questions. "Where is this work up to" is a
 * board question — you move a card and the answer changes. "What did we agree
 * to and what does it come to" is a table question, and the board answers it
 * badly: eight cards across three columns, with the arithmetic left to you.
 *
 * They are the same data and the same write path. Marking something complete
 * from either one runs the identical auto-billing sync in CasePapersTab, so
 * neither view is the "real" one.
 */

/** The chosen view survives a reload — a doctor who prefers the table has
 *  chosen it for good, not for this one case paper. Wrapped because private
 *  windows and blocked site data make storage throw rather than return null. */
const readView = () => {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === 'table' || v === 'board' ? v : 'board';
  } catch { return 'board'; }
};

const TreatmentPlanSection = ({
  treatmentPlan = [],
  treatmentHistory = [],
  teethData = {},
  currentUserName,
  onUpdatePlan,
  onEditTreatment,
  casePaper,
  patient,
  user,
  onRequestShare,
}) => {
  const [view, setView] = useState(readView);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);

  const total = useMemo(() => planTotal(treatmentPlan), [treatmentPlan]);
  const symbol = getCurrencySymbol();

  const changeView = useCallback((next) => {
    setView(next);
    try { localStorage.setItem(VIEW_KEY, next); } catch { /* not worth failing over */ }
  }, []);

  const confirmDelete = () => {
    onUpdatePlan(treatmentPlan.filter((p) => p.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  /* A brand-new case paper has no id for the PDF to render from, so it is
     saved first — the same guard the prescription and lab drawers use. */
  const openShare = async () => {
    if (typeof onRequestShare === 'function') {
      const ok = await onRequestShare();
      if (!ok) return;
    }
    setShareOpen(true);
  };

  const viewProps = {
    treatmentPlan,
    currentUserName,
    onUpdatePlan,
    onEditStart: onEditTreatment,
    onDelete: setPendingDelete,
  };

  return (
    <section className="pt-8 border-t border-gray-100">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-[#2a276e]/5 text-[#2a276e] flex items-center justify-center">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Treatment Plan</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {treatmentPlan.length} procedure{treatmentPlan.length === 1 ? '' : 's'}
              {total > 0 && ` · ${symbol}${total.toLocaleString('en-IN')}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PlanViewToggle view={view} onChange={changeView} />
          <button
            type="button"
            onClick={openShare}
            disabled={treatmentPlan.length === 0}
            className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-[13px] font-semibold whitespace-nowrap cursor-pointer transition-[background-color,border-color,transform] duration-150 ease-out hover:bg-gray-50 hover:border-gray-300 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e]"
          >
            <Share2 size={15} />
            Share plan
          </button>
        </div>
      </div>

      {view === 'board' ? (
        <TreatmentBoard
          {...viewProps}
          treatmentHistory={treatmentHistory}
          teethData={teethData}
        />
      ) : (
        <TreatmentTable {...viewProps} />
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        tone="danger"
        title="Remove this from the plan?"
        message={pendingDelete && (
          <>
            <span className="font-semibold text-gray-700">
              {pendingDelete.procedure || 'This procedure'}
            </span>
            {toothLabel(pendingDelete) && ` on tooth ${toothLabel(pendingDelete)}`}
            {' will be taken off the treatment plan.'}
            {pendingDelete.invoice_line_item_id
              ? ' It has already been billed, so its line will be removed from the draft invoice too.'
              : ''}
          </>
        )}
        actions={[{ label: 'Remove', onClick: confirmDelete, variant: 'danger' }]}
      />

      {shareOpen && casePaper && (
        <SharePlanModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          casePaper={casePaper}
          patient={patient}
          user={user}
          treatmentPlan={treatmentPlan}
        />
      )}
    </section>
  );
};

export default TreatmentPlanSection;
