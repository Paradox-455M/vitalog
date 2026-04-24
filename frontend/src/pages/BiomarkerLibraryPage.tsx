import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../auth/authContext'
import { BiomarkerDetailDrawer } from '../components/BiomarkerDetailDrawer'
import { UploadModal } from '../components/UploadModal'
import { TopBar } from '../components/TopBar'
import { BiomarkerLibrarySkeleton } from '../components/Skeleton'
import { allCatalogCanonicals } from '../data/biomarkerCatalog'
import { useDocuments } from '../hooks/useDocuments'
import { useFamilyMembers } from '../hooks/useFamilyMembers'
import { useHealthValues, useTimeline } from '../hooks/useHealthValues'
import { biomarkerRowFromLatest } from '../lib/biomarkerRows'
import type { HealthValue } from '../lib/api'
import { latestByCanonical, unknownCanonicalHealthValues } from '../lib/healthValues'
import type { BiomarkerEntry } from '../types/biomarkers'

function motdIndexForUser(userId: string | undefined, len: number): number {
  const start = new Date(new Date().getFullYear(), 0, 0)
  const day = Math.floor((Date.now() - start.getTime()) / 86400000)
  let h = 0
  if (userId) {
    for (let i = 0; i < userId.length; i++) {
      h = Math.imul(31, h) + userId.charCodeAt(i)
    }
  }
  return Math.abs(h + day) % len
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

function EmptySearchState() {
  return (
    <div className="py-16 flex flex-col items-center text-center text-on-surface-variant">
      <span className="material-symbols-outlined text-5xl mb-4 text-outline-variant">search_off</span>
      <p className="font-semibold">No biomarkers match your search</p>
      <p className="text-sm mt-1">Try a different name or category</p>
    </div>
  )
}

function MotdTrendCard({
  canonicalName,
  familyMemberId,
  latest,
  onUpload,
}: {
  canonicalName: string
  familyMemberId?: string
  latest: HealthValue | undefined
  onUpload: () => void
}) {
  const { timeline, loading, error } = useTimeline(canonicalName, familyMemberId)
  const chartData = useMemo(
    () => (timeline?.points ?? []).map((p) => ({ report_date: p.report_date, value: p.value })),
    [timeline?.points]
  )

  if (loading) {
    return (
      <div className="w-full md:w-80 bg-surface-container-lowest/80 backdrop-blur-sm p-6 rounded-2xl border border-outline-variant/20 shadow-lg">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-surface-container-high rounded w-2/3" />
          <div className="h-32 bg-surface-container-high rounded-xl" />
          <div className="h-12 bg-surface-container-high rounded-lg" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full md:w-80 bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 text-sm text-on-surface-variant">
        Could not load trend for this marker.
      </div>
    )
  }

  const hasPoints = chartData.length > 0

  return (
    <div className="w-full md:w-80 bg-surface-container-lowest/90 backdrop-blur-sm p-6 rounded-2xl border border-outline-variant/20 shadow-lg">
      <p className="text-sm font-bold text-on-surface-variant mb-4 flex justify-between">
        <span>Your trend</span>
        {hasPoints && (
          <span className="font-normal text-xs">
            {chartData.length} point{chartData.length !== 1 ? 's' : ''}
          </span>
        )}
      </p>

      {hasPoints ? (
        <div className="h-36 mb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="report_date"
                tick={{ fontSize: 10, fill: '#414943' }}
                tickFormatter={(v) =>
                  new Date(v as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                }
                tickLine={false}
                axisLine={{ stroke: '#c0c9c0' }}
              />
              <YAxis tick={{ fontSize: 10, fill: '#414943' }} width={40} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fbf9f2',
                  border: '1px solid #c0c9c0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelFormatter={(v) => new Date(v as string).toLocaleDateString(undefined, { dateStyle: 'medium' })}
              />
              <Line type="monotone" dataKey="value" stroke="#3e6327" strokeWidth={2} dot={{ r: 3, fill: '#3e6327' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-36 mb-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-outline-variant/40 bg-surface-container/50 px-4 text-center">
          <p className="text-sm text-on-surface-variant mb-3">Upload a report that includes this test to see your trend.</p>
          <button
            type="button"
            onClick={onUpload}
            className="text-sm font-semibold text-primary hover:underline"
          >
            Upload report
          </button>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-outline-variant/20 pt-4">
        <div>
          <p className="text-xs text-on-surface-variant font-bold uppercase tracking-wide">Latest</p>
          {latest ? (
            <p className="text-2xl font-bold text-primary font-serif">
              {latest.value}
              {latest.unit ? <span className="text-sm font-sans font-normal text-on-surface-variant"> {latest.unit}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-on-surface-variant mt-1">No value in your uploads yet</p>
          )}
        </div>
        {latest?.is_flagged ? (
          <span className="px-3 py-1 bg-amber-light text-amber-text text-xs font-bold rounded-full">Needs review</span>
        ) : latest ? (
          <span className="px-3 py-1 bg-secondary-container text-on-secondary-container text-xs font-bold rounded-full">
            Tracked
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function BiomarkerLibraryPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [localSearchQuery, setLocalSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [selectedBiomarker, setSelectedBiomarker] = useState<BiomarkerEntry | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [dismissedErrorMessage, setDismissedErrorMessage] = useState<string | null>(null)

  const familyMemberId = searchParams.get('family_member_id') || undefined
  const qFromUrl = searchParams.get('q')
  const hasUrlSearch = qFromUrl != null && qFromUrl !== ''
  const searchQuery = hasUrlSearch ? qFromUrl : localSearchQuery

  const { members, loading: familyLoading } = useFamilyMembers()
  const { healthValues, loading, error, refetch } = useHealthValues({ familyMemberId })
  const { documents: completeDocs } = useDocuments({ status: 'complete', limit: 100 })

  const familyFilterName = members.find((m) => m.id === familyMemberId)?.name

  const setFamilyFilter = useCallback(
    (id: string | '') => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (id) next.set('family_member_id', id)
          else next.delete('family_member_id')
          return next
        },
        { replace: true }
      )
    },
    [setSearchParams]
  )

  const latestMap = useMemo(() => latestByCanonical(healthValues), [healthValues])

  const plainExplanationMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const doc of completeDocs) {
      if (!doc.explanation_text) continue
      try {
        const parsed = JSON.parse(doc.explanation_text) as {
          layer2?: { findings?: Array<{ canonical_name: string; plain_explanation?: string }> }
        }
        for (const f of parsed.layer2?.findings ?? []) {
          if (f.canonical_name && f.plain_explanation && !map.has(f.canonical_name)) {
            map.set(f.canonical_name, f.plain_explanation)
          }
        }
      } catch { /* ignore malformed explanation_text */ }
    }
    return map
  }, [completeDocs])

  const userRows = useMemo(() => {
    const rows: BiomarkerEntry[] = []
    for (const hv of latestMap.values()) {
      rows.push(biomarkerRowFromLatest(hv, plainExplanationMap.get(hv.canonical_name)))
    }
    rows.sort((a, b) => a.display_name.localeCompare(b.display_name))
    return rows
  }, [latestMap, plainExplanationMap])

  const categoryChips = useMemo(() => {
    const present = new Set(userRows.map((r) => r.category))
    const rest = [...present].sort((a, b) => a.localeCompare(b))
    return ['All', ...rest]
  }, [userRows])

  const resolvedCategory =
    activeCategory !== 'All' && !categoryChips.includes(activeCategory) ? 'All' : activeCategory

  const userCanonicalsSorted = useMemo(() => [...latestMap.keys()].sort(), [latestMap])

  const featured = useMemo(() => {
    if (userCanonicalsSorted.length === 0) return null
    const idx = motdIndexForUser(user?.id, userCanonicalsSorted.length)
    const canonical = userCanonicalsSorted[idx]!
    const latest = latestMap.get(canonical)
    if (!latest) return null
    return biomarkerRowFromLatest(latest, plainExplanationMap.get(canonical))
  }, [user?.id, userCanonicalsSorted, latestMap, plainExplanationMap])

  const unknownFromData = useMemo(
    () => unknownCanonicalHealthValues(healthValues, allCatalogCanonicals),
    [healthValues]
  )

  const showErrorBanner = error != null && error.message !== dismissedErrorMessage

  const openDrawer = useCallback((b: BiomarkerEntry) => {
    setSelectedBiomarker(b)
    setDrawerOpen(true)
  }, [])

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const filtered = useMemo(
    () =>
      userRows
        .filter((b) => resolvedCategory === 'All' || b.category === resolvedCategory)
        .filter(
          (b) =>
            !searchQuery ||
            b.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.canonical_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            b.aliases.some((a) => a.toLowerCase().includes(searchQuery.toLowerCase()))
        ),
    [searchQuery, resolvedCategory, userRows]
  )

  const subtitle = useMemo(() => {
    if (loading) return 'Loading your data…'
    const n = latestMap.size
    if (n === 0) return 'Upload a report to see biomarkers from your labs'
    return `${n} biomarker${n !== 1 ? 's' : ''} with data from your reports`
  }, [loading, latestMap.size])

  const whyItMattersLine = useMemo(() => {
    if (!featured) return null
    const c = featured.causes_low[0]
    if (c && c !== 'Generally not clinically significant') return c
    const h = featured.causes_high[0]
    if (h && h !== 'Generally not clinically significant') return h
    return null
  }, [featured])

  return (
    <div className="flex-1 min-h-screen overflow-y-auto scroll-smooth bg-surface">
      <TopBar
        title="Biomarker Library"
        subtitle={subtitle}
        ctaLabel="Upload report"
        onCtaClick={() => setShowUploadModal(true)}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto space-y-6">
        {familyMemberId && (
          <div
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-xl border border-primary/20 bg-primary/5"
            role="status"
          >
            <p className="text-sm text-on-surface">
              <span className="font-semibold">Viewing data for: </span>
              {familyLoading ? 'Loading…' : (familyFilterName ?? 'Family member')}
            </p>
            <Link
              to="/biomarkers"
              className="text-sm font-semibold text-primary hover:underline shrink-0"
            >
              Show all family
            </Link>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label htmlFor="biomarker-family-scope" className="text-sm font-semibold text-on-surface-variant shrink-0">
            Scope
          </label>
          <select
            id="biomarker-family-scope"
            value={familyMemberId ?? ''}
            disabled={familyLoading}
            onChange={(e) => setFamilyFilter(e.target.value)}
            className="max-w-xs w-full appearance-none bg-surface-container-lowest border border-outline-variant rounded-lg pl-4 pr-10 py-2.5 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50"
          >
            <option value="">All family</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
                {m.relationship ? ` (${m.relationship})` : ''}
              </option>
            ))}
          </select>
        </div>

        {showErrorBanner && (
          <div
            className="rounded-xl border border-error/30 bg-error/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            role="alert"
          >
            <p className="text-sm text-on-surface">{error.message}</p>
            <div className="flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDismissedErrorMessage(null)
                  void refetch()
                }}
                className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => setDismissedErrorMessage(error.message)}
                className="px-4 py-2 rounded-full border border-outline-variant text-sm font-semibold text-on-surface-variant"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <BiomarkerLibrarySkeleton />
        ) : userRows.length === 0 ? (
          <div className="py-20 flex flex-col items-center text-center max-w-md mx-auto space-y-6">
            <span className="material-symbols-outlined text-6xl text-outline-variant">biotech</span>
            <div className="space-y-2">
              <p className="font-serif text-xl font-bold text-on-surface">No biomarkers yet</p>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Upload a lab report and we will list every marker we extract, with your latest values and trends.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="px-6 py-3 rounded-full bg-primary text-on-primary font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Upload report
            </button>
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-5 top-1/2 -translate-y-1/2 text-on-surface-variant text-3xl pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  aria-label="Search biomarkers"
                  value={searchQuery}
                  onChange={(e) => {
                    const v = e.target.value
                    setLocalSearchQuery(v)
                    if (searchParams.has('q')) {
                      setSearchParams(
                        (prev) => {
                          const next = new URLSearchParams(prev)
                          next.delete('q')
                          return next
                        },
                        { replace: true }
                      )
                    }
                  }}
                  placeholder="Search biomarkers, e.g. HbA1c, Ferritin..."
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-2xl py-5 pl-16 pr-6 text-base font-sans text-on-surface placeholder:text-on-surface-variant/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {categoryChips.map((cat) => (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={
                      resolvedCategory === cat
                        ? 'px-5 py-2 bg-secondary text-white rounded-full text-sm font-semibold transition-all'
                        : 'px-5 py-2 bg-surface-container-high text-on-surface-variant hover:bg-secondary-container/50 rounded-full text-sm font-semibold transition-all'
                    }
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </section>

            {featured && (
              <section>
                <div className="bg-gradient-to-br from-surface-container-lowest to-secondary-container/20 border border-secondary-container/30 rounded-3xl p-8 md:p-10 flex flex-col md:flex-row gap-10 items-center overflow-hidden relative">
                  <div className="absolute -right-20 -top-20 w-64 h-64 bg-secondary-container/10 rounded-full blur-3xl" />

                  <div className="flex-1 space-y-6 relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant rounded-full text-xs font-bold uppercase tracking-wider">
                      <span
                        className="material-symbols-outlined text-sm"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
                        star
                      </span>
                      Marker of the day
                    </div>
                    <h3 className="text-4xl font-bold font-serif text-secondary">{featured.display_name}</h3>
                    <p className="text-lg leading-relaxed text-on-surface-variant font-medium">{featured.description}</p>
                    {whyItMattersLine && (
                      <div className="space-y-2">
                        <h4 className="text-xl font-bold text-primary flex items-center gap-2">
                          <span className="material-symbols-outlined">help_outline</span>
                          Why it matters
                        </h4>
                        <p className="text-on-surface-variant">{whyItMattersLine}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => openDrawer(featured)}
                      className="text-secondary font-bold flex items-center gap-2 hover:gap-3 transition-all"
                    >
                      Read full deep dive{' '}
                      <span className="material-symbols-outlined">arrow_forward</span>
                    </button>
                  </div>

                  <MotdTrendCard
                    canonicalName={featured.canonical_name}
                    familyMemberId={familyMemberId}
                    latest={latestMap.get(featured.canonical_name)}
                    onUpload={() => setShowUploadModal(true)}
                  />
                </div>
              </section>
            )}

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-bold font-serif text-secondary">Your biomarkers</h3>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Grid view"
                    aria-pressed={viewMode === 'grid'}
                    onClick={() => setViewMode('grid')}
                    className={`p-2 border rounded-lg hover:bg-surface-container-low transition-colors ${
                      viewMode === 'grid'
                        ? 'border-primary text-primary'
                        : 'border-outline-variant/40 text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined">grid_view</span>
                  </button>
                  <button
                    type="button"
                    aria-label="List view"
                    aria-pressed={viewMode === 'list'}
                    onClick={() => setViewMode('list')}
                    className={`p-2 border rounded-lg hover:bg-surface-container-low transition-colors ${
                      viewMode === 'list'
                        ? 'border-primary text-primary'
                        : 'border-outline-variant/40 text-on-surface-variant'
                    }`}
                  >
                    <span className="material-symbols-outlined">list</span>
                  </button>
                </div>
              </div>

              {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.length === 0 ? (
                    <div className="col-span-full">
                      <EmptySearchState />
                    </div>
                  ) : (
                    filtered.map((b) => {
                      const latest = latestMap.get(b.canonical_name)
                      return (
                        <div
                          key={b.canonical_name}
                          className="bg-surface-container-lowest p-6 rounded-2xl border border-outline-variant/20 shadow-sm hover:shadow-md transition-shadow group flex flex-col"
                        >
                          <div className="flex justify-between items-start mb-4 gap-2">
                            <h4 className="text-xl font-bold font-serif text-secondary">{b.display_name}</h4>
                            {latest?.is_flagged && (
                              <span className="shrink-0 px-2 py-0.5 bg-amber-light text-amber-text rounded-full text-xs font-bold">
                                Flagged
                              </span>
                            )}
                          </div>
                          <p className="text-on-surface-variant text-sm mb-4 flex-1">{b.description}</p>
                          {latest ? (
                            <div className="mb-4 rounded-xl bg-surface-container/80 border border-outline-variant/15 px-3 py-2">
                              <p className="text-xs text-on-surface-variant font-semibold uppercase tracking-wide">
                                Your latest
                              </p>
                              <p className="text-lg font-bold text-on-surface">
                                {latest.value}
                                {latest.unit ? ` ${latest.unit}` : ''}
                                <span className="text-xs font-normal text-on-surface-variant ml-2">
                                  {formatShortDate(latest.report_date)}
                                </span>
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-on-surface-variant/80 mb-4">No value in your uploads yet</p>
                          )}
                          <div className="mb-4 space-y-1">
                            {b.normal_range_male === b.normal_range_female ? (
                              <p className="text-xs text-on-surface-variant">
                                <span className="font-semibold text-on-surface">Typical range:</span>{' '}
                                {b.normal_range_male}
                              </p>
                            ) : (
                              <>
                                <p className="text-xs text-on-surface-variant">
                                  <span className="font-semibold text-on-surface">Male:</span> {b.normal_range_male}
                                </p>
                                <p className="text-xs text-on-surface-variant">
                                  <span className="font-semibold text-on-surface">Female:</span>{' '}
                                  {b.normal_range_female}
                                </p>
                              </>
                            )}
                          </div>
                          <div className="flex items-center justify-between mt-auto">
                            <button
                              type="button"
                              onClick={() => openDrawer(b)}
                              className="text-secondary font-bold text-sm flex items-center gap-1 hover:underline"
                            >
                              View details
                              <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
                                chevron_right
                              </span>
                            </button>
                            <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-full text-xs font-medium">
                              {b.category}
                            </span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}

              {viewMode === 'list' && (
                <div className="flex flex-col divide-y divide-outline-variant/20">
                  {filtered.length === 0 ? (
                    <EmptySearchState />
                  ) : (
                    filtered.map((b) => {
                      const latest = latestMap.get(b.canonical_name)
                      return (
                        <div key={b.canonical_name} className="py-4 flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="flex-1 min-w-0">
                            <span className="font-bold font-serif text-secondary">{b.display_name}</span>
                            {b.aliases.length > 0 && (
                              <span className="ml-2 text-xs text-on-surface-variant">({b.aliases[0]})</span>
                            )}
                            {latest ? (
                              <p className="text-sm text-on-surface mt-1">
                                <span className="font-semibold">Latest:</span> {latest.value}
                                {latest.unit ? ` ${latest.unit}` : ''}
                                <span className="text-on-surface-variant"> — {formatShortDate(latest.report_date)}</span>
                                {latest.is_flagged && (
                                  <span className="ml-2 text-xs font-bold text-amber-text">Flagged</span>
                                )}
                              </p>
                            ) : (
                              <p className="text-sm text-on-surface-variant mt-1">No uploads yet</p>
                            )}
                          </div>
                          <span className="shrink-0 px-2 py-0.5 bg-surface-container text-on-surface-variant rounded-full text-xs font-medium">
                            {b.category}
                          </span>
                          <button
                            type="button"
                            onClick={() => openDrawer(b)}
                            className="shrink-0 text-secondary font-bold text-sm hover:underline flex items-center gap-1 self-start sm:self-center"
                          >
                            Details <span className="material-symbols-outlined text-sm">chevron_right</span>
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </section>

            {unknownFromData.length > 0 && (
              <section className="space-y-4">
                <h3 className="text-xl font-bold font-serif text-secondary">Also in your data</h3>
                <p className="text-sm text-on-surface-variant">
                  These markers appeared in your uploads but are not in the curated library yet.
                </p>
                <ul className="divide-y divide-outline-variant/20 rounded-xl border border-outline-variant/20 bg-surface-container-lowest overflow-hidden">
                  {unknownFromData.map(({ canonical, latest: v }) => (
                    <li key={canonical} className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-on-surface">{v.display_name}</p>
                        <p className="text-sm text-on-surface-variant">
                          {v.value}
                          {v.unit ? ` ${v.unit}` : ''} · {formatShortDate(v.report_date)}
                          {v.is_flagged && (
                            <span className="ml-2 text-xs font-bold text-amber-text">Flagged</span>
                          )}
                        </p>
                      </div>
                      <Link
                        to={`/timeline?canonical=${encodeURIComponent(canonical)}`}
                        className="text-sm font-semibold text-primary hover:underline shrink-0"
                      >
                        View on timeline
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>

      <BiomarkerDetailDrawer
        biomarker={selectedBiomarker}
        isOpen={drawerOpen}
        onClose={closeDrawer}
        latestValue={selectedBiomarker ? (latestMap.get(selectedBiomarker.canonical_name) ?? null) : null}
      />

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => {
          void refetch()
        }}
      />
    </div>
  )
}
