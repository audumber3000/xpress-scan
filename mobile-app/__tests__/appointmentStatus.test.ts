import { normalizeStatus, isOpen, isTerminal, statusMeta } from '../src/shared/constants/appointmentStatus';

describe('appointment status', () => {
  it('passes the server vocabulary through', () => {
    for (const s of ['scheduled', 'confirmed', 'arrived', 'completed', 'no_show', 'cancelled']) {
      expect(normalizeStatus(s)).toBe(s);
    }
  });

  it('maps the words older builds and records used', () => {
    expect(normalizeStatus('accepted')).toBe('scheduled');
    expect(normalizeStatus('checking')).toBe('arrived');
    expect(normalizeStatus('Registered')).toBe('arrived');
    expect(normalizeStatus('finished')).toBe('completed');
    expect(normalizeStatus('rejected')).toBe('cancelled');
    expect(normalizeStatus('no-show')).toBe('no_show');
  });

  it('never swallows an unknown value', () => {
    expect(normalizeStatus('something new')).toBe('scheduled');
    expect(normalizeStatus(undefined)).toBe('scheduled');
  });

  it('counts completed and no-show as done, which the home screen did not', () => {
    expect(isOpen('arrived')).toBe(true);
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('no_show')).toBe(true);
    expect(isOpen('confirmed')).toBe(true);
  });

  it('has a label for every status', () => {
    expect(statusMeta('no_show').label).toBe('No-show');
    expect(statusMeta('checking').label).toBe('Arrived');
  });
});
