import React from "react";
import { Trash2, Download, Eye, CheckCircle2 } from "lucide-react";
import WhatsAppIcon from '../common/WhatsAppIcon';
import Spinner from "../common/Spinner";

/**
 * The drawer footer: what you do to the bill, not to the document.
 *
 * Delete carries its label rather than standing as a bare trash icon — an
 * icon-only control is the weakest affordance in the row, and this is the one
 * action here that cannot be undone.
 *
 * Mark as Paid is the primary in brand navy. It was green (#25D366) which is
 * WhatsApp's colour, sitting one button away from the actual WhatsApp action —
 * so the brand hue said nothing and the two read as a pair. Send keeps the green
 * because it genuinely opens WhatsApp.
 */
const BTN = "px-3.5 py-2 rounded-lg transition-colors font-semibold text-[13px] inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed";

const InvoiceActions = ({
  invoice,
  onFinalize,
  onMarkAsPaid,
  onDownloadPDF,
  onSendWhatsApp,
  canEdit,
  canDelete,
  onDelete,
  deleting,
  downloadingPDF,
  sendingWhatsApp,
  finalizing,
}) => {
  if (!invoice) return null;

  const isDraft = invoice.status === 'draft';
  const canFinalize = isDraft && canEdit;
  const canTakePayment = ['finalized', 'partially_paid'].includes(invoice.status);
  const canSendWhatsApp = !isDraft && invoice.patient_phone;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canDelete && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className={`${BTN} border border-red-200 text-red-600 bg-white hover:bg-red-50 shrink-0`}
        >
          {deleting ? <Spinner className="w-3.5 h-3.5" /> : <Trash2 size={15} />}
          Delete invoice
        </button>
      )}

      {canFinalize && (
        <button onClick={onFinalize} disabled={finalizing} className={`${BTN} flex-1 min-w-[150px] bg-[#2a276e] text-white hover:bg-[#1e1c4f]`}>
          {finalizing ? 'Generating final invoice' : 'Generate final invoice'}
          {finalizing && <Spinner className="w-3.5 h-3.5" />}
        </button>
      )}

      {canTakePayment && (
        <button onClick={onMarkAsPaid} className={`${BTN} flex-1 min-w-[150px] bg-[#2a276e] text-white hover:bg-[#1e1c4f]`}>
          <CheckCircle2 size={15} /> Mark as paid
        </button>
      )}

      <button
        onClick={onDownloadPDF}
        disabled={downloadingPDF}
        className={`${BTN} flex-1 min-w-[150px] border border-gray-300 text-gray-700 bg-white hover:bg-gray-50`}
      >
        {isDraft ? <Eye size={15} /> : <Download size={15} />}
        {isDraft
          ? (downloadingPDF ? 'Generating' : 'Preview PDF')
          : (downloadingPDF ? 'Downloading' : 'Download PDF')}
        {downloadingPDF && <Spinner className="w-3.5 h-3.5" />}
      </button>

      {canSendWhatsApp && (
        <button
          onClick={onSendWhatsApp}
          disabled={sendingWhatsApp}
          className={`${BTN} flex-1 min-w-[150px] bg-[#25D366] text-white hover:bg-[#20BA5A]`}
        >
          <WhatsAppIcon size={16} />
          {sendingWhatsApp ? 'Sending' : 'Send invoice'}
          {sendingWhatsApp && <Spinner className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
};

export default InvoiceActions;
