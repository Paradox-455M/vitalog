import { describe, expect, it, vi } from 'vitest'

describe('parseLayer2Findings', () => {
  it('reads findings from the Layer 2 root persisted in explanation_text', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

    const { parseLayer2Findings } = await import('./BiomarkerLibraryPage')

    const findings = parseLayer2Findings(JSON.stringify({
      findings: [
        {
          canonical_name: 'vitamin_b12_cyanocobalamin_eclia',
          plain_explanation: 'This test measures Vitamin B12, which is vital for nerve function and making red blood cells.',
          reference_range: '211.00 - 946.00 pg/mL',
        },
      ],
    }))

    expect(findings).toEqual([
      {
        canonical_name: 'vitamin_b12_cyanocobalamin_eclia',
        plain_explanation: 'This test measures Vitamin B12, which is vital for nerve function and making red blood cells.',
        reference_range: '211.00 - 946.00 pg/mL',
      },
    ])
  })

  it('keeps support for older wrapped layer2 findings', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'http://127.0.0.1:54321')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

    const { parseLayer2Findings } = await import('./BiomarkerLibraryPage')

    const findings = parseLayer2Findings(JSON.stringify({
      layer2: {
        findings: [
          {
            canonical_name: 'hemoglobin',
            plain_explanation: 'Hemoglobin is the protein in your blood that carries oxygen.',
            reference_range: '12.00 - 15.00 g/dL',
          },
        ],
      },
    }))

    expect(findings).toEqual([
      {
        canonical_name: 'hemoglobin',
        plain_explanation: 'Hemoglobin is the protein in your blood that carries oxygen.',
        reference_range: '12.00 - 15.00 g/dL',
      },
    ])
  })
})
