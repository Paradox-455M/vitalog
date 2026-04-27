import { describe, expect, it } from 'vitest'
import { biomarkerRowFromLatest, formatReferenceRange } from './biomarkerRows'
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

  it('uses Layer 2 reference ranges for catalog biomarkers when available', () => {
    const row = biomarkerRowFromLatest(
      healthValue(),
      undefined,
      '12.00 - 15.00 g/dL',
    )

    expect(row.normal_range_male).toBe('12.00 - 15.00 g/dL')
    expect(row.normal_range_female).toBe('12.00 - 15.00 g/dL')
  })

  it('formats high-only numeric report ranges as upper-bound ranges', () => {
    const range = formatReferenceRange(healthValue({
      canonical_name: 'alkaline_phosphatase_alp_ifcc',
      display_name: 'Alkaline Phosphatase (ALP) (IFCC)',
      reference_low: null,
      reference_high: 98,
      unit: 'U/L',
    }))

    expect(range).toBe('<98 U/L')
  })

  it('formats low-only numeric report ranges as lower-bound ranges', () => {
    const range = formatReferenceRange(healthValue({
      canonical_name: 'hdl_cholesterol_homogenous_enzymatic_colorimetric',
      display_name: 'HDL Cholesterol (Homogenous Enzymatic Colorimetric)',
      reference_low: 50,
      reference_high: null,
      unit: 'mg/dL',
    }))

    expect(range).toBe('>50 mg/dL')
  })
})
