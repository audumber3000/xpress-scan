import { describe, it, expect } from 'vitest'
import { readToothState, deriveStatus } from './dentalConstants'

describe('readToothState', () => {
  it('reads the axes the web wrote, when status agrees with them', () => {
    const tooth = { condition: 'fractured', work: 'planned', workType: 'crown_porcelain' }
    tooth.status = deriveStatus(tooth)
    expect(readToothState(tooth)).toEqual({ condition: 'fractured', work: 'planned', workType: 'crown_porcelain' })
  })

  // The phone app writes only `status`. A tooth edited once on the web used to
  // be frozen for it: the web kept trusting its own axes and ignored the change.
  it('lets a status changed on a phone win over stale axes', () => {
    const tooth = { condition: 'sound', work: 'planned', workType: null, status: 'missing' }
    expect(readToothState(tooth)).toEqual({ condition: 'missing', work: null, workType: null })
  })

  it('reads a phone-set existing root canal', () => {
    const tooth = { condition: 'sound', work: null, workType: null, status: 'rootCanal' }
    expect(readToothState(tooth)).toEqual({ condition: 'sound', work: 'existing', workType: 'root_canal' })
  })

  it('reads axes with no status as the axes', () => {
    expect(readToothState({ condition: 'impacted' })).toEqual({ condition: 'impacted', work: null, workType: null })
  })

  it('still reads a chart from before the axes existed', () => {
    expect(readToothState({ status: 'implant' })).toEqual({ condition: 'sound', work: 'existing', workType: 'implant' })
  })

  it('treats a present tooth with sound axes as unchanged', () => {
    expect(readToothState({ condition: 'sound', work: null, status: 'present' })).toEqual({ condition: 'sound', work: null, workType: null })
  })
})
