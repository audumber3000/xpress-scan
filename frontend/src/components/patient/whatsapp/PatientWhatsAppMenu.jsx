import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MoreVertical, ReceiptText, Stethoscope, Pill } from 'lucide-react';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import GoogleGlyph from '../../common/GoogleGlyph';
import SendListModal from './SendListModal';
import GoogleReviewModal from './GoogleReviewModal';
import { api } from '../../../utils/api';
import { notify } from '../../../utils/notify';
import { formatDate } from '../../../utils/datetime';
import { getCurrencySymbol } from '../../../utils/currency';
import {
  openWhatsApp,
  isManualWhatsApp,
  shareInvoiceManually,
  sharePrescriptionManually,
  shareVisitSummaryManually,
} from '../../../utils/whatsapp';

/**
 * Everything you might WhatsApp a patient, behind the dots next to the
 * WhatsApp button.
 *
 * Two of the items wear a brand mark rather than a lucide glyph, because they
 * are somebody else's product and the logo is the fastest way to say so: the
 * WhatsApp mark on the chat, the Google G on the review ask. Neither is tinted;
 * Google's guidelines only permit the G in its own colours or flat white/black.
 * The other three are ours, so they take the house indigo.
 *
 * One button in the file header, carrying the mark, the word and the dots. The
 * whole thing opens this menu; opening the chat is the first thing in it rather
 * than a second half of the control, so there is only ever one place to press
 * and no invisible seam down the middle deciding what happens.
 *
 * Each item opens a dialog listing what this patient actually has, with a Send
 * on each line, rather than sending "the latest" on a guess. A patient with
 * three bills is the normal case, and picking for them is how the wrong one
 * goes out.
 *
 * Own-number clinics (Integrations → WhatsApp) never touch the send endpoints:
 * those rows download the PDF and open a chat with the message written, so the
 * dentist presses send from their own account and nothing is billed.
 */
const ITEM_CLS =
  'w-full text-left flex items-start gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors';

const PatientWhatsAppMenu = ({ patient, user }) => {
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState(null); // 'review' | 'invoice' | 'summary' | 'prescription'

  const manual = isManualWhatsApp(user);
  const cur = getCurrencySymbol();

  // Close on an outside click or Escape, the same way MoreMenu does.
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const pick = (which) => { setOpen(false); setModal(which); };

  const openChat = () => {
    setOpen(false);
    const ok = openWhatsApp(
      patient.phone,
      `Hello ${patient.name || ''}`.trim(),
      user?.clinic?.country || 'IN',
    );
    if (!ok) notify.problem("This patient's number can't be opened in WhatsApp.");
  };

  // ── What each dialog loads and how it sends ────────────────────────────────

  const loadInvoices = useCallback(
    () => api.get(`/invoices?patient_id=${patient.id}`),
    [patient?.id],
  );
  const loadSummaries = useCallback(
    () => api.get(`/clinical/case-papers/patient/${patient.id}`),
    [patient?.id],
  );
  const loadPrescriptions = useCallback(
    () => api.get(`/clinical/prescriptions/patient/${patient.id}`),
    [patient?.id],
  );

  const sendInvoice = async (inv) => {
    if (manual) {
      const opened = await shareInvoiceManually({ ...inv, patient_phone: inv.patient_phone || patient.phone }, user);
      if (!opened) throw new Error("This patient's number can't be opened in WhatsApp.");
      return;
    }
    await api.post(`/invoices/${inv.id}/send-whatsapp`);
  };

  const sendSummary = async (cp) => {
    if (manual) {
      const opened = await shareVisitSummaryManually(cp, patient, user);
      if (!opened) throw new Error("This patient's number can't be opened in WhatsApp.");
      return;
    }
    const res = await api.post(`/clinical/case-papers/${cp.id}/send-summary`);
    // The route answers 200 with sent:false when the clinic never switched
    // visit summaries on. Without this it would read as a success and the
    // patient would be waiting for a message nobody sent.
    if (res && res.sent === false) throw new Error(res.message || 'Visit summaries are switched off for this clinic.');
  };

  const sendPrescription = async (rx) => {
    if (manual) {
      const opened = await sharePrescriptionManually(rx, patient, user);
      if (!opened) throw new Error("This patient's number can't be opened in WhatsApp.");
      return;
    }
    await api.post(`/clinical/prescriptions/${rx.id}/send-whatsapp`);
  };

  const opened = manual ? 'WhatsApp opened with' : 'sent to';
  const who = patient?.name || 'the patient';

  return (
    <div ref={wrapRef} className="relative flex">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="WhatsApp this patient"
        title="WhatsApp this patient"
        className={`inline-flex items-center gap-2 h-10 px-3.5 rounded-lg border text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2a276e] ${
          open
            ? 'border-[#2a276e]/30 text-[#2a276e] bg-[#2a276e]/[0.04]'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
        }`}
      >
        {/* Brand green on the mark, because that is what makes it read as
            WhatsApp rather than as a generic chat bubble. */}
        <WhatsAppIcon size={17} brand />
        <span className="hidden sm:inline">WhatsApp</span>
        <MoreVertical size={16} className="text-[#2a276e] -mr-1" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1.5 z-50 w-64 py-1.5 bg-white border border-gray-200 rounded-xl shadow-xl"
        >
          <button type="button" role="menuitem" className={ITEM_CLS} onClick={openChat}>
            <WhatsAppIcon size={15} brand className="mt-0.5 flex-shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">Open the chat</span>
              <span className="block text-[11px] text-gray-400 leading-snug">Type something yourself</span>
            </span>
          </button>

          <div className="my-1 border-t border-gray-100" />

          <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => pick('review')}>
            <GoogleGlyph size={15} className="mt-0.5 flex-shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">Ask for a Google review</span>
              <span className="block text-[11px] text-gray-400 leading-snug">Your listing, with a one tap link</span>
            </span>
          </button>

          <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => pick('invoice')}>
            <ReceiptText size={15} className="mt-0.5 text-[#2a276e] flex-shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">Send a bill</span>
              <span className="block text-[11px] text-gray-400 leading-snug">Pick from this patient's invoices</span>
            </span>
          </button>

          <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => pick('summary')}>
            <Stethoscope size={15} className="mt-0.5 text-[#2a276e] flex-shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">Send a visit summary</span>
              <span className="block text-[11px] text-gray-400 leading-snug">What was found and done, per visit</span>
            </span>
          </button>

          <button type="button" role="menuitem" className={ITEM_CLS} onClick={() => pick('prescription')}>
            <Pill size={15} className="mt-0.5 text-[#2a276e] flex-shrink-0" />
            <span className="min-w-0">
              <span className="block font-medium">Send a prescription</span>
              <span className="block text-[11px] text-gray-400 leading-snug">Any prescription already written</span>
            </span>
          </button>
        </div>
      )}

      <GoogleReviewModal
        open={modal === 'review'}
        onClose={() => setModal(null)}
        patient={patient}
        user={user}
      />

      <SendListModal
        open={modal === 'invoice'}
        onClose={() => setModal(null)}
        title="Send a bill"
        subtitle={`Every invoice on ${who}'s file. Send as many as you need.`}
        emptyTitle="No invoices yet"
        emptySubtitle="Bills raised for this patient will show up here."
        load={loadInvoices}
        describe={(inv) => ({
          key: `inv-${inv.id}`,
          primary: inv.invoice_number || `Invoice ${inv.id}`,
          secondary: [
            inv.created_at ? formatDate(inv.created_at) : null,
            Number(inv.due_amount || 0) > 0
              ? `${cur}${Number(inv.due_amount).toLocaleString('en-IN')} still due`
              : 'Settled',
          ].filter(Boolean).join(' • '),
          trailing: `${cur}${Number(inv.total || 0).toLocaleString('en-IN')}`,
        })}
        send={sendInvoice}
        sentMessage={(inv) => `Invoice ${inv.invoice_number || inv.id} ${opened} ${who} on WhatsApp.`}
      />

      <SendListModal
        open={modal === 'summary'}
        onClose={() => setModal(null)}
        title="Send a visit summary"
        subtitle={`One per visit. Pick the one ${who} should have.`}
        emptyTitle="No visits recorded yet"
        emptySubtitle="Once a case paper is written, its summary can be sent from here."
        load={loadSummaries}
        describe={(cp) => {
          const complaint = Array.isArray(cp.chief_complaint)
            ? cp.chief_complaint.filter(Boolean).join(', ')
            : cp.chief_complaint;
          return {
            key: `cp-${cp.id}`,
            primary: cp.date ? formatDate(cp.date) : `Visit ${cp.id}`,
            secondary: complaint || cp.diagnosis || cp.dentist_name || cp.status,
          };
        }}
        send={sendSummary}
        sentMessage={(cp) => `Visit summary for ${cp.date ? formatDate(cp.date) : 'that visit'} ${opened} ${who} on WhatsApp.`}
      />

      <SendListModal
        open={modal === 'prescription'}
        onClose={() => setModal(null)}
        title="Send a prescription"
        subtitle={`Everything written for ${who} so far.`}
        emptyTitle="Nothing prescribed yet"
        emptySubtitle="Prescriptions written on this file can be sent from here."
        load={loadPrescriptions}
        describe={(rx) => ({
          key: `rx-${rx.id}`,
          primary: rx.created_at ? formatDate(rx.created_at) : `Prescription ${rx.id}`,
          secondary: (rx.items || []).map((i) => i.medicine_name).filter(Boolean).join(', ')
            || rx.notes
            || 'No medicines listed',
        })}
        send={sendPrescription}
        sentMessage={(rx) => `Prescription ${opened} ${who} on WhatsApp.`}
      />
    </div>
  );
};

export default PatientWhatsAppMenu;
