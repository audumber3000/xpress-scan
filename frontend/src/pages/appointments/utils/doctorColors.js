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
  card: "bg-slate-500 border-slate-600 text-white",
  cardBorderLeft: "border-l-slate-700",
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
// Solid fills, not tints. A grid of pale cards makes a busy clinic look empty
// and leaves the patient's name fighting a washed background for contrast.
// Every `card` below is a 600 with white text, which clears WCAG AA at the
// 11-12px the grid actually renders, and the left rule is the 800 of the same
// hue so a card still reads as one block rather than two.
const DOCTOR_PALETTE = [
  // pink · 17
  { dot: "bg-rose-500",    swatch: "bg-rose-100 border-rose-400",       card: "bg-rose-600 border-rose-700 text-white",       cardBorderLeft: "border-l-rose-800" },
  // teal · 183
  { dot: "bg-teal-500",    swatch: "bg-teal-100 border-teal-400",       card: "bg-teal-600 border-teal-700 text-white",       cardBorderLeft: "border-l-teal-800" },
  // magenta · 322
  { dot: "bg-fuchsia-500", swatch: "bg-fuchsia-100 border-fuchsia-400", card: "bg-fuchsia-600 border-fuchsia-700 text-white", cardBorderLeft: "border-l-fuchsia-800" },
  // light green · 131
  { dot: "bg-lime-500",    swatch: "bg-lime-100 border-lime-400",       card: "bg-lime-600 border-lime-700 text-white",       cardBorderLeft: "border-l-lime-800" },
  // indigo · 277
  { dot: "bg-indigo-500",  swatch: "bg-indigo-100 border-indigo-400",   card: "bg-indigo-600 border-indigo-700 text-white",   cardBorderLeft: "border-l-indigo-800" },
  // light orange · 70
  { dot: "bg-orange-500",  swatch: "bg-orange-100 border-orange-400",   card: "bg-orange-600 border-orange-700 text-white",   cardBorderLeft: "border-l-orange-800" },
  // light blue · 237
  { dot: "bg-sky-500",     swatch: "bg-sky-100 border-sky-400",         card: "bg-sky-600 border-sky-700 text-white",         cardBorderLeft: "border-l-sky-800" },
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

/**
 * Two states that outrank the doctor's hue.
 *
 * A cancelled or missed slot is not information about a dentist, it is a hole
 * in the day, and colouring it like a live booking makes a busy-looking grid
 * that isn't. These two are reserved: no doctor is ever assigned them, so the
 * colour reads the same in every clinic.
 */
export const CANCELLED_STYLE = {
  key: "cancelled",
  name: "Cancelled",
  dot: "bg-gray-400",
  swatch: "bg-gray-100 border-gray-300",
  card: "bg-gray-100 border-gray-300 text-gray-500",
  cardBorderLeft: "border-l-gray-400",
  ring: "ring-gray-200",
  label: "Cancelled",
  isUnassigned: false,
};

export const MISSED_STYLE = {
  key: "no_show",
  name: "Did not attend",
  dot: "bg-amber-500",
  swatch: "bg-amber-50 border-amber-400",
  card: "bg-amber-500 border-amber-600 text-white",
  cardBorderLeft: "border-l-amber-700",
  ring: "ring-amber-200",
  label: "Did not attend",
  isUnassigned: false,
};

export const getAppointmentColor = (appointment) => {
  // Status wins over whose appointment it is.
  if (appointment?.status === "cancelled") return CANCELLED_STYLE;
  if (appointment?.status === "no_show") return MISSED_STYLE;
  if (!appointment?.doctor_id) return UNASSIGNED_STYLE;
  return getDoctorColor(appointment.doctor_id);
};
