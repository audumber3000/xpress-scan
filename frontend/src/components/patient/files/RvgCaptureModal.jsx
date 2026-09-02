import React, { useEffect } from 'react';
import { X, Cable, ArrowRight } from 'lucide-react';
import WhatsAppIcon from '../../common/WhatsAppIcon';
import { SUPPORT_PHONE, supportWhatsAppLink } from '../../../constants/support';

/**
 * What "Capture Image" says until a sensor is actually wired up.
 *
 * The plan is that this button talks to the clinic's own imaging software and
 * pulls the exposure straight into the patient file — RVG, OPG, intraoral
 * camera, whatever the chair has. None of that exists yet: there is no vendor
 * bridge in the codebase at all.
 *
 * So the button opens this instead of pretending. It names the specific thing
 * that is missing, says what will happen once it is connected, and puts the
 * person who can do the connecting one tap away. A "coming soon" with no route
 * to a human is just a dead end with better manners.
 */

/** A sensor and its cable. Line art rather than a stock photo: we ship one
 *  product to clinics running a dozen different brands, and a picture of
 *  somebody else's hardware would be its own small lie. */
const SensorArt = () => (
  <svg viewBox="0 0 200 120" className="w-full max-w-[13rem] mx-auto" role="img" aria-label="An intraoral sensor with its cable">
    <rect x="34" y="26" width="78" height="58" rx="12" className="fill-[#2a276e]/[0.07] stroke-[#2a276e]/25" strokeWidth="2" />
    <rect x="46" y="38" width="54" height="34" rx="6" className="fill-white stroke-[#2a276e]/20" strokeWidth="2" />
    <circle cx="73" cy="55" r="6" className="fill-[#2a276e]/20" />
    <path
      d="M112 55 C140 55, 140 88, 168 88"
      className="stroke-[#2a276e]/30"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
      strokeDasharray="7 7"
    />
    <rect x="166" y="78" width="18" height="20" rx="4" className="fill-white stroke-[#2a276e]/25" strokeWidth="2" />
  </svg>
);

const RvgCaptureModal = ({ open, onClose, user }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="rvg-title"
           className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 text-gray-400 hover:text-gray-700 cursor-pointer"
        >
          <X size={18} />
        </button>

        <div className="px-6 pt-8 pb-2">
          <SensorArt />
        </div>

        <div className="px-6 pb-6 text-center">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-50 text-amber-800 text-[11px] font-bold">
            <Cable size={12} /> Not connected
          </span>

          <h2 id="rvg-title" className="text-lg font-bold text-gray-900 mt-3">
            No imaging device is connected yet
          </h2>

          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Once your RVG sensor, OPG or intraoral camera is linked, Capture Image
            will pull the exposure straight from the machine into this patient's
            file. No exporting to a folder and uploading it back.
          </p>

          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-left">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1.5">
              What we need from you
            </p>
            <p className="text-xs text-gray-600 leading-relaxed">
              The make and model of your sensor and the software it came with.
              Setup is done once per machine, by our team, and every brand is
              slightly different.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
            <a
              href={supportWhatsAppLink(user)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-[#2a276e] text-white text-sm font-semibold hover:bg-[#1a1548] transition-colors"
            >
              <WhatsAppIcon size={16} /> Talk to support
            </a>
            <a
              href={`tel:${SUPPORT_PHONE.replace(/\s/g, '')}`}
              className="inline-flex items-center justify-center gap-2 h-10 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Call {SUPPORT_PHONE} <ArrowRight size={14} />
            </a>
          </div>

          {/* Upload still works today, and saying so stops this reading as a
              wall. */}
          <p className="text-[11px] text-gray-400 mt-4">
            In the meantime, Upload takes files exported from your imaging software.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RvgCaptureModal;
