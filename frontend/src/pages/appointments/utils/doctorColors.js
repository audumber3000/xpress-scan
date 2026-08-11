// Per-doctor colours, chosen to be told apart at a glance.
//
// The old palette was navy, indigo, purple, violet, fuchsia, pink, rose and sky:
// eight shades of one family. On a busy day grid two dentists looked like the
// same person. These ten sit far apart on the colour wheel instead, roughly 36
// degrees between neighbours, and every one is a light tint so dark text stays
// readable on top of it.
//
// Unassigned is deliberately NOT a hue. It is slate with a dashed border, which
// reads as "nobody yet" rather than competing with a real doctor's colour, and
// keeps every hue free for actual people.

export const UNASSIGNED_STYLE = {
  key: "unassigned",
  name: "Unassigned",
  dot: "bg-slate-400",
  swatch: "bg-slate-100 border-slate-400",
  card: "bg-slate-50 border-slate-400 text-slate-700",
  cardBorderLeft: "border-l-slate-400",
  ring: "ring-slate-300",
  label: "Unassigned",
  isUnassigned: true,
};

// Seven hues, and no more. Ten looked like a richer palette but forced pairs
// only 30 degrees apart: emerald at 162 sat right beside lime at 131 and read
// as the same green on the grid. Seven is the largest set where EVERY pair is
// at least 40 degrees apart in Tailwind's oklch hues, which is the point at
// which two dentists stop being mistaken for each other. Repeating after seven
// beats two doctors who look alike.
//
// Ordered by interleaving the wheel rather than walking it, so neighbouring
// palette slots (which is what consecutive doctor ids get) are always more than
// 130 degrees apart. Hue in the comment is the oklch hue Tailwind v4 emits.
const DOCTOR_PALETTE = [
  // pink · 17
  { dot: "bg-rose-500",    swatch: "bg-rose-100 border-rose-400",       card: "bg-rose-50 border-rose-300 text-rose-900",       cardBorderLeft: "border-l-rose-500" },
  // teal · 183
  { dot: "bg-teal-500",    swatch: "bg-teal-100 border-teal-400",       card: "bg-teal-50 border-teal-300 text-teal-900",       cardBorderLeft: "border-l-teal-500" },
  // magenta · 322
  { dot: "bg-fuchsia-500", swatch: "bg-fuchsia-100 border-fuchsia-400", card: "bg-fuchsia-50 border-fuchsia-300 text-fuchsia-900", cardBorderLeft: "border-l-fuchsia-500" },
  // light green · 131
  { dot: "bg-lime-500",    swatch: "bg-lime-100 border-lime-400",       card: "bg-lime-50 border-lime-400 text-lime-900",       cardBorderLeft: "border-l-lime-500" },
  // indigo · 277
  { dot: "bg-indigo-500",  swatch: "bg-indigo-100 border-indigo-400",   card: "bg-indigo-50 border-indigo-300 text-indigo-900", cardBorderLeft: "border-l-indigo-500" },
  // light orange · 70
  { dot: "bg-orange-500",  swatch: "bg-orange-100 border-orange-400",   card: "bg-orange-50 border-orange-300 text-orange-900", cardBorderLeft: "border-l-orange-500" },
  // light blue · 237
  { dot: "bg-sky-500",     swatch: "bg-sky-100 border-sky-400",         card: "bg-sky-50 border-sky-300 text-sky-900",          cardBorderLeft: "border-l-sky-500" },
];

// Which slot a doctor gets.
//
// Keyed on their POSITION in this clinic's own doctor list, not on their id.
// Hashing the id meant two dentists whose ids happened to differ by the palette
// length came out identical: a real clinic had two doctors both rendered lime,
// which is worse than the same-family problem this palette set out to fix.
// Within one clinic, position guarantees no two doctors share a colour until
// there are more doctors than colours.
//
// The registry is module-level because the colour has to be identical in the
// grid, the team filter, the month chips and the cards, and threading an index
// through all of them would go stale the moment one caller forgot.
let doctorOrder = new Map();

export const registerDoctors = (doctors) => {
  const next = new Map();
  // Sorted by id so the assignment is stable no matter what order the API
  // returns them in, and does not reshuffle colours between page loads.
  [...(doctors || [])]
    .map((d) => Number(d?.id))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)
    .forEach((id, i) => next.set(id, i));
  doctorOrder = next;
};

const indexForDoctor = (doctorId) => {
  const n = Number(doctorId);
  if (!Number.isFinite(n)) return 0;
  // Falls back to the id when the registry has not been populated yet, so a
  // card rendered before the doctor list loads still gets a colour.
  const pos = doctorOrder.has(n) ? doctorOrder.get(n) : Math.abs(n);
  return pos % DOCTOR_PALETTE.length;
};

export const getDoctorColor = (doctorId) => {
  const base = DOCTOR_PALETTE[indexForDoctor(doctorId)];
  return { ...base, key: `doctor-${doctorId}`, isUnassigned: false };
};

export const getAppointmentColor = (appointment) => {
  if (!appointment?.doctor_id) return UNASSIGNED_STYLE;
  return getDoctorColor(appointment.doctor_id);
};
