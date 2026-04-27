import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import type { ReportRow, FlaggedValue } from '../components/ReportCard'
import { ReportsTable } from '../components/ReportsTable'
import { TopBar } from '../components/TopBar'
import { UploadModal } from '../components/UploadModal'
import { useDocuments } from '../hooks/useDocuments'
import { useHealthValues } from '../hooks/useHealthValues'
import { useFamilyMember } from '../contexts/FamilyMemberContext'
import { api, type PaginatedDocuments } from '../lib/api'
import { pollWithBackoff } from '../lib/poll'

type DateRange = 'all' | '30days' | '3months' | '6months' | '1year'
type DocTypeFilter = 'all' | 'blood_test' | 'scan' | 'prescription'

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '30days', label: 'Last 30 days' },
  { value: '3months', label: 'Last 3 months' },
  { value: '6months', label: 'Last 6 months' },
  { value: '1year', label: 'Last year' },
]

const DOC_TYPE_PILLS: { value: DocTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'blood_test', label: 'Blood' },
  { value: 'scan', label: 'Scan' },
  { value: 'prescription', label: 'Prescription' },
]

const PAGE_SIZE = 10

function getDateRangeCutoff(range: DateRange): Date | null {
  if (range === 'all') return null
  const now = new Date()
  switch (range) {
    case '30days':
      return new Date(now.setDate(now.getDate() - 30))
    case '3months':
      return new Date(now.setMonth(now.getMonth() - 3))
    case '6months':
      return new Date(now.setMonth(now.getMonth() - 6))
    case '1year':
      return new Date(now.setFullYear(now.getFullYear() - 1))
    default:
      return null
  }
}

function matchesDocType(r: ReportRow, f: DocTypeFilter): boolean {
  if (f === 'all') return true
  const t = (r.document_type ?? '').toLowerCase()
  const name = r.file_name.toLowerCase()
  if (f === 'blood_test') {
    if (t === 'blood_test') return true
    if (!t || t === 'other') {
      return /cbc|blood|hemogram|lipid|metabolic|thyroid|liver|kidney|hba1c|glucose/i.test(name)
    }
    return false
  }
  if (f === 'scan') return t === 'scan'
  if (f === 'prescription') return t === 'prescription'
  return false
}

export function ReportsPage() {
  const [searchParams] = useSearchParams()
  const { activeMemberId } = useFamilyMember()
  const familyFilterId = searchParams.get('family_member_id') ?? activeMemberId ?? null
  const queryClient = useQueryClient()

  const { documents, loading } = useDocuments()
  const { healthValues: hvRows } = useHealthValues()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'complete' | 'processing' | 'failed'>('all')
  const [dateRange, setDateRange] = useState<DateRange>('all')
  const [docTypeFilter, setDocTypeFilter] = useState<DocTypeFilter>('all')
  const [labFilter, setLabFilter] = useState<string>('all')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [page, setPage] = useState(1)
  const [familyFilterName, setFamilyFilterName] = useState<string | null>(null)

  const reports = useMemo<ReportRow[]>(
    () => [...documents].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) as unknown as ReportRow[],
    [documents]
  )

  const flaggedMap = useMemo(() => {
    const docIds = new Set(reports.map((d) => d.id))
    const map = new Map<string, FlaggedValue[]>()
    for (const hv of hvRows) {
      if (!hv.is_flagged || !docIds.has(hv.document_id)) continue
      const arr = map.get(hv.document_id) ?? []
      arr.push({ id: hv.id, display_name: hv.display_name, value: hv.value, unit: hv.unit })
      map.set(hv.document_id, arr)
    }
    return map
  }, [reports, hvRows])

  useEffect(() => {
    if (!familyFilterId) {
      setFamilyFilterName(null) // eslint-disable-line react-hooks/set-state-in-effect
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const list = await api.family.list()
        if (cancelled) return
        const m = list.find((x) => x.id === familyFilterId)
        setFamilyFilterName(m?.name ?? null)
      } catch {
        if (!cancelled) setFamilyFilterName(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [familyFilterId])

  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    const active = reports.some(
      (r) => r.extraction_status === 'pending' || r.extraction_status === 'processing'
    )
    if (!active) return

    const controller = new AbortController()
    abortRef.current = controller
    const listParams = familyFilterId ? { family_member_id: familyFilterId } : undefined

    void pollWithBackoff(
      async () => {
        const latest = await api.documents.list(listParams)
        const latestById = new Map(latest.items.map((doc) => [doc.id, doc]))
        queryClient.setQueriesData<PaginatedDocuments>({ queryKey: ['documents'] }, (current) => {
          if (!current) return current
          return {
            ...current,
            items: current.items.map((doc) => latestById.get(doc.id) ?? doc),
          }
        })

        const complete = !latest.items.some(
          (r) => r.extraction_status === 'pending' || r.extraction_status === 'processing'
        )
        if (complete) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['health-values'] }),
            queryClient.invalidateQueries({ queryKey: ['notifications'] }),
          ])
        }
        return complete
      },
      controller.signal,
      { initial: 2000, max: 30_000, factor: 1.5 },
    )

    return () => controller.abort()
  }, [familyFilterId, reports, queryClient])

  const uniqueLabs = useMemo(() => {
    const labs = new Set(reports.map((r) => r.lab_name).filter(Boolean) as string[])
    return Array.from(labs).sort()
  }, [reports])

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const matchFamily =
        !familyFilterId || (r.family_member_id ?? null) === familyFilterId
      const matchSearch =
        r.file_name.toLowerCase().includes(search.toLowerCase()) ||
        (r.lab_name ?? '').toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || r.extraction_status === statusFilter
      const dateCutoff = getDateRangeCutoff(dateRange)
      const matchDate =
        !dateCutoff || (r.report_date ? new Date(r.report_date) >= dateCutoff : false)
      const matchDocType = matchesDocType(r, docTypeFilter)
      const matchLab = labFilter === 'all' || r.lab_name === labFilter
      return (
        matchFamily && matchSearch && matchStatus && matchDate && matchDocType && matchLab
      )
    })
  }, [reports, familyFilterId, search, statusFilter, dateRange, docTypeFilter, labFilter])

  useEffect(() => {
    setPage(1) // eslint-disable-line react-hooks/set-state-in-effect
  }, [search, statusFilter, dateRange, docTypeFilter, labFilter, familyFilterId])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)

  useEffect(() => {
    if (page > totalPages) setPage(totalPages) // eslint-disable-line react-hooks/set-state-in-effect
  }, [page, totalPages])

  const pagedReports = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, safePage])

  const showingFrom = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
  const showingTo = Math.min(safePage * PAGE_SIZE, filtered.length)

  return (
    <div className="flex-1 h-screen overflow-y-auto scroll-smooth">
      <TopBar
        title="My Reports"
        subtitle={loading ? 'Loading…' : `${reports.length} report${reports.length !== 1 ? 's' : ''} uploaded`}
        ctaLabel="Upload report"
        onCtaClick={() => setShowUploadModal(true)}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
        {familyFilterId && (
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5"
            role="status"
          >
            <p className="text-sm text-on-surface">
              <span className="font-semibold">Filtered by family member: </span>
              {familyFilterName ?? 'Loading…'}
            </p>
            <Link
              to="/reports"
              className="text-sm font-semibold text-primary hover:underline shrink-0"
            >
              Show all reports
            </Link>
          </div>
        )}

        <div className="flex justify-center">
          <div className="relative w-full max-w-md">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">
              search
            </span>
            <input
              type="search"
              placeholder="Search by name or lab..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-lowest border border-outline-variant rounded-lg text-sm focus:ring-1 focus:ring-primary-container focus:outline-none"
            />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-4 mb-6">
            <div className="flex bg-surface-container-lowest border border-outline-variant rounded-lg p-1">
              {DOC_TYPE_PILLS.map((pill) => (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setDocTypeFilter(pill.value)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-md transition-colors ${
                    docTypeFilter === pill.value
                      ? 'bg-primary-container text-on-primary'
                      : 'text-outline hover:bg-surface-container font-medium'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as DateRange)}
                className="appearance-none flex items-center gap-2 bg-surface-container-lowest border border-outline-variant rounded-lg pl-4 pr-10 py-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {DATE_RANGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none text-lg">
                expand_more
              </span>
            </div>

            {uniqueLabs.length > 0 && (
              <div className="relative">
                <select
                  value={labFilter}
                  onChange={(e) => setLabFilter(e.target.value)}
                  className="appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg pl-4 pr-10 py-2 text-xs font-medium text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                >
                  <option value="all">All labs</option>
                  {uniqueLabs.map((lab) => (
                    <option key={lab} value={lab}>
                      {lab}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none text-lg">
                  expand_more
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(['all', 'complete', 'processing', 'failed'] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors capitalize ${
                statusFilter === status
                  ? 'bg-primary text-white'
                  : 'bg-surface-container text-stone-600 hover:bg-surface-container-high'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {!loading && filtered.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <span className="material-symbols-outlined text-6xl text-outline/30">description</span>
            <p className="text-xl font-serif font-bold text-on-surface">
              {reports.length === 0 ? 'No reports yet' : 'No reports match your filters'}
            </p>
            <p className="text-stone-500 text-sm">
              {reports.length === 0
                ? 'Upload your first health report to get started.'
                : 'Try adjusting your search or filters.'}
            </p>
            {reports.length === 0 && (
              <button
                type="button"
                className="mt-4 px-6 py-3 bg-primary text-white rounded-full font-semibold text-sm"
                onClick={() => setShowUploadModal(true)}
              >
                Upload report
              </button>
            )}
          </div>
        ) : (
          <>
            <ReportsTable
              reports={pagedReports}
              flaggedMap={flaggedMap}
              loading={loading}
              onDelete={async (id) => {
                await api.documents.delete(id)
                await queryClient.invalidateQueries({ queryKey: ['documents'] })
                await queryClient.invalidateQueries({ queryKey: ['health-values'] })
              }}
            />

            {!loading && filtered.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                <p className="text-sm text-on-surface-variant">
                  Showing {showingFrom}–{showingTo} of {filtered.length} report
                  {filtered.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant text-sm font-medium disabled:opacity-40"
                  >
                    Prev
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`min-w-[2.25rem] py-1.5 rounded-lg text-sm font-medium ${
                        safePage === n
                          ? 'bg-primary text-white'
                          : 'border border-outline-variant hover:bg-surface-container'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant text-sm font-medium disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  )
}
