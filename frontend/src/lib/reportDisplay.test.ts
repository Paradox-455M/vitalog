import { describe, it, expect } from 'vitest'
import { getReportPrimaryTitle, getReportSubtitle, isCrypticFileName } from './reportDisplay'

describe('isCrypticFileName', () => {
  it('detects UUID-like basenames', () => {
    expect(isCrypticFileName('a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf')).toBe(true)
  })

  it('allows human-readable names', () => {
    expect(isCrypticFileName('CBC_March_2026.pdf')).toBe(false)
  })
})

describe('getReportPrimaryTitle', () => {
  it('prefers lab and date', () => {
    expect(getReportPrimaryTitle('Acme Labs', '2026-05-01', 'uuid.pdf')).toMatch(/Acme Labs/)
    expect(getReportPrimaryTitle('Acme Labs', '2026-05-01', 'uuid.pdf')).toMatch(/2026/)
  })

  it('uses friendly filename with date when no lab', () => {
    expect(getReportPrimaryTitle(null, '2026-05-01', 'Home_CBC.pdf')).toContain('Home CBC')
  })
})

describe('getReportSubtitle', () => {
  it('returns null for cryptic uploads', () => {
    expect(getReportSubtitle('Lab', '2026-05-01', 'deadbeef-1234-1234-1234-123456789012.pdf')).toBeNull()
  })
})
