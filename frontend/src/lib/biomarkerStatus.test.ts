import { describe, it, expect } from 'vitest'
import { classifyBiomarkerStatus, biomarkerStatusLabel } from './biomarkerStatus'

describe('classifyBiomarkerStatus', () => {
  it('classifies high values', () => {
    expect(classifyBiomarkerStatus({ value: 100, reference_low: 0, reference_high: 40 })).toBe('above')
  })

  it('classifies low values', () => {
    expect(classifyBiomarkerStatus({ value: 2, reference_low: 12, reference_high: 16 })).toBe('below')
  })

  it('classifies ambiguous flagged as outside', () => {
    expect(classifyBiomarkerStatus({ value: 5, reference_low: null, reference_high: null })).toBe('outside')
  })
})

describe('biomarkerStatusLabel', () => {
  it('returns user-facing strings', () => {
    expect(biomarkerStatusLabel('above')).toBe('Above reference')
    expect(biomarkerStatusLabel('below')).toBe('Below reference')
    expect(biomarkerStatusLabel('outside')).toBe('Outside reference')
  })
})
