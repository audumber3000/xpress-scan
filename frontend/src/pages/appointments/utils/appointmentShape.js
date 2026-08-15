/**
 * The API's appointment, in the shape the calendar draws.
 *
 * One mapper, because there used to be three. Opening the drawer fetched the
 * appointment, then a second effect fetched the same record again and rebuilt
 * it from a shorter list of fields, so age, gender, city, chair and visit
 * number silently vanished from a drawer that had just shown them. `duration`
 * was missing from every copy, which is why cards had to infer their length
 * from the start and end times.
 */
export const toCalendarShape = (apt) => ({
  id: apt.id,
  patientId: apt.patient_id || null,
  patientName: apt.patient_name,
  patientEmail: apt.patient_email || '',
  patientPhone: apt.patient_phone || '',
  patientAvatar: (apt.patient_name || '')
    .split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2),
  treatment: apt.treatment,
  doctor_id: apt.doctor_id || null, // preserved for per-doctor colouring + filtering
  doctor: apt.doctor_name || 'Unassigned',
  startTime: apt.start_time,
  endTime: apt.end_time,
  duration: apt.duration || null,
  date: apt.appointment_date,
  status: apt.status,
  notes: apt.notes || '',
  chair_number: apt.chair_number || '',
  patientAge: apt.patient_age || '',
  patientGender: apt.patient_gender || '',
  patientVillage: apt.patient_village || '',
  patientReferredBy: apt.patient_referred_by || '',
  visitNumber: apt.visit_number || null,
});
