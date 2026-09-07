/**
 * The colours a timeline event can wear, and the rule for choosing one.
 *
 * Lifted out of PatientActivityCard so the invoice history can use the same
 * element rather than a second interpretation of it. Two feeds that both answer
 * "what happened, and when" should not look like they came from different
 * products, and they did: one drew solid filled dots in muted mid-tones, the
 * other outlined rings in Tailwind's -50/-600 pairs.
 *
 * A colour per *category*, not per kind. Eight events do not need eight
 * colours. A colour has to earn itself by making a distinction the words do not
 * already make, and "case paper" versus "prescription" is one the label makes
 * perfectly well on its own. So the kinds share six tones, grouped by what the
 * event actually is:
 *
 *   SLATE    a fact rather than something somebody chose to do, and the
 *            bookkeeping edits nobody reads unless they are hunting something
 *   TEAL     the patient turned up: booked, walked in, checked in
 *   INDIGO   the clinic wrote something down
 *   OCHRE    money asked for
 *   GREEN    money received
 *   RUST     something taken back: a payment reversed, a line removed
 *
 * Money in, money asked for, and money taken back are the three that most need
 * telling apart at a glance, and they are the three that differ most.
 *
 * Muted hex rather than Tailwind's palette. The -50/-600 pairs came out neon on
 * a card that sits beside the dental chart all day: seven fluorescent dots,
 * each reading as an alert. These are mid-tone and desaturated, close enough in
 * weight to look like one family, with the house indigo among them rather than
 * beside them.
 *
 * Consumed as inline styles, not Tailwind classes: arbitrary values have to
 * appear as literal strings for the JIT to emit them, so a colour looked up
 * from a map would silently produce no CSS at all.
 */
export const SLATE  = '#6b7280';
export const TEAL   = '#29828a';   // the Control Center accent
export const INDIGO = '#2a276e';   // the house colour
export const OCHRE  = '#a86f3d';
export const GREEN  = '#3f8f6f';
export const RUST   = '#a4553f';

/** The same hue at 8%, for the badge behind it. */
export const tint = (hex) => `${hex}14`;
