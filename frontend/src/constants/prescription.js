// The vocabulary a prescription line is written in.
//
// Shared by the prescription drawer and the Prescription Sets editor, so a set
// can never be built from a value the drawer cannot then display. They were
// separate lists for about an hour and that was already enough to author a set
// with dosage "0-0-0", which the drawer's select had no option for and would
// have rendered blank.

export const DOSAGE_OPTIONS = [
  '1-0-1', '1-1-1', '1-0-0', '0-1-0', '0-0-1', '1-1-0', '0-1-1',
  'SOS', 'STAT',
];

export const DURATION_OPTIONS = [
  '3 days', '5 days', '7 days', '10 days', '14 days', '1 month', 'Ongoing',
];

// Suggestions, NOT the permitted set.
//
// This was a fixed select offering only these four, while the instruction is
// the part that actually varies: "Rinse for 30 seconds twice a day", "Apply
// locally three times a day", "No alcohol while taking this". Every one of the
// clinic's existing prescription notes fell outside the four, so reopening any
// of them showed a blank box and saving would have silently erased what the
// doctor had written. It is a free text field with these as shortcuts.
export const INSTRUCTION_SUGGESTIONS = [
  'After food', 'Before food', 'Empty stomach', 'At bedtime',
  'After meals', 'With water', 'Do not swallow', 'If painful',
];

/**
 * A select can only show what is in its option list, so a stored value that
 * predates the list, or came from an import, would vanish. This keeps it.
 */
export const withCurrent = (options, current) =>
  current && !options.includes(current) ? [current, ...options] : options;
