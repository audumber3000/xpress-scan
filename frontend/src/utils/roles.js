/**
 * Who may write a clinical record.
 *
 * Mirrors backend/core/roles.py — the server is the authority, and this exists
 * so the app can say so BEFORE the save rather than after it. A receptionist
 * was shown the same New Case Paper button as a dentist, filled a whole visit
 * in, pressed Save, and got a generic failure; the only honest place to answer
 * "you cannot do this" is the button itself.
 *
 * Keep the list in step with CLINICAL_ROLES on the server. If the two ever
 * disagree the server wins, and the worst outcome is a button that is offered
 * and then refused — which is exactly what this is here to prevent, so a new
 * clinical role belongs in both.
 */
export const CLINICAL_ROLES = [
  'clinic_owner',
  'in_house_doctor',
  'associate',
  'consultant',
  'doctor', // legacy: what every dentist created before the role list is stored as
];

export const ROLE_LABELS = {
  clinic_owner: 'Owner',
  in_house_doctor: 'In-house doctor',
  associate: 'Associate',
  consultant: 'Consultant',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  assistant: 'Assistant',
};

/** True when this person may create and edit clinical records. */
export const canWriteClinical = (user) => CLINICAL_ROLES.includes(user?.role);

/** Their role in the words the Staff screen uses. */
export const roleLabel = (user) =>
  ROLE_LABELS[user?.role] || (user?.role || 'Staff').replace(/_/g, ' ');

/** Why the clinical write is refused, in a sentence worth showing. */
export const clinicalWriteBlockReason = (user) =>
  canWriteClinical(user)
    ? ''
    : `Your account is a ${roleLabel(user)}, so it can read case papers but not write them. `
      + 'Ask your clinic owner to change your role if you need to.';
