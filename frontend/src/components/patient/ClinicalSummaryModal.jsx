import React, { useState, useEffect, useRef } from 'react';
import { X, Download, RefreshCw, AlertCircle } from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import Spinner from '../common/Spinner';
import { postForBlob, saveBlob, openWhatsApp } from '../../utils/whatsapp';
import { serialiseChartSvg } from './chartSvg';
import { notify } from '../../utils/notify';

/**
 * The whole visit as one document, shown before it goes anywhere.
 *
 * It builds and previews on open rather than offering two buttons that each
 * hand you a file to go and check. This document carries the chart, the
 * findings and the fees, and it is often the thing that gets sent to another
 * clinician — reading it first is the whole point, and a "Download" that makes
 * you leave the app to find out what you downloaded is the wrong shape for that.
 *
 * The PDF is fetched once and held. Preview, download and send all use the same
 * bytes, so building it three times to do three things with it cannot happen.
 */
const ACTION =
  'inline-flex items-center gap-2 h-10 px-4 rounded-lg text-sm font-semibold whitespace-nowrap ' +
  'cursor-pointer transition-[background-color,border-color,transform] duration-150 ease-out ' +
  'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100';

const ClinicalSummaryModal = ({ open, onClose, casePaper, patient, user }) => {
  const [state, setState] = useState('loading');   // loading | ready | error
  const [previewUrl, setPreviewUrl] = useState(null);
  const [sending, setSending] = useState(false);
  const blobRef = useRef(null);
  const urlRef = useRef(null);

  const filename = `clinical_summary_${casePaper?.id}.pdf`;

  const build = async () => {
    setState('loading');
    // Revoke the previous preview before replacing it: an object URL holds the
    // whole PDF in memory until it is released, and rebuilding a few times
    // while editing a case paper would quietly pile them up.
    if (urlRef.current) {
      window.URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    try {
      const blob = await postForBlob(
        `/clinical/case-papers/${casePaper.id}/clinical-summary-pdf`,
        { chart_svg: serialiseChartSvg() },
      );
      blobRef.current = blob;
      urlRef.current = window.URL.createObjectURL(blob);
      setPreviewUrl(urlRef.current);
      setState('ready');
    } catch (err) {
      console.error('Could not build the clinical summary:', err);
      setState('error');
    }
  };

  useEffect(() => {
    if (!open || !casePaper?.id) return undefined;
    build();
    return () => {
      if (urlRef.current) {
        window.URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
      blobRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, casePaper?.id]);

  if (!open) return null;

  const hasPhone = !!patient?.phone;

  const download = () => {
    if (!blobRef.current) return;
    saveBlob(blobRef.current, filename);
    notify.sent('Clinical summary downloaded');
  };

  const sendWhatsApp = () => {
    if (!blobRef.current || !hasPhone) return;
    setSending(true);
    // WhatsApp cannot be handed an attachment, so the file is saved first and
    // the doctor attaches the one they just got. Saying so beats a send button
    // that appears to have sent nothing.
    saveBlob(blobRef.current, filename);
    const clinicName = user?.clinic?.name || 'our clinic';
    const msg = `Hello ${patient.name || ''}, here is the full clinical record of your visit to ${clinicName}, `
      + `attached as a PDF. It includes the tooth chart, what we found and the treatment we discussed.`;
    openWhatsApp(patient.phone, msg, user?.clinic?.country || 'IN');
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        role="dialog" aria-modal="true" aria-labelledby="clinical-summary-title"
        className="relative w-full max-w-4xl h-full max-h-[92vh] flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 border-b border-gray-200">
          <div className="min-w-0">
            <h3 id="clinical-summary-title" className="text-base font-bold text-gray-900">Clinical summary</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              {patient?.name ? `${patient.name} · ` : ''}chart, findings, treatment plan, perio, medicines and lab work
            </p>
          </div>
          <button
            type="button" onClick={onClose} aria-label="Close"
            className="p-2 -mr-2 -mt-1 rounded-full text-gray-400 cursor-pointer transition-[background-color,color,transform] duration-150 ease-out hover:text-gray-700 hover:bg-gray-100 active:scale-[0.97]"
          >
            <X size={18} />
          </button>
        </div>

        {/* The document itself. The browser's own PDF viewer comes with paging,
            zoom and print already working, which is more than a bespoke preview
            would have on its first day. */}
        <div className="flex-1 min-h-0 bg-gray-100">
          {state === 'loading' && (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-gray-400">
              <Spinner className="w-6 h-6" />
              <p className="text-sm font-medium">Building the summary…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
              <AlertCircle size={26} className="text-red-400" />
              <p className="text-sm font-semibold text-gray-700">Could not build the summary</p>
              <p className="text-xs text-gray-500 max-w-sm">
                The case paper is saved, so nothing is lost. Try again, and if it keeps
                failing the server log will say why.
              </p>
              <button
                type="button" onClick={build}
                className={`${ACTION} mt-1 bg-[#2a276e] text-white hover:bg-[#1a1548]`}
              >
                <RefreshCw size={15} /> Try again
              </button>
            </div>
          )}

          {state === 'ready' && previewUrl && (
            <iframe
              src={previewUrl}
              title="Clinical summary preview"
              className="w-full h-full border-0"
            />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 px-6 py-3.5 border-t border-gray-200 bg-white">
          <p className="text-[11px] leading-relaxed text-gray-400 max-w-sm">
            {/* Two documents, two audiences. Saying which is which here is what
                stops a fee sheet going to a patient who asked for a receipt. */}
            The full record, fees included — meant for the file or another clinician.
            To hand the patient something, use <strong>Visit summary</strong> from the WhatsApp menu.
          </p>

          <div className="flex items-center gap-2.5">
            <button
              type="button" onClick={download} disabled={state !== 'ready'}
              className={`${ACTION} bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300`}
            >
              <Download size={16} /> Download
            </button>
            <button
              type="button" onClick={sendWhatsApp} disabled={state !== 'ready' || !hasPhone || sending}
              title={hasPhone ? 'Saves the PDF, then opens the chat to attach it' : 'This patient has no phone number on file'}
              className={`${ACTION} bg-[#25D366] text-white hover:bg-[#20BA5A]`}
            >
              {sending ? <Spinner className="w-4 h-4" /> : <WhatsAppIcon className="w-4 h-4" />}
              Send on WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicalSummaryModal;
