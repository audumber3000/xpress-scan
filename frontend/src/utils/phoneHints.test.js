import { describe, it, expect } from 'vitest'
import { phoneHint } from './phoneHints'

describe('phoneHint', () => {
  it('says nothing while the number is still short', () => {
    expect(phoneHint('123', 'IN', '+91')).toBeNull()
  })

  // The exact incident documented at the top of phoneHints.js: a US-set
  // clinic entered a number whose area code doesn't exist, MSG91 accepted
  // the send anyway, and the clinic never got a working code.
  it('blocks a US number whose area code cannot exist', () => {
    const hint = phoneHint('1758203919', 'US', '+1')
    expect(hint).not.toBeNull()
    expect(hint.level).toBe('blocked')
  })

  it('allows a valid US number through', () => {
    expect(phoneHint('4155552671', 'US', '+1')).toBeNull()
  })

  it('warns when a number is short for a country with a known length', () => {
    const hint = phoneHint('12345', 'IN', '+91')
    expect(hint).not.toBeNull()
    expect(hint.level).toBe('warn')
  })

  it('warns when a number is long for a country with a known length', () => {
    const hint = phoneHint('98765432109876', 'IN', '+91')
    expect(hint).not.toBeNull()
    expect(hint.level).toBe('warn')
  })

  it('says nothing for a country whose length we do not actually know', () => {
    // Not in NATIONAL_LENGTHS — must not fall back to guessing against 10
    // and warning on a real number (the Lebanon incident in the file's comment).
    expect(phoneHint('123456789012', 'LB', '+961')).toBeNull()
  })

  it('accepts a correctly-lengthed Indian number', () => {
    expect(phoneHint('9876543210', 'IN', '+91')).toBeNull()
  })

  it('strips a leading trunk zero before checking length', () => {
    expect(phoneHint('09876543210', 'IN', '+91')).toBeNull()
  })
})
