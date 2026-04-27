import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { ReportsPage } from './ReportsPage'
import { api } from '../lib/api'
import { pollWithBackoff } from '../lib/poll'

vi.mock('../components/TopBar', () => ({
  TopBar: () => <div>TopBar</div>,
}))

vi.mock('../components/ReportsTable', () => ({
  ReportsTable: () => <div>ReportsTable</div>,
}))

vi.mock('../components/UploadModal', () => ({
  UploadModal: () => null,
}))

vi.mock('../hooks/useDocuments', () => ({
  useDocuments: () => ({
    documents: [
      {
        id: 'doc-processing',
        file_name: 'processing.pdf',
        lab_name: 'Lab',
        report_date: '2026-04-27',
        extraction_status: 'processing',
        created_at: '2026-04-27T00:00:00Z',
      },
    ],
    loading: false,
  }),
}))

vi.mock('../hooks/useHealthValues', () => ({
  useHealthValues: () => ({
    healthValues: [],
  }),
}))

vi.mock('../contexts/FamilyMemberContext', () => ({
  useFamilyMember: () => ({
    activeMemberId: null,
    activeMemberName: 'Self',
    setActiveMemberId: vi.fn(),
    members: [],
  }),
}))

vi.mock('../lib/api', () => ({
  api: {
    documents: {
      list: vi.fn(),
    },
  },
}))

vi.mock('../lib/poll', () => ({
  pollWithBackoff: vi.fn(),
}))

const mockDocumentsList = vi.mocked(api.documents.list)
const mockPollWithBackoff = vi.mocked(pollWithBackoff)

function renderReportsPage(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ReportsPage polling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('refreshes health values only after document polling reaches a terminal status', async () => {
    const pollStepRef: { current: (() => Promise<boolean>) | null } = { current: null }
    mockPollWithBackoff.mockImplementation((fn) => {
      pollStepRef.current = fn
      return Promise.resolve()
    })
    mockDocumentsList.mockResolvedValue({
      items: [
        {
          id: 'doc-processing',
          file_name: 'processing.pdf',
          lab_name: 'Lab',
          report_date: '2026-04-27',
          extraction_status: 'complete',
          created_at: '2026-04-27T00:00:00Z',
        },
      ],
      total: 1,
    } as never)

    const queryClient = new QueryClient()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined)
    renderReportsPage(queryClient)

    await waitFor(() => {
      expect(pollStepRef.current).not.toBeNull()
    })

    const pollStep = pollStepRef.current
    if (!pollStep) throw new Error('poll step was not registered')
    await pollStep()

    const healthValuesRefreshOrder = invalidateQueries.mock.invocationCallOrder.find((_, index) => {
      const [arg] = invalidateQueries.mock.calls[index]
      return JSON.stringify(arg) === JSON.stringify({ queryKey: ['health-values'] })
    })
    const documentListOrder = mockDocumentsList.mock.invocationCallOrder[0]

    expect(healthValuesRefreshOrder).toBeGreaterThan(documentListOrder)
  })
})
