import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

/**
 * The three standing facts about a patient, as full-width strips.
 *
 * Full width on purpose. An allergy is the one thing on this screen that can
 * hurt somebody, and a strip you cannot miss is the entire job — a compact chip
 * reads as decoration and gets skipped.
 *
 * What is corrected from the reference: "No significant history" arrived as an
 * amber warning, a negative finding dressed as a hazard. Medical only turns
 * amber when there is actually something to know; with nothing recorded it goes
 * quiet grey and says so plainly.
 *
 * Three roles, three colours, each used only for the role it names:
 *
 *   red    danger   — something here can hurt the patient
 *   amber  caution  — something to weigh before treating
 *   blue   info     — reference data, no action implied
 *
 * Blood group is deliberately NOT the brand indigo. #2a276e is this app's
 * action colour — every primary button, link and active tab — so a strip
 * wearing it reads as something you can press. A calm info blue says "fact",
 * which is what a blood group is.
 *
 * Each strip drops to neutral grey when its field is empty. A red banner
 * announcing "None recorded" is a false alarm, and a row that cries wolf on a
 * quiet patient is a row nobody reads on a loud one.
 */
const Strip = ({ icon, label, value, tone }) => (
  // `title` on the truncating element, always. A long allergy list clipped to
  // "Penicillin, La…" with no way to read the rest is the one truncation on
  // this screen that can actually hurt somebody.
  <div className={`flex items-center gap-2.5 px-4 py-3 rounded-lg border min-w-0 ${tone}`}>
    <span className="flex-shrink-0">{icon}</span>
    <p className="text-sm min-w-0 truncate" title={`${label}: ${value}`}>
      <span className="font-bold">{label}:</span>{' '}
      <span className="font-medium">{value}</span>
    </p>
  </div>
);

const PatientSafetyBand = ({ allergies, medicalHistory, bloodGroup, className = '' }) => {
  const hasAllergies = Boolean(allergies?.trim());
  const hasHistory = Boolean(medicalHistory?.trim());

  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 ${className}`}>
      <Strip
        icon={<AlertTriangle size={16} className={hasAllergies ? 'text-red-500' : 'text-gray-400'} />}
        label="Allergies"
        value={hasAllergies ? allergies : 'None recorded'}
        tone={hasAllergies
          ? 'bg-red-50 border-red-200 text-red-800'
          : 'bg-gray-50 border-gray-200 text-gray-500'}
      />
      <Strip
        icon={<AlertTriangle size={16} className={hasHistory ? 'text-amber-500' : 'text-gray-400'} />}
        label="Medical"
        value={hasHistory ? medicalHistory : 'No significant history'}
        tone={hasHistory
          ? 'bg-amber-50 border-amber-200 text-amber-800'
          : 'bg-gray-50 border-gray-200 text-gray-500'}
      />
      <Strip
        icon={<Info size={16} className={bloodGroup ? 'text-blue-500' : 'text-gray-400'} />}
        label="Blood Group"
        value={bloodGroup || 'Not recorded'}
        tone={bloodGroup
          ? 'bg-blue-50 border-blue-200 text-blue-800'
          : 'bg-gray-50 border-gray-200 text-gray-500'}
      />
    </div>
  );
};

export default PatientSafetyBand;
