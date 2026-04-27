import { useCallback, useMemo, useRef, useState, useEffect } from 'react'
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

function getStatusLabel(hv: FlaggedValueRow): string {
  if (hv.reference_high !== null && hv.value > hv.reference_high) return 'Elevated'
  if (hv.reference_low !== null && hv.value < hv.reference_low) return 'Low'
  return 'Flagged'
}

function SkeletonStat() {
  return <div className="bg-stat-card p-6 rounded-xl h-32 animate-pulse" />
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
    [documents]
  )

  const recentReports = useMemo(() => sortedDocuments.slice(0, 3) as unknown as ReportRow[], [sortedDocuments])

  const hasActiveExtraction = useMemo(
    () => documents.some((doc) => doc.extraction_status === 'pending' || doc.extraction_status === 'processing'),
    [documents],
  )

  const pollAbortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!hasActiveExtraction) return

    const controller = new AbortController()
    pollAbortRef.current = controller
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
          (doc) => doc.extraction_status === 'pending' || doc.extraction_status === 'processing'
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
      arr.push({ id: hv.id, display_name: hv.display_name, value: hv.value, unit: hv.unit })
      map.set(hv.document_id, arr)
    }
    return map
  }, [allHealthValues, recentReports])

  const allFlaggedValues = useMemo(
    () => allHealthValues.filter((v) => v.is_flagged).slice(0, 10) as FlaggedValueRow[],
    [allHealthValues]
  )

  // Greeting based on time of day
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetName = greetingFirstName(profile, user, profileLoading)

  return (
    <div className="flex-1 h-screen overflow-y-auto scroll-smooth">
      <TopBar
        title={greetName ? `${greeting}, ${greetName}` : greeting}
        subtitle="Here's your health summary."
        ctaLabel="Upload report"
        onCtaClick={() => setShowUploadModal(true)}
      />

      <div className="px-4 sm:px-6 lg:px-8 pb-12 max-w-[1440px] mx-auto space-y-8 lg:space-y-10">

        {/* Stats row */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          {statsLoading ? (
            <>
              <SkeletonStat /><SkeletonStat /><SkeletonStat /><SkeletonStat />
            </>
          ) : (
            <>
              <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Reports uploaded</span>
                <span className="text-4xl font-serif font-bold text-primary">{apiStats?.report_count ?? 0}</span>
              </div>
              <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Values tracked</span>
                <span className="text-4xl font-serif font-bold text-primary">{apiStats?.values_tracked ?? 0}</span>
              </div>
              <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Flagged values</span>
                <span className="text-4xl font-serif font-bold text-amber">{apiStats?.flagged_count ?? 0}</span>
              </div>
              <div className="bg-stat-card p-6 rounded-xl flex flex-col justify-between h-32">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">Last upload</span>
                <span className="text-2xl font-serif font-bold text-primary">
                  {formatRelativeDate(apiStats?.last_upload_at ?? null)}
                </span>
              </div>
            </>
          )}
        </section>

        {/* Main grid */}
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">

          {/* Recent Reports */}
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
                  <p className="text-stone-500 text-sm">Upload your first health report to get started.</p>
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

          {/* Right column */}
          <section className="flex-1 lg:flex-[0.35] space-y-6">
            <h2 className="font-serif text-2xl font-bold">Health snapshot</h2>

            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-20 rounded-xl bg-surface-container animate-pulse" />
                ))}
              </div>
            ) : allFlaggedValues.length === 0 ? (
              <div className="bg-secondary-container/40 rounded-xl p-6 text-center space-y-2">
                <span
                  className="material-symbols-outlined text-primary text-3xl"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  check_circle
                </span>
                <p className="font-semibold text-on-surface text-sm">No flagged values</p>
                <p className="text-on-surface-variant text-xs">
                  {apiStats?.report_count === 0
                    ? 'Upload a report to see your health snapshot.'
                    : 'All tracked values are within reference range.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {allFlaggedValues.slice(0, 5).map((hv) => (
                  <div
                    key={hv.id}
                    className="bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between border border-outline-variant/10"
                  >
                    <div>
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">
                        {hv.display_name}
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold text-on-surface">{hv.value}</span>
                        {hv.unit && <span className="text-xs text-stone-500">{hv.unit}</span>}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-amber bg-amber/10 px-2.5 py-1 rounded-full">
                      {getStatusLabel(hv)}
                    </span>
                  </div>
                ))}
                {allFlaggedValues.length > 5 && (
                  <p className="text-xs text-stone-400 text-center">
                    +{allFlaggedValues.length - 5} more flagged values
                  </p>
                )}
              </div>
            )}

            <Link
              to="/timeline"
              className="block text-center py-4 text-primary font-bold text-sm hover:underline tracking-tight"
            >
              View full timeline →
            </Link>

            {/* Promo banner */}
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-forest p-6 text-white">
              <div className="relative z-10">
                <h4 className="font-serif text-lg font-bold mb-2">Winter Wellness</h4>
                <p className="text-xs opacity-90 leading-relaxed mb-4">
                  Book a Vitamin D screening at home with our partners at 15% off.
                </p>
                <button
                  type="button"
                  className="bg-white text-primary px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform"
                >
                  Claim offer
                </button>
              </div>
            </div>
          </section>
        </div>

        {/* Flagged values alert */}
        {!loading && allFlaggedValues.length > 0 && (
          <section className="w-full">
            <div className="bg-amber-light p-4 sm:p-6 lg:p-8 rounded-xl border border-amber/10">
              <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                <div className="w-12 h-12 rounded-full bg-amber/10 flex items-center justify-center shrink-0">
                  <span
                    className="material-symbols-outlined text-amber"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    warning
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-on-surface mb-4">
                    {allFlaggedValues.length}{' '}
                    {allFlaggedValues.length === 1 ? 'value needs' : 'values need'} your attention
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 mb-6">
                    {allFlaggedValues.map((hv) => (
                      <div
                        key={hv.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-amber/10 pb-2 gap-1"
                      >
                        <span className="font-bold">{hv.display_name}</span>
                        <span className="text-amber font-bold text-sm sm:text-base">
                          {hv.value} {hv.unit} —{' '}
                          <span className="italic font-normal">{getStatusLabel(hv)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-amber-text bg-surface w-fit px-4 py-2 rounded-lg italic">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">info</span>
                    Worth discussing with your doctor during your next visit.
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
      />
    </div>
  )
}
