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
