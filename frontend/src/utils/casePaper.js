import { useAuth } from '../contexts/AuthContext';

/**
 * Which case paper this clinic writes: 'dental' or 'general'.
 *
 * One reader for the whole app, so a screen can never disagree with another
 * about which paper is in use. Set in Control Center → Clinic Details → Basic.
 *
 * Defaults to 'dental' whenever the answer is not known — a clinic created
 * before this setting existed, a cached user from an older sign-in, a response
 * that has not arrived yet. Defaulting the other way would blank the tooth
 * chart on every dental clinic for the moment it takes /auth/me to land, which
 * is a far worse way to be wrong.
 */
export const DENTAL = 'dental';
export const GENERAL = 'general';

export function casePaperTypeOf(clinic) {
  return clinic?.case_paper_type === GENERAL ? GENERAL : DENTAL;
}

/** True when this clinic keeps the dental record (tooth chart, dental history). */
export function useIsDentalCasePaper() {
  const { user } = useAuth();
  return casePaperTypeOf(user?.clinic) === DENTAL;
}

/**
 * The labels that differ between the two papers.
 *
 * Kept here rather than inline at each usage so the general paper reads like a
 * record somebody would actually keep, instead of a dental one with the dental
 * words crossed out.
 */
export function useCasePaperLabels() {
  const isDental = useIsDentalCasePaper();
  return isDental
    ? {
        isDental: true,
        historyLabel: 'Dental History',
        historyPlaceholder: 'e.g. Previous RCT, Extractions',
        clinicianLabel: 'Treating Dentist',
      }
    : {
        isDental: false,
        historyLabel: 'Treatment History',
        historyPlaceholder: 'e.g. Previous topical steroids, phototherapy',
        clinicianLabel: 'Treating Doctor',
      };
}

/**
 * Which paper THIS patient's file keeps.
 *
 * The patient's own setting wins; NULL means "whatever the clinic keeps", which
 * is every patient that existed before this field. So a dental clinic stays
 * dental everywhere without editing a single row, and a mixed practice can put
 * one patient on the general paper without moving the whole clinic.
 *
 * Same defaulting rule as the clinic reader, for the same reason: while the
 * patient is still loading there is no answer yet, and blanking the tooth chart
 * for that moment on every dental clinic is the worse way to be wrong.
 */
export function casePaperTypeFor(patient, clinic) {
  const own = patient?.case_paper_type;
  if (own === GENERAL) return GENERAL;
  if (own === DENTAL) return DENTAL;
  return casePaperTypeOf(clinic);
}

/** True when this patient's file keeps the dental record. */
export function useIsDentalPatient(patient) {
  const { user } = useAuth();
  return casePaperTypeFor(patient, user?.clinic) === DENTAL;
}

/** The labels that differ, resolved for one patient rather than the clinic. */
export function usePatientCasePaperLabels(patient) {
  const isDental = useIsDentalPatient(patient);
  return isDental
    ? {
        isDental: true,
        historyLabel: 'Dental History',
        historyPlaceholder: 'e.g. Previous RCT, Extractions',
        clinicianLabel: 'Treating Dentist',
      }
    : {
        isDental: false,
        historyLabel: 'Treatment History',
        historyPlaceholder: 'e.g. Previous topical steroids, phototherapy',
        clinicianLabel: 'Treating Doctor',
      };
}
