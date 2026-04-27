import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UploadModal } from './UploadModal'
import { api } from '../lib/api'
import { pollWithBackoff } from '../lib/poll'

vi.mock('../lib/api', () => ({
  api: {
    profile: { get: vi.fn() },
    documents: { upload: vi.fn(), get: vi.fn() },
  },
  ApiError: class ApiError extends Error {
    status: number
    body: unknown
    constructor(message: string, status: number, body: unknown) {
      super(message)
      this.status = status
      this.body = body
    }
  },
}))

vi.mock('../lib/poll', () => ({
  pollWithBackoff: vi.fn(),
}))

vi.mock('../hooks/useProfile', () => ({
  FREE_TIER_MAX_DOCUMENTS: 3,
}))

const mockProfileGet = vi.mocked(api.profile.get)
const mockDocumentsUpload = vi.mocked(api.documents.upload)
const mockDocumentsGet = vi.mocked(api.documents.get)
const mockPollWithBackoff = vi.mocked(pollWithBackoff)

function renderModal(props: Partial<React.ComponentProps<typeof UploadModal>> = {}) {
  return render(
    <MemoryRouter>
      <UploadModal isOpen={true} onClose={vi.fn()} {...props} />
    </MemoryRouter>,
  )
}

function selectFile(file: File) {
  const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(fileInput, { target: { files: [file] } })
}

const fakePdf = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' })

describe('UploadModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows file picker when free user has uploads remaining', async () => {
    mockProfileGet.mockResolvedValue({ plan: 'free', document_count: 1 } as never)
    renderModal()

    await waitFor(() => {
      expect(screen.getByText('Drop your report here')).toBeInTheDocument()
    })
    expect(screen.queryByText(/View plans/)).not.toBeInTheDocument()
  })

  it('shows upgrade prompt when free user has hit the upload limit', async () => {
    mockProfileGet.mockResolvedValue({ plan: 'free', document_count: 3 } as never)
    renderModal()

    await waitFor(() => {
      // Title changes to 'Upload limit reached' when freeLimitBlocked is true
      expect(screen.getByText('Upload limit reached')).toBeInTheDocument()
    })
    expect(screen.getByText('View plans & upgrade')).toBeInTheDocument()
    expect(screen.queryByText('Drop your report here')).not.toBeInTheDocument()
  })

  it('pro user is never blocked regardless of document count', async () => {
    mockProfileGet.mockResolvedValue({ plan: 'pro', document_count: 100 } as never)
    renderModal()

    await waitFor(() => {
      expect(screen.getByText('Drop your report here')).toBeInTheDocument()
    })
  })

  it('transitions to extracting state after upload resolves', async () => {
    mockProfileGet.mockResolvedValue({ plan: 'free', document_count: 0 } as never)
    mockDocumentsUpload.mockResolvedValue({
      id: 'doc-1',
      extraction_status: 'processing',
      health_values: [],
    } as never)
    // Never resolve so the component stays in 'extracting'
    mockPollWithBackoff.mockReturnValue(new Promise(() => {}))

    renderModal()

    await waitFor(() => {
      expect(screen.getByText('Drop your report here')).toBeInTheDocument()
    })

    selectFile(fakePdf)

    await waitFor(() => {
      expect(screen.getByText('AI is reading your report…')).toBeInTheDocument()
    })
  })

  it('shows complete state when extraction succeeds', async () => {
    mockProfileGet.mockResolvedValue({ plan: 'free', document_count: 0 } as never)
    mockDocumentsUpload.mockResolvedValue({
      id: 'doc-1',
      extraction_status: 'processing',
      health_values: [],
    } as never)
    mockDocumentsGet.mockResolvedValue({
      id: 'doc-1',
      extraction_status: 'complete',
      health_values: [
        { is_flagged: false },
        { is_flagged: true },
        { is_flagged: false },
      ],
    } as never)
    mockPollWithBackoff.mockImplementation(async (fn) => {
      await fn()
    })

    const onUploadComplete = vi.fn()
    renderModal({ onUploadComplete })

    await waitFor(() => {
      expect(screen.getByText('Drop your report here')).toBeInTheDocument()
    })

    selectFile(fakePdf)

    await waitFor(() => {
      expect(screen.getByText('Report processed!')).toBeInTheDocument()
    })
    expect(screen.getByText(/3 values extracted/)).toBeInTheDocument()
    expect(screen.getByText(/1 flagged/)).toBeInTheDocument()
    expect(onUploadComplete).toHaveBeenCalledTimes(1)
  })

  it('shows failed state when extraction returns failed status', async () => {
    mockProfileGet.mockResolvedValue({ plan: 'free', document_count: 0 } as never)
    mockDocumentsUpload.mockResolvedValue({
      id: 'doc-1',
      extraction_status: 'processing',
      health_values: [],
    } as never)
    mockDocumentsGet.mockResolvedValue({
      id: 'doc-1',
      extraction_status: 'failed',
      health_values: [],
    } as never)
    mockPollWithBackoff.mockImplementation(async (fn) => {
      await fn()
    })

    renderModal()

    await waitFor(() => {
      expect(screen.getByText('Drop your report here')).toBeInTheDocument()
    })

    selectFile(fakePdf)

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
    expect(
      screen.getByText('Extraction failed. Please try again with a clearer file.'),
    ).toBeInTheDocument()
  })
})
