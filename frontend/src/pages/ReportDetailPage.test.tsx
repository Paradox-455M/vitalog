import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ReportDetailPage } from './ReportDetailPage'
import { api } from '../lib/api'
import { pollWithBackoff } from '../lib/poll'

vi.mock('../lib/api', () => ({
  api: {
    documents: {
      get: vi.fn(),
      downloadFile: vi.fn(),
    },
  },
}))

vi.mock('../lib/poll', () => ({
  pollWithBackoff: vi.fn(),
}))

const mockDocumentsGet = vi.mocked(api.documents.get)
const mockDocumentsDownloadFile = vi.mocked(api.documents.downloadFile)
const mockPollWithBackoff = vi.mocked(pollWithBackoff)

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    file_name: 'blood_test.pdf',
    lab_name: 'Apollo',
    report_date: '2026-04-01',
    extraction_status: 'complete',
    explanation_text: null,
    storage_path: 'documents/user-1/doc-1.pdf',
    created_at: '2026-04-01T10:00:00Z',
    health_values: [],
    ...overrides,
  }
}

function renderAtRoute(id = 'doc-1') {
  return render(
    <MemoryRouter initialEntries={[`/reports/${id}`]}>
      <Routes>
        <Route path="/reports/:id" element={<ReportDetailPage />} />
        <Route path="/reports" element={<div>Reports list</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ReportDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDocumentsDownloadFile.mockResolvedValue('https://example.com/file.pdf')
  })

  it('shows loading skeleton while fetch is in flight', () => {
    // Never-resolving fetch keeps doc === undefined
    mockDocumentsGet.mockReturnValue(new Promise(() => {}))

    renderAtRoute()

    // LoadingSkeleton uses animate-pulse — verify a pulsing element is present
    const skeleton = document.querySelector('.animate-pulse')
    expect(skeleton).not.toBeNull()
  })

  it('shows not-found message when fetch throws', async () => {
    mockDocumentsGet.mockRejectedValue(new Error('not found'))

    renderAtRoute()

    await waitFor(() => {
      expect(screen.getByText('Report not found')).toBeInTheDocument()
    })
    expect(screen.getByText('Back to My Reports')).toBeInTheDocument()
  })

  it('shows processing state when extraction_status is pending', async () => {
    mockDocumentsGet.mockResolvedValue(makeDoc({ extraction_status: 'pending' }) as never)
    mockPollWithBackoff.mockReturnValue(new Promise(() => {}))

    renderAtRoute()

    await waitFor(() => {
      expect(screen.getByText('Analysing your report…')).toBeInTheDocument()
    })
    expect(screen.getByText(/blood_test\.pdf/)).toBeInTheDocument()
  })

  it('shows processing state when extraction_status is processing', async () => {
    mockDocumentsGet.mockResolvedValue(makeDoc({ extraction_status: 'processing' }) as never)
    mockPollWithBackoff.mockReturnValue(new Promise(() => {}))

    renderAtRoute()

    await waitFor(() => {
      expect(screen.getByText('Analysing your report…')).toBeInTheDocument()
    })
  })

  it('shows failed state when extraction_status is failed', async () => {
    mockDocumentsGet.mockResolvedValue(makeDoc({ extraction_status: 'failed' }) as never)

    renderAtRoute()

    await waitFor(() => {
      expect(screen.getByText('Extraction failed')).toBeInTheDocument()
    })
    expect(screen.getByText(/blood_test\.pdf/)).toBeInTheDocument()
  })

  it('shows download link in failed state when file URL is available', async () => {
    mockDocumentsGet.mockResolvedValue(makeDoc({ extraction_status: 'failed' }) as never)
    mockDocumentsDownloadFile.mockResolvedValue('https://cdn.example.com/doc.pdf')

    renderAtRoute()

    await waitFor(() => {
      expect(screen.getByText('Extraction failed')).toBeInTheDocument()
    })
    const downloadLink = screen.getByText('Download original').closest('a')
    expect(downloadLink).toHaveAttribute('href', 'https://cdn.example.com/doc.pdf')
  })

  it('renders complete report view when extraction_status is complete', async () => {
    mockDocumentsGet.mockResolvedValue(
      makeDoc({
        extraction_status: 'complete',
        explanation_text: null,
        health_values: [],
      }) as never,
    )

    renderAtRoute()

    await waitFor(() => {
      // Sticky "My Reports" breadcrumb link appears only in complete view
      expect(screen.getByRole('link', { name: 'My Reports' })).toBeInTheDocument()
    })
  })

  it('starts polling when document is in processing status', async () => {
    mockDocumentsGet.mockResolvedValue(makeDoc({ extraction_status: 'processing' }) as never)
    mockPollWithBackoff.mockReturnValue(new Promise(() => {}))

    renderAtRoute()

    await waitFor(() => {
      expect(mockPollWithBackoff).toHaveBeenCalledTimes(1)
    })

    const [, signal] = mockPollWithBackoff.mock.calls[0] as [unknown, AbortSignal]
    expect(signal.aborted).toBe(false)
  })

  it('aborts polling signal when component unmounts', async () => {
    mockDocumentsGet.mockResolvedValue(makeDoc({ extraction_status: 'processing' }) as never)

    let capturedSignal: AbortSignal | null = null
    mockPollWithBackoff.mockImplementation((_fn, signal) => {
      capturedSignal = signal as AbortSignal
      return new Promise(() => {})
    })

    const { unmount } = renderAtRoute()

    await waitFor(() => {
      expect(capturedSignal).not.toBeNull()
    })

    expect(capturedSignal!.aborted).toBe(false)
    unmount()
    expect(capturedSignal!.aborted).toBe(true)
  })
})
