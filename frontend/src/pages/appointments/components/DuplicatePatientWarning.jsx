import React from "react";
import { User } from "lucide-react";

/**
 * Somebody with this name or number is already on file.
 *
 * Shown before a second record can exist, so the call between "same person"
 * and "different person" is made once, by the person who can actually tell,
 * rather than discovered later as a duplicate chart.
 */
const DuplicatePatientWarning = ({ open, matches, onLinkExisting, onCreateNew, onClose }) => {
  if (!open) return null;

  return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/30" onClick={() => onClose()}></div>
        <div className="relative bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
          <div className="px-6 pt-7 pb-5 text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-[#9B8CFF]/15 flex items-center justify-center mb-4">
              <User className="w-7 h-7 text-[#2a276e]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Existing patient found</h3>
            <p className="text-sm text-gray-500 mt-1">
              {matches.length} record{matches.length === 1 ? '' : 's'} matched these details. Link to an existing one or create a new file.
            </p>
          </div>

          <div className="px-6 pb-2 max-h-[50vh] overflow-y-auto space-y-2">
            {matches.map((patient) => (
              <div key={patient.id} className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 truncate">{patient.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {patient.phone && <span>{patient.phone}</span>}
                      {patient.email && <span> · {patient.email}</span>}
                      {patient.age && <span> · Age {patient.age}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(`/patient-profile/${patient.id}`, '_blank')}
                    className="text-xs font-semibold text-[#2a276e] hover:underline shrink-0"
                  >
                    View
                  </button>
                </div>
                <button
                  onClick={() => onLinkExisting(patient.id)}
                  className="mt-3 w-full py-2 bg-white border border-[#2a276e]/20 text-[#2a276e] rounded-lg text-sm font-semibold hover:bg-[#9B8CFF]/10 transition-colors"
                >
                  Link to this patient
                </button>
              </div>
            ))}
          </div>

          <div className="px-6 py-5 mt-2 space-y-2">
            <button
              onClick={onCreateNew}
              className="w-full py-3 bg-[#2a276e] text-white rounded-xl font-semibold hover:bg-[#1a1548] transition-colors"
            >
              Create new patient file
            </button>
            <button
              onClick={() => onClose()}
              className="w-full py-3 border border-gray-200 text-gray-600 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
  );
};

export default DuplicatePatientWarning;
