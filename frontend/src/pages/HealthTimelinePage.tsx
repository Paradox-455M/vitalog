import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
} from 'recharts'
import { UploadModal } from '../components/UploadModal'
import { TimelineSkeleton } from '../components/Skeleton'
import { useHealthValues } from '../hooks/useHealthValues'
import { groupByCanonical, timelineChartElementId } from '../lib/healthValues'
import type { HealthValue } from '../lib/api'

type DatePreset = '3m' | '6m' | '12m' | 'all'
type FilterMode = 'All' | 'Flagged'

const PRESET_LABELS: Record<DatePreset, string> = {
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  all: 'All time',
}

function formatLocalYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getDateRange(preset: DatePreset): { fromDate?: string; toDate?: string } {
  if (preset === 'all') return {}
  const end = new Date()
  const start = new Date()
  const months = preset === '3m' ? 3 : preset === '6m' ? 6 : 12
  start.setMonth(start.getMonth() - months)
  return { fromDate: formatLocalYMD(start), toDate: formatLocalYMD(end) }
}

function pctChange(series: HealthValue[]): number | undefined {
  if (series.length < 2) return undefined
  const prev = series[series.length - 2].value
  const latest = series[series.length - 1].value
  if (prev === 0) return undefined
  return Math.round(((latest - prev) / prev) * 100)
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: string | number
  icon: string
  color: string
}) {
  return (
    <div className="bg-surface-container-low rounded-xl p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className={`material-symbols-outlined ${color}`}>{icon}</span>
        <span className="text-sm text-on-surface-variant">{label}</span>
      </div>
      <p className="text-3xl font-bold font-serif text-on-surface">{value}</p>
    </div>
  )
}

function TrendChartCard({ series, isSpotlight = false }: { series: HealthValue[]; isSpotlight?: boolean }) {
  const latest = series[series.length - 1]
  const displayName = latest.display_name
  const unit = latest.unit ?? ''
  const refLow = latest.reference_low
  const refHigh = latest.reference_high
  const latestFlagged = latest.is_flagged

  const chartData = series.map((hv) => ({
    report_date: hv.report_date,
    value: hv.value,
    document_id: hv.document_id,
  }))

  const values = series.map((v) => v.value)
  const minVal = Math.min(...values)
  const maxVal = Math.max(...values)
  let yMin = minVal
  let yMax = maxVal
  if (refLow != null && refHigh != null) {
    yMin = Math.min(minVal, refLow)
    yMax = Math.max(maxVal, refHigh)
    const pad = (yMax - yMin) * 0.08 || 1
    yMin -= pad
    yMax += pad
  } else {
    const pad = (yMax - yMin) * 0.08 || 1
    yMin -= pad
    yMax += pad
  }
  if (Math.abs(yMax - yMin) < 1e-9) {
    yMin -= 1
    yMax += 1
  }

  const delta = pctChange(series)

  const chartCanonical = series[series.length - 1]!.canonical_name
  return (
    <div
      className={`relative overflow-hidden rounded-xl p-6 transition-shadow ${
        isSpotlight
          ? 'bg-primary/5 border-2 border-primary shadow-md ring-2 ring-primary/40 ring-offset-2 ring-offset-surface'
          : 'bg-surface-container-lowest border border-outline-variant/20'
      }`}
      id={timelineChartElementId(chartCanonical)}
      data-spotlight={isSpotlight ? 'true' : undefined}
    >
      {isSpotlight ? (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5"
          aria-hidden
        />
      ) : null}
      <div className="relative z-[1]">
      <div className="flex items-start justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h4 className="font-serif text-xl font-bold text-on-surface">{displayName}</h4>
          <p className="text-sm text-on-surface-variant">
            Latest:{' '}
            <span className="font-bold text-primary">
              {latest.value}
              {unit ? ` ${unit}` : ''}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {latestFlagged && (
            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-amber-light text-amber-text">
              Flagged
            </span>
          )}
          {delta !== undefined && (
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                latestFlagged ? 'bg-amber-light text-amber-text' : 'bg-secondary-container text-on-secondary-container'
              }`}
            >
              {delta > 0 ? '+' : ''}
              {delta}% vs previous
            </span>
          )}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#c0c9c0" opacity={0.3} />
            <XAxis
              dataKey="report_date"
              tick={{ fontSize: 12, fill: '#414943' }}
              tickLine={false}
              axisLine={{ stroke: '#c0c9c0' }}
              tickFormatter={(v) =>
                new Date(v as string).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
              }
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 12, fill: '#414943' }}
              tickLine={false}
              axisLine={false}
              width={50}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fbf9f2',
                border: '1px solid #c0c9c0',
                borderRadius: '8px',
                fontSize: '13px',
              }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload as {
                  report_date: string
                  value: number
                  document_id: string
                }
                return (
                  <div className="px-2 py-1">
                    <p className="text-xs text-on-surface-variant mb-1">
                      {new Date(row.report_date).toLocaleDateString(undefined, {
                        dateStyle: 'medium',
                      })}
                    </p>
                    <p className="font-semibold text-on-surface">
                      {row.value}
                      {unit ? ` ${unit}` : ''}
                    </p>
                    <Link
                      to={`/reports/${row.document_id}`}
                      className="text-xs text-primary font-semibold mt-1 inline-block hover:underline"
                    >
                      View report
                    </Link>
                  </div>
                )
              }}
            />
            {refLow != null && refHigh != null && (
              <>
                <ReferenceArea y1={refLow} y2={refHigh} fill="#b6ecc9" fillOpacity={0.3} />
                <ReferenceLine
                  y={refLow}
                  stroke="#36684c"
                  strokeDasharray="3 3"
                  opacity={0.5}
                  label={{ value: 'Min', fontSize: 10, fill: '#414943' }}
                />
                <ReferenceLine
                  y={refHigh}
                  stroke="#36684c"
                  strokeDasharray="3 3"
                  opacity={0.5}
                  label={{ value: 'Max', fontSize: 10, fill: '#414943' }}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3e6327"
              strokeWidth={3}
              dot={{ fill: '#3e6327', strokeWidth: 2, r: 5 }}
              activeDot={{ r: 8, fill: '#3e6327' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap items-center gap-6 mt-4 text-sm text-on-surface-variant border-t border-outline-variant/20 pt-4">
        {refLow != null && refHigh != null ? (
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded bg-secondary-container/50" />
            <span>
              Reference range ({refLow}–{refHigh}
              {unit ? ` ${unit}` : ''})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs italic">Reference range not available for this marker</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="w-4 h-1 bg-primary rounded" />
          <span>Your values</span>
        </div>
      </div>
      </div>
    </div>
  )
}

export function HealthTimelinePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [preset, setPreset] = useState<DatePreset>('12m')
  const [filterMode, setFilterMode] = useState<FilterMode>('All')
  const [rangeMenuOpen, setRangeMenuOpen] = useState(false)
  /** Set when deep-link scroll completes so highlight persists after ?canonical= is removed from the URL */
  const [stickySpotlight, setStickySpotlight] = useState<string | null>(null)
  const focusCanonical = searchParams.get('canonical')
  const spotlightCanonical = focusCanonical ?? stickySpotlight

  const { fromDate, toDate } = useMemo(() => getDateRange(preset), [preset])
  const { healthValues, loading, error, refetch } = useHealthValues({ fromDate, toDate })

  const seriesList = useMemo(() => {
    const map = groupByCanonical(healthValues)
    const entries = Array.from(map.entries()).map(([canonical, series]) => ({ canonical, series }))
    entries.sort((a, b) => {
      const na = a.series[a.series.length - 1].display_name
      const nb = b.series[b.series.length - 1].display_name
      return na.localeCompare(nb)
    })
    return entries
  }, [healthValues])

  const stats = useMemo(() => {
    const map = groupByCanonical(healthValues)
    let flaggedLatest = 0
    let withTrends = 0
    const docIds = new Set<string>()
    for (const hv of healthValues) docIds.add(hv.document_id)
    for (const series of map.values()) {
      const latest = series[series.length - 1]
      if (latest.is_flagged) flaggedLatest++
      if (series.length >= 2) withTrends++
    }
    return {
      biomarkers: map.size,
      flagged: flaggedLatest,
      withTrends,
      reports: docIds.size,
    }
  }, [healthValues])

  /** When deep-linking with ?canonical=, show all series so the target chart can render and scroll into view. */
  const effectiveFilterMode: FilterMode = focusCanonical ? 'All' : filterMode

  const visibleSeries = useMemo(() => {
    if (effectiveFilterMode === 'All') return seriesList
    return seriesList.filter(({ series }) => series[series.length - 1].is_flagged)
  }, [seriesList, effectiveFilterMode])

  const flaggedLatestList = useMemo(() => {
    return seriesList
      .filter(({ series }) => series[series.length - 1].is_flagged)
      .map(({ series }) => {
        const latest = series[series.length - 1]
        return {
          key: latest.canonical_name,
          display_name: latest.display_name,
          value: latest.value,
          unit: latest.unit,
        }
      })
  }, [seriesList])

  const showEmptyNoData = !loading && !error && healthValues.length === 0
  const showFilterEmpty =
    !loading && !error && healthValues.length > 0 && visibleSeries.length === 0

  const didScrollToCanonical = useRef(false)

  useEffect(() => {
    didScrollToCanonical.current = false
  }, [focusCanonical])

  useEffect(() => {
    if (!focusCanonical || loading || didScrollToCanonical.current) return
    const hasCard = visibleSeries.some((v) => v.canonical === focusCanonical)
    if (!hasCard) return

    const t = window.setTimeout(() => {
      const el = document.getElementById(timelineChartElementId(focusCanonical))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
        didScrollToCanonical.current = true
        setStickySpotlight(focusCanonical)
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev)
            next.delete('canonical')
            return next
          },
          { replace: true }
        )
      }
    }, 200)
    return () => clearTimeout(t)
  }, [focusCanonical, loading, visibleSeries, setSearchParams])

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-surface/70 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center px-8 h-20 w-full border-b border-outline-variant/20">
        <span className="font-serif text-xl text-primary font-bold">Health Timeline</span>
        <div className="flex items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setRangeMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-4 py-2 bg-surface-container rounded-full text-sm text-on-surface-variant hover:bg-surface-container-high transition-colors"
              aria-expanded={rangeMenuOpen}
              aria-haspopup="listbox"
            >
              <span className="material-symbols-outlined text-base">calendar_today</span>
              <span>{PRESET_LABELS[preset]}</span>
              <span className="material-symbols-outlined text-base">expand_more</span>
            </button>
            {rangeMenuOpen && (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  aria-label="Close menu"
                  onClick={() => setRangeMenuOpen(false)}
                />
                <ul
                  role="listbox"
                  className="absolute right-0 top-full mt-1 z-40 min-w-[200px] py-1 bg-surface border border-outline-variant/30 rounded-xl shadow-lg"
                >
                  {(Object.keys(PRESET_LABELS) as DatePreset[]).map((p) => (
                    <li key={p}>
                      <button
                        type="button"
                        role="option"
                        aria-selected={preset === p}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-surface-container-high ${
                          preset === p ? 'text-primary font-semibold' : 'text-on-surface'
                        }`}
                        onClick={() => {
                          setPreset(p)
                          setRangeMenuOpen(false)
                        }}
                      >
                        {PRESET_LABELS[p]}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-sans text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">upload_file</span>
            Upload Report
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-8 py-12 space-y-10">
        <section>
          <h1 className="font-serif text-4xl font-bold text-primary tracking-tight mb-2">
            Your Health Timeline
          </h1>
          <p className="text-on-surface-variant">
            Track how your biomarkers change over time across all your reports.
          </p>
        </section>

        {error && (
          <div
            className="rounded-xl border border-error/30 bg-error/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            role="alert"
          >
            <p className="text-sm text-on-surface">{error.message}</p>
            <button
              type="button"
              onClick={() => void refetch()}
              className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <TimelineSkeleton />
        ) : showEmptyNoData ? (
          <section className="py-20 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-4xl text-on-surface-variant">timeline</span>
            </div>
            <h2 className="font-serif text-2xl font-bold text-on-surface mb-2">No health data yet</h2>
            <p className="text-on-surface-variant mb-6 max-w-md">
              Upload your first health report to start building your personal health timeline and track changes
              over time.
            </p>
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="bg-primary text-on-primary px-8 py-3 rounded-full font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined">upload_file</span>
              Upload your first report
            </button>
          </section>
        ) : healthValues.length > 0 ? (
          <>
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard
                    label="Biomarkers tracked"
                    value={stats.biomarkers}
                    icon="monitoring"
                    color="text-primary"
                  />
                  <StatCard
                    label="Need attention"
                    value={stats.flagged}
                    icon="warning"
                    color="text-amber"
                  />
                  <StatCard
                    label="With trends (2+ points)"
                    value={stats.withTrends}
                    icon="show_chart"
                    color="text-secondary"
                  />
                  <StatCard
                    label="Reports in range"
                    value={stats.reports}
                    icon="description"
                    color="text-on-surface-variant"
                  />
                </section>

                <section className="flex flex-wrap gap-2">
                  {(['All', 'Flagged'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setFilterMode(mode)}
                      className={
                        effectiveFilterMode === mode
                          ? 'px-4 py-2 bg-primary text-on-primary rounded-full text-sm font-semibold transition-all'
                          : 'px-4 py-2 bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest rounded-full text-sm font-semibold transition-all'
                      }
                    >
                      {mode}
                      {mode === 'Flagged' && stats.flagged > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-amber text-white text-xs rounded-full">
                          {stats.flagged}
                        </span>
                      )}
                    </button>
                  ))}
                </section>

                <section className="space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h2 className="font-serif text-2xl font-bold text-primary">Trend charts</h2>
                    <span className="text-sm text-on-surface-variant">
                      {visibleSeries.length} biomarker{visibleSeries.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {showFilterEmpty && (
                    <div className="py-12 flex flex-col items-center text-center text-on-surface-variant rounded-xl border border-outline-variant/20 bg-surface-container-lowest/50">
                      <span className="material-symbols-outlined text-5xl mb-4 text-outline-variant">
                        filter_alt_off
                      </span>
                      <p className="font-semibold text-on-surface">No flagged biomarkers in this range</p>
                      <p className="text-sm mt-1">Try &quot;All&quot; or a wider date range.</p>
                    </div>
                  )}

                  {!showFilterEmpty && visibleSeries.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {visibleSeries.map(({ canonical, series }) => (
                        <TrendChartCard
                          key={canonical}
                          series={series}
                          isSpotlight={spotlightCanonical === canonical}
                        />
                      ))}
                    </div>
                  )}
                </section>

                {stats.flagged > 0 && effectiveFilterMode === 'All' && flaggedLatestList.length > 0 && (
                  <section className="bg-amber-light border border-amber/20 rounded-xl p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-full bg-amber/20 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-amber">priority_high</span>
                      </div>
                      <div>
                        <h3 className="font-serif text-lg font-bold text-amber-text mb-2">
                          {stats.flagged} biomarker{stats.flagged !== 1 ? 's' : ''} need attention
                        </h3>
                        <p className="text-sm text-amber-text/80 mb-4">
                          These values are outside the reference range on their latest report in this period.
                          Consider discussing with your healthcare provider.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {flaggedLatestList.map((v) => (
                            <span
                              key={v.key}
                              className="px-3 py-1 bg-white/60 text-amber-text rounded-full text-sm font-medium"
                            >
                              {v.display_name}: {v.value}
                              {v.unit ? ` ${v.unit}` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-amber/20">
                      <p className="text-xs text-amber-text/70 italic flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm">info</span>
                        This is an observation, not a diagnosis. Always consult with a healthcare professional.
                      </p>
                    </div>
                  </section>
                )}
          </>
        ) : null}
      </main>

      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => void refetch()}
      />
    </div>
  )
}
