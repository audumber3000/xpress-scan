import { cellKind, isRecorded, DAY_TONE } from '../src/features/employee/attendanceDays';

/**
 * The calendar's day mapping.
 *
 * Worth its own test because three of the states look alike and mean opposite
 * things. `null` is the future, and colouring it "absent" would accuse people
 * of missing shifts they have not reached yet; `{}` is a day that came and went
 * with nothing recorded; and only a real record carries a status.
 */
describe('what one day in the month means', () => {
  it('reads the future as future, not as an absence', () => {
    expect(cellKind(null)).toBe('future');
    expect(isRecorded(null)).toBe(false);
  });

  it('reads a day that came and went unmarked as blank', () => {
    expect(cellKind({} as any)).toBe('blank');
    expect(isRecorded({} as any)).toBe(false);
  });

  it('reads a missing day as blank rather than throwing', () => {
    expect(cellKind(undefined)).toBe('blank');
  });

  it.each(['on_time', 'late', 'absent', 'holiday'])('carries the server\'s own word for %s', (status) => {
    expect(cellKind({ status } as any)).toBe(status);
    expect(isRecorded({ status } as any)).toBe(true);
    expect(DAY_TONE[status]).toBeTruthy();
  });

  it('falls back to blank on a status it has never seen', () => {
    // The server is free to add a word. A month that fails to draw would be a
    // worse answer than one plain cell.
    expect(cellKind({ status: 'half_day' } as any)).toBe('blank');
  });

  it('every tone has a colour and a label', () => {
    Object.values(DAY_TONE).forEach((tone) => {
      expect(tone.bg).toMatch(/^#|rgb/);
      expect(tone.text).toMatch(/^#|rgb/);
      expect(tone.label.length).toBeGreaterThan(0);
    });
  });
});
