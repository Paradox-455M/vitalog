import { useCallback, useMemo, useState, useEffect, useId } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/authContext'
import { ReportCard, type ReportRow, type FlaggedValue } from '../components/ReportCard'
import { UploadModal } from '../components/UploadModal'
import { TopBar } from '../components/TopBar'
import { useDocuments } from '../hooks/useDocuments'
import { useHealthValues } from '../hooks/useHealthValues'
import { useProfile } from '../hooks/useProfile'
import { useFamilyMember } from '../contexts/FamilyMemberContext'
import { greetingFirstName } from '../lib/accountDisplay'
import {
  biomarkerSnapshotChipClass,
  biomarkerStatusIcon,
  biomarkerStatusLabel,
  classifyBiomarkerStatus,
} from '../lib/biomarkerStatus'
import { api } from '../lib/api'
import type { HealthValue, DashboardStats, PaginatedDocuments } from '../lib/api'
import { pollWithBackoff } from '../lib/poll'

type FlaggedValueRow = Pick<
  HealthValue,
  'id' | 'document_id' | 'display_name' | 'value' | 'unit' | 'reference_low' | 'reference_high'
>

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function SkeletonStat() {
  return <div className="bg-stat-card p-6 rounded-xl h-32 animate-pulse" />
}

function FlaggedRowChip({ hv }: { hv: FlaggedValueRow }) {
  const kind = classifyBiomarkerStatus(hv)
  const label = biomarkerStatusLabel(kind)
  const icon = biomarkerStatusIcon(kind)
  return (
    <span
      className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 flex items-center gap-1 ${biomarkerSnapshotChipClass(kind)}`}
    >
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  )
}

export function DashboardPage() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const { profile, loading: profileLoading } = useProfile()
  const { activeMemberId } = useFamilyMember()
  const familyOpt = activeMemberId ? { familyMemberId: activeMemberId } : undefined
  const { documents, loading: docsLoading } = useDocuments(familyOpt)
  const { healthValues: allHealthValues, loading: hvLoading } = useHealthValues(familyOpt)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [apiStats, setApiStats] = useState<DashboardStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [fullListOpen, setFullListOpen] = useState(false)
  const execHeadingId = useId()
  const fullListSectionId = useId()

  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const stats = await api.dashboard.stats(activeMemberId ? { family_member_id: activeMemberId } : undefined)
      setApiStats(stats)
    } catch {
      setApiStats(null)
    } finally {
      setStatsLoading(false)
    }
  }, [activeMemberId])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const loading = docsLoading || hvLoading

  const sortedDocuments = useMemo(
    () => [...documents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [documents],
  )

  const recentReports = useMemo(() => sortedDocuments.slice(0, 3) as ReportRow[], [sortedDocuments])

  const hasActiveExtraction = useMemo(
    () => documents.some((doc) => doc.extraction_status === 'pending' || doc.extraction_status === 'processing'),
    [documents],
  )

  useEffect(() => {
    if (!hasActiveExtraction) return

    const controller = new AbortController()
    const listParams = activeMemberId ? { family_member_id: activeMemberId } : undefined

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
          (doc) => doc.extraction_status === 'pending' || doc.extraction_status === 'processing',
        )
        if (complete) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['health-values'] }),
            queryClient.invalidateQueries({ queryKey: ['notifications'] }),
            loadStats(),
          ])
        }
        return complete
      },
      controller.signal,
      { initial: 2000, max: 30_000, factor: 1.5 },
    )

    return () => controller.abort()
  }, [activeMemberId, hasActiveExtraction, loadStats, queryClient])

  const recentFlaggedMap = useMemo(() => {
    const map = new Map<string, FlaggedValue[]>()
    const recentIds = new Set(recentReports.map((r) => r.id))
    for (const hv of allHealthValues) {
      if (!hv.is_flagged || !recentIds.has(hv.document_id)) continue
      const arr = map.get(hv.document_id) ?? []
      arr.push({
        id: hv.id,
        display_name: hv.display_name,
        value: hv.value,
        unit: hv.unit,
        reference_low: hv.reference_low,
        reference_high: hv.reference_high,
      })
      map.set(hv.document_id, arr)
    }
    return map
  }, [allHealthValues, recentReports])

  const allFlaggedList = useMemo(() => allHealthValues.filter((v) => v.is_flagged), [allHealthValues])

  const snapshotFlagged = useMemo(() => allFlaggedList.slice(0, 5), [allFlaggedList])

  const flaggedBuckets = useMemo(() => {
    let above = 0
    let below = 0
    let outside = 0
    for (const v of allFlaggedList) {
      if (v.reference_high !== null && v.value > v.reference_high) above++
      else if (v.reference_low !== null && v.value < v.reference_low) below++
      else outside++
    }
    return { above, below, outside }
  }, [allFlaggedList])

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetName = greetingFirstName(profile, user, profileLoading)

  const dataReady = !statsLoading && !loading
  const reportCount = apiStats?.report_count ?? 0
  const flaggedCountStat = apiStats?.flagged_count ?? 0
  const valuesTracked = apiStats?.values_tracked ?? 0

  return (
    <div className="flex-1 h-screen overflow-y-auto scroll-smooth">
      <TopBar
        title={greetName ? `${greeting}, ${greetName}` : greeting}
        subtitle="Here's your health summary."
        ctaLabel="Upload report"
        onCtaClick={() => setShowUploadModal(true)}
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-12 max-w-[1440px] mx-auto space-y-8 lg:space-y-10">
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {statsLoading ? (
            <>
              <SkeletonStat />
              <SkeletonStat />
              <SkeletonStat />
              <SkeletonStat />
            </>
          ) : (
            <>
              <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Reports uploaded
                </span>
                <span className="text-4xl font-serif font-bold text-primary">{apiStats?.report_count ?? 0}</span>
              </div>
              <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Values tracked
                </span>
                <span className="text-4xl font-serif font-bold text-primary">{apiStats?.values_tracked ?? 0}</span>
              </div>
              <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Out of range
                </span>
                <span className="text-4xl font-serif font-bold text-amber">{apiStats?.flagged_count ?? 0}</span>
              </div>
              <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                  Last upload
                </span>
                <span className="text-2xl font-serif font-bold text-primary">
                  {formatRelativeDate(apiStats?.last_upload_at ?? null)}
                </span>
              </div>
            </>
          )}
        </section>

        {dataReady && (
          <section
            className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest/80 p-5 sm:p-6"
            aria-labelledby={execHeadingId}
          >
            <h2 id={execHeadingId} className="font-serif text-lg font-bold text-on-surface mb-2">
              At a glance
            </h2>
            {reportCount === 0 ? (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                Upload a lab report to build your dashboard. We will extract values, flag anything outside the lab
                reference range, and summarize it in plain language.
              </p>
            ) : flaggedCountStat === 0 ? (
              <p className="text-sm text-on-surface-variant leading-relaxed">
                You have <strong className="text-on-surface">{reportCount}</strong>{' '}
                {reportCount === 1 ? 'report' : 'reports'} on file and{' '}
                <strong className="text-on-surface">{valuesTracked}</strong> tracked results. Everything we parsed is
                within the lab reference range. Keep uploading new reports to track changes over time.
              </p>
            ) : (
              <>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  You have <strong className="text-on-surface">{reportCount}</strong>{' '}
                  {reportCount === 1 ? 'report' : 'reports'} and{' '}
                  <strong className="text-on-surface">{valuesTracked}</strong> tracked results.{' '}
                  <strong className="text-on-surface">{flaggedCountStat}</strong>{' '}
                  {flaggedCountStat === 1 ? 'is' : 'are'} outside the lab reference range and worth a closer look.
                </p>
                {(flaggedBuckets.above > 0 || flaggedBuckets.below > 0 || flaggedBuckets.outside > 0) && (
                  <ul className="mt-3 text-sm text-on-surface-variant list-disc pl-5 space-y-1">
                    {flaggedBuckets.above > 0 && (
                      <li>
                        <strong className="text-on-surface">{flaggedBuckets.above}</strong> above reference
                      </li>
                    )}
                    {flaggedBuckets.below > 0 && (
                      <li>
                        <strong className="text-on-surface">{flaggedBuckets.below}</strong> below reference
                      </li>
                    )}
                    {flaggedBuckets.outside > 0 && (
                      <li>
                        <strong className="text-on-surface">{flaggedBuckets.outside}</strong> flagged without a clear
                        high/low band (still review)
                      </li>
                    )}
                  </ul>
                )}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link
                    to="/timeline?filter=flagged"
                    className="text-sm text-primary font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                  >
                    View out-of-range on timeline
                  </Link>
                  <span className="text-on-surface-variant hidden sm:inline" aria-hidden="true">
                    ·
                  </span>
                  <Link
                    to="/reports"
                    className="text-sm text-primary font-bold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                  >
                    Open all reports
                  </Link>
                </div>
              </>
            )}
          </section>
        )}

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <section className="flex-1 lg:flex-[0.65] space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl font-bold">Recent reports</h2>
              <Link to="/reports" className="text-sm text-primary font-bold hover:underline">
                View all
              </Link>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="h-32 rounded-xl bg-surface-container animate-pulse" />
                  ))}
                </div>
              ) : recentReports.length === 0 ? (
                <div className="text-center py-16 space-y-4">
                  <span className="material-symbols-outlined text-5xl text-outline/30">description</span>
                  <p className="font-serif text-lg font-bold text-on-surface">No reports yet</p>
                  <p className="text-on-surface-variant text-sm">Upload your first health report to get started.</p>
                  <button
                    type="button"
                    className="mt-2 px-5 py-2.5 bg-primary text-white rounded-full font-semibold text-sm"
                    onClick={() => setShowUploadModal(true)}
                  >
                    Upload report
                  </button>
                </div>
              ) : (
                recentReports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    flaggedValues={recentFlaggedMap.get(report.id)}
                    onMenuClick={() => undefined}
                  />
                ))
              )}
            </div>
          </section>

          <section className="flex-1 lg:flex-[0.35] space-y-6">
            <h2 className="font-serif text-2xl font-bold">Health snapshot</h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-20 rounded-xl bg-surface-container animate-pulse" />
                ))}
              </div>
            ) : snapshotFlagged.length === 0 ? (
              <div className="bg-secondary-container/40 rounded-xl p-6 text-center space-y-2">
                <span
                  className="material-symbols-outlined text-primary text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <p className="font-semibold text-on-surface text-sm">No out-of-range values</p>
                <p className="text-on-surface-variant text-xs">
                  {apiStats?.report_count === 0
                    ? 'Upload a report to see your health snapshot.'
                    : 'All tracked results are within lab reference ranges.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {snapshotFlagged.map((hv) => (
                  <div
                    key={hv.id}
                    className="bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between gap-3 border border-outline-variant/10"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-0.5 truncate">
                        {hv.display_name}
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-on-surface">{hv.value}</span>
                        {hv.unit && <span className="text-xs text-on-surface-variant">{hv.unit}</span>}
                      </div>
                    </div>
                    <FlaggedRowChip hv={hv} />
                  </div>
                ))}
                {allFlaggedList.length > 5 && (
                  <Link
                    to="/timeline?filter=flagged"
                    className="text-xs text-primary font-semibold text-center block hover:underline"
                  >
                    +{allFlaggedList.length - 5} more out of range — view all
                  </Link>
                )}
              </div>
            )}

            <Link
              to="/timeline"
              className="block text-center py-4 text-primary font-bold text-sm hover:underline tracking-tight"
            >
              View full timeline →
            </Link>

            <Link
              to="/timeline"
              className="block relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-forest p-6 text-white hover:opacity-95 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <h4 className="font-serif text-lg font-bold mb-2">Track your trends</h4>
              <p className="text-xs opacity-90 leading-relaxed mb-4">
                See how your biomarkers change over time across all your uploaded reports.
              </p>
              <div className="inline-flex items-center gap-1 text-xs font-bold opacity-90">
                <span>View Health Timeline</span>
                <span className="material-symbols-outlined text-sm" aria-hidden="true">
                  arrow_forward
                </span>
              </div>
            </Link>
          </section>
        </div>

        {!loading && allFlaggedList.length > 0 && (
          <section className="w-full" aria-label="Out-of-range results detail">
            <div className="bg-amber-light p-4 sm:p-6 lg:p-8 rounded-xl border border-amber/10">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                <div className="w-12 h-12 rounded-full bg-amber/10 flex items-center justify-center shrink-0">
                  <span
                    className="material-symbols-outlined text-amber"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    aria-hidden="true"
                  >
                    warning
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-2">
                    <h3 className="text-lg font-bold text-on-surface">
                      {allFlaggedList.length}{' '}
                      {allFlaggedList.length === 1 ? 'result is' : 'results are'} outside the lab reference range
                    </h3>
                    <button
                      type="button"
                      className="text-sm font-bold text-primary hover:underline shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
                      aria-expanded={fullListOpen}
                      aria-controls={fullListSectionId}
                      onClick={() => setFullListOpen((o) => !o)}
                    >
                      {fullListOpen ? 'Hide full list' : 'Show full list'}
                    </button>
                  </div>
                  <div
                    id={fullListSectionId}
                    className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mb-6 max-h-[min(28rem,70vh)] overflow-y-auto"
                    hidden={!fullListOpen}
                  >
                    {allFlaggedList.map((hv) => {
                      const kind = classifyBiomarkerStatus(hv)
                      const label = biomarkerStatusLabel(kind)
                      const icon = biomarkerStatusIcon(kind)
                      return (
                        <div
                          key={hv.id}
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-amber/10 pb-2 gap-2"
                        >
                          <span className="font-bold">{hv.display_name}</span>
                          <span className="text-on-surface font-semibold text-sm sm:text-base flex items-center gap-2 flex-wrap">
                            <span className="material-symbols-outlined text-base text-amber" aria-hidden="true">
                              {icon}
                            </span>
                            <span>
                              {hv.value} {hv.unit} — {label}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>
                  {!fullListOpen && (
                    <p className="text-sm text-on-surface-variant mb-4">
                      Use <strong className="text-on-surface">Show full list</strong> to see every out-of-range result,
                      or open the <Link to="/timeline?filter=flagged" className="text-primary font-bold hover:underline">timeline</Link>.
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-sm text-amber-text bg-surface w-fit max-w-full px-4 py-2 rounded-lg">
                    <span className="material-symbols-outlined text-[18px] shrink-0" aria-hidden="true">
                      info
                    </span>
                    <span>Worth discussing with your doctor during your next visit.</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <UploadModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
    </div>
  )
}
