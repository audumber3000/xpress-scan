// Deterministic per-doctor color palette, theme-aligned (purple/violet/pink/blue family).
// Unassigned appointments (e.g. from public booking, no doctor selected yet) get a
// distinct amber/warning treatment so they stand out and prompt assignment.

export const UNASSIGNED_STYLE = {
  key: "unassigned",
  name: "Unassigned",
  dot: "bg-amber-400",
  swatch: "bg-amber-100 border-amber-300",
  card: "bg-amber-50 border-amber-400 text-amber-900",
  cardBorderLeft: "border-l-amber-500",
  ring: "ring-amber-300",
  label: "Unassigned",
  isUnassigned: true,
};

const DOCTOR_PALETTE = [
  { dot: "bg-[#2a276e]",   swatch: "bg-[#9B8CFF]/30 border-[#2a276e]",       card: "bg-[#9B8CFF]/20 border-[#9B8CFF] text-[#2a276e]",       cardBorderLeft: "border-l-[#2a276e]" },
  { dot: "bg-[#4c449c]",   swatch: "bg-[#4c449c]/20 border-[#4c449c]",       card: "bg-[#4c449c]/15 border-[#4c449c]/60 text-[#2a276e]",    cardBorderLeft: "border-l-[#4c449c]" },
  { dot: "bg-purple-500",  swatch: "bg-purple-100 border-purple-400",        card: "bg-purple-100 border-purple-300 text-purple-900",       cardBorderLeft: "border-l-purple-500" },
  { dot: "bg-pink-500",    swatch: "bg-pink-100 border-pink-400",            card: "bg-pink-100 border-pink-300 text-pink-900",             cardBorderLeft: "border-l-pink-500" },
  { dot: "bg-indigo-500",  swatch: "bg-indigo-100 border-indigo-400",        card: "bg-indigo-100 border-indigo-300 text-indigo-900",       cardBorderLeft: "border-l-indigo-500" },
  { dot: "bg-sky-500",     swatch: "bg-sky-100 border-sky-400",              card: "bg-sky-100 border-sky-300 text-sky-900",                cardBorderLeft: "border-l-sky-500" },
  { dot: "bg-fuchsia-500", swatch: "bg-fuchsia-100 border-fuchsia-400",      card: "bg-fuchsia-100 border-fuchsia-300 text-fuchsia-900",    cardBorderLeft: "border-l-fuchsia-500" },
  { dot: "bg-violet-500",  swatch: "bg-violet-100 border-violet-400",        card: "bg-violet-100 border-violet-300 text-violet-900",       cardBorderLeft: "border-l-violet-500" },
  { dot: "bg-rose-500",    swatch: "bg-rose-100 border-rose-400",            card: "bg-rose-100 border-rose-300 text-rose-900",             cardBorderLeft: "border-l-rose-500" },
  { dot: "bg-teal-500",    swatch: "bg-teal-100 border-teal-400",            card: "bg-teal-100 border-teal-300 text-teal-900",             cardBorderLeft: "border-l-teal-500" },
];

// Stable index from a doctor id — same doctor always maps to the same palette slot
// regardless of the order doctors are fetched.
const indexForDoctor = (doctorId) => {
  const n = Number(doctorId);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n) % DOCTOR_PALETTE.length;
};

export const getDoctorColor = (doctorId) => {
  const base = DOCTOR_PALETTE[indexForDoctor(doctorId)];
  return { ...base, key: `doctor-${doctorId}`, isUnassigned: false };
};

// Main entry used by card renderers. Returns the unassigned style if no doctor.
export const getAppointmentColor = (appointment) => {
  if (!appointment?.doctor_id) return UNASSIGNED_STYLE;
  return getDoctorColor(appointment.doctor_id);
};
