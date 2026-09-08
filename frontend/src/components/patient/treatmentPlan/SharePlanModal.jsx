import React, { useState } from 'react';
import { X, Download } from 'lucide-react';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import Spinner from '../../common/Spinner';
import { downloadAuthedFile, shareTreatmentPlanManually } from '../../../utils/whatsapp';
import { getCurrencySymbol } from '../../../utils/currency';
import { notify } from '../../../utils/notify';
import { planTotal, isCompleted } from './planUtils';

/**
 * Hand the plan to the patient.
 *
 * A modal, like the app's other share dialogs — it is a short decision about
 * something that already exists, not a flow you work inside.
 *
 * Two exits, and both are honest about what they do. WhatsApp cannot prefill an
 * attachment, so "send" means: download the PDF, then open the chat with the
 * message written, and the doctor attaches the file they just got. Pretending
 * otherwise is how a share button ends up sending an empty message.
 */
const ACTION =
  'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left cursor-pointer ' +
  'transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.99] ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

const SharePlanModal = ({ open, onClose, casePaper, patient, user, treatmentPlan = [] }) => {
  const [busy, setBusy] = useState(null); // 'download' | 'whatsapp'

  if (!open) return null;

  const pending = treatmentPlan.filter((i) => !isCompleted(i));
  const total = planTotal(treatmentPlan);
  const hasPhone = !!patient?.phone;

  const run = async (kind, fn, doneMessage) => {
    setBusy(kind);
    try {
      await fn();
      if (doneMessage) notify.sent(doneMessage);
    } catch (err) {
      console.error('Failed to share treatment plan:', err);
      notify.problem('Could not prepare the treatment plan PDF');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-plan-title"
        className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div>
            <h3 id="share-plan-title" className="text-base font-bold text-gray-900">Share treatment plan</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {treatmentPlan.length} procedure{treatmentPlan.length === 1 ? '' : 's'}
              {pending.length > 0 && ` · ${pending.length} still to do`}
              {total > 0 && ` · ${getCurrencySymbol()}${total.toLocaleString('en-IN')}`}
            </p>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="p-2 -mr-2 -mt-1 rounded-full text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:text-gray-700 hover:bg-gray-100 active:scale-[0.97]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-2.5">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => run(
              'download',
              () => downloadAuthedFile(
                `/clinical/case-papers/${casePaper.id}/treatment-plan-pdf`,
                `treatment_plan_${casePaper.id}.pdf`
              ),
              'Treatment plan downloaded'
            )}
            className={`${ACTION} bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300`}
          >
            <span className="shrink-0 w-9 h-9 rounded-lg bg-[#2a276e]/5 text-[#2a276e] flex items-center justify-center">
              {busy === 'download' ? <Spinner className="w-4 h-4" /> : <Download size={17} />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">Download PDF</span>
              <span className="block text-xs text-gray-500">Print it, or attach it yourself</span>
            </span>
          </button>

          <button
            type="button"
            disabled={busy !== null || !hasPhone}
            onClick={() => run(
              'whatsapp',
              () => shareTreatmentPlanManually(casePaper, patient, user),
              null
            )}
            className={`${ACTION} bg-white border-gray-200 hover:bg-gray-50 hover:border-gray-300`}
          >
            <span className="shrink-0 w-9 h-9 rounded-lg bg-[#25D366]/10 text-[#25D366] flex items-center justify-center">
              {busy === 'whatsapp' ? <Spinner className="w-4 h-4" /> : <WhatsAppIcon className="w-[18px] h-[18px]" />}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-900">Send on WhatsApp</span>
              <span className="block text-xs text-gray-500">
                {hasPhone
                  ? 'Downloads the PDF, then opens the chat for you to attach it'
                  : 'This patient has no phone number on file'}
              </span>
            </span>
          </button>

          <p className="pt-2 text-[11px] leading-relaxed text-gray-400">
            The plan goes out as an estimate, not a bill. If you want something the
            patient can formally accept or decline, build a quotation from this
            patient's Billing tab instead.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SharePlanModal;
