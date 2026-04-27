// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { BiomarkerDetailDrawer } from './BiomarkerDetailDrawer'
import type { BiomarkerEntry } from '../types/biomarkers'

const biomarker: BiomarkerEntry = {
  id: 'bm-basophils',
  canonical_name: 'basophils',
  display_name: 'Basophils %',
  aliases: [],
  category: 'Other',
  normal_range_male: '0.02 - 0.10 %',
  normal_range_female: '0.02 - 0.10 %',
  description: 'Basophils are white blood cells involved in allergic reactions and inflammation.',
  causes_high: [],
  causes_low: [],
}

describe('BiomarkerDetailDrawer', () => {
  it('shows reference range directly without male or female labels', () => {
    render(
      <MemoryRouter>
        <BiomarkerDetailDrawer
          biomarker={biomarker}
          isOpen
          onClose={vi.fn()}
          latestValue={null}
        />
      </MemoryRouter>,
    )

    expect(screen.getByText('0.02 - 0.10 %')).toBeTruthy()
    expect(screen.queryByText('Male')).toBeNull()
    expect(screen.queryByText('Female')).toBeNull()
  })
})
