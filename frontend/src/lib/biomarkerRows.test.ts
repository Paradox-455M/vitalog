import { describe, expect, it } from 'vitest'
import { biomarkerRowFromLatest } from './biomarkerRows'
import type { HealthValue } from './api'

function healthValue(overrides: Partial<HealthValue> = {}): HealthValue {
  return {
    id: 'hv-1',
    document_id: 'doc-1',
    family_member_id: null,
    canonical_name: 'haemoglobin',
    display_name: 'Hemoglobin',
    value: 11.8,
    unit: 'g/dL',
    reference_low: 12,
    reference_high: 15,
    is_flagged: true,
    report_date: '2026-04-26',
    created_at: '2026-04-26T00:00:00Z',
    ...overrides,
  }
}

describe('biomarkerRowFromLatest', () => {
  it('uses Layer 2 plain explanations for catalog biomarkers when available', () => {
    const row = biomarkerRowFromLatest(
      healthValue(),
      'Hemoglobin is the protein in your blood that carries oxygen from your lungs to the rest of your body.',
    )

    expect(row.description).toBe(
      'Hemoglobin is the protein in your blood that carries oxygen from your lungs to the rest of your body.',
    )
  })

  it('keeps catalog descriptions when no Layer 2 explanation is available', () => {
    const row = biomarkerRowFromLatest(healthValue())

    expect(row.description).toContain('iron-containing protein')
  })
})
