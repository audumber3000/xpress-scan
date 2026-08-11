// Mirrors backend/core/roles.py. The backend decides who may do what; this is
// only for labels and for deciding which tabs to show.
//
// CLINICAL_ROLES is the list that matters: anyone on it gets a column on the
// calendar, can be given working hours, and can be owed a consultant fee. Add a
// role in one place and forget the other and you get staff who exist but never
// appear on the calendar.

export const ROLE_LABEL = {
  clinic_owner: 'Owner',
  in_house_doctor: 'In-house doctor',
  associate: 'Associate',
  consultant: 'Consultant',
  doctor: 'Doctor',
  dentist: 'Doctor',
  receptionist: 'Receptionist',
  assistant: 'Assistant',
};

// The owner is included because in a small practice the owner IS a dentist.
export const CLINICAL_ROLES = [
  'clinic_owner',
  'in_house_doctor',
  'associate',
  'consultant',
  'doctor',
  'dentist',
];

export const isClinical = (role) => CLINICAL_ROLES.includes(role);

export const roleLabel = (role) =>
  ROLE_LABEL[role] ||
  String(role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ||
  'Staff';
