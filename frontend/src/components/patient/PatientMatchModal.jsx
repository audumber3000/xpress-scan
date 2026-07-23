import React from "react";
import { User } from "lucide-react";
import { generatePatientPersona, generateInitialsAvatar } from "../../utils/avatar";
import { formatDate } from "../../utils/datetime";

/**
 * "Existing patient found" popup.
 *
 * Follows the check-in duplicate modal on the calendar, which is the app's
 * established treatment for this exact decision: centred icon, the candidate
 * records as tappable cards, then a filled primary for "create new" and an
 * outline cancel. Sits above the register drawer (z-[100] vs the drawer's
 * z-[70]) so the choice is the only thing in focus.
 */
const PatientMatchModal = ({
  open,
  matches = [],
  onPick,
  onCreateNew,
  onClose,
  busy = false,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={busy ? undefined : onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden"
      >
        <div className="px-6 pt-7 pb-5 text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-[#9B8CFF]/15 flex items-center justify-center mb-4">
            <User className="w-7 h-7 text-[#2a276e]" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">Existing patient found</h3>
          <p className="text-sm text-gray-500 mt-1">
            We found {matches.length} record{matches.length === 1 ? "" : "s"} that may be the same patient.
            Pick one to record a repeat visit, or register a new patient.
          </p>
        </div>

        <div className="px-6 pb-2 max-h-[50vh] overflow-y-auto space-y-2">
          {matches.map((patient) => (
            <button
              key={patient.id}
              onClick={() => onPick(patient)}
              disabled={busy}
              className="w-full text-left bg-gray-50 hover:bg-[#9B8CFF]/10 border border-gray-200 hover:border-[#2a276e]/30 rounded-xl px-4 py-3 transition-colors flex items-center gap-3 disabled:opacity-50"
            >
              <img
                src={generatePatientPersona(patient, 80)}
                onError={(e) => { e.target.onerror = null; e.target.src = generateInitialsAvatar(patient.name || "Patient"); }}
                alt={patient.name}
                className="w-10 h-10 rounded-full shrink-0 object-cover border border-gray-200"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-gray-900 truncate">{patient.name}</div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">
                  {patient.phone || "No phone"}
                  {patient.village && <span> · {patient.village}</span>}
                  {patient.display_id && <span> · #{patient.display_id}</span>}
                </div>
                {(patient.registered_on || patient.created_at) && (
                  <div className="text-xs text-gray-400 mt-0.5">
                    Patient since {formatDate(patient.registered_on || patient.created_at)}
                  </div>
                )}
              </div>
              <span className="text-xs font-semibold text-[#2a276e] shrink-0">Use this →</span>
            </button>
          ))}
        </div>

        <div className="px-6 py-5 mt-2 space-y-2">
          <button
            onClick={onCreateNew}
            disabled={busy}
            className="w-full py-3 bg-[#2a276e] text-white rounded-xl font-semibold hover:bg-[#1a1548] transition-colors disabled:opacity-50"
          >
            Register a new patient instead
          </button>
          <button
            onClick={onClose}
            disabled={busy}
            className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientMatchModal;
