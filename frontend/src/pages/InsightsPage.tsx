import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
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
import type { ActionItem, InsightCard } from '../types/insights'
import type { BiomarkerTrend } from '../lib/insightsFromHealthValues'
import { insightsFromHealthValues } from '../lib/insightsFromHealthValues'
import { useHealthValues } from '../hooks/useHealthValues'
import { useProfile } from '../hooks/useProfile'

const ACTION_ICON_MAP: Record<ActionItem['type'], string> = {
  diet: 'restaurant',
  exercise: 'wb_sunny',
  doctor: 'event_note',
}

const CATEGORY_ICON_MAP: Record<InsightCard['category'], { icon: string; color: string }> = {
  nutrition: { icon: 'nutrition', color: 'bg-amber-100 text-amber-700' },
  lifestyle: { icon: 'self_improvement', color: 'bg-secondary-container text-secondary' },
  medical: { icon: 'medical_services', color: 'bg-error-container text-error' },
  trend: { icon: 'trending_up', color: 'bg-primary-fixed text-primary' },
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

function InsightCardComponent({ insight }: { insight: InsightCard }) {
  const category = CATEGORY_ICON_MAP[insight.category]

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${category.color}`}>
          <span className="material-symbols-outlined text-sm">{category.icon}</span>
          <span className="text-xs font-bold uppercase tracking-wider capitalize">{insight.category}</span>
        </div>
        <span className="text-xs text-on-surface-variant">
          {new Date(insight.created_at).toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          })}
        </span>
      </div>

      <h3 className="font-serif text-xl font-bold text-primary mb-3">{insight.headline}</h3>

      <p className="text-on-surface-variant text-sm leading-relaxed mb-4">{insight.context}</p>

      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="material-symbols-outlined text-sm">info</span>
        <span className="italic">Observation only — not medical advice</span>
      </div>
    </div>
  )
}

function TrendChart({ trend }: { trend: BiomarkerTrend }) {
  const latestValue = trend.data[trend.data.length - 1]?.value
  const refMin = trend.data[0]?.referenceMin
  const refMax = trend.data[0]?.referenceMax
  const hasRef = refMin != null && refMax != null

  const vals = trend.data.map((d) => d.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const yMin = hasRef ? Math.min(minV, refMin!, refMax!) * 0.9 : minV * 0.9
  const yMax = hasRef ? Math.max(maxV, refMin!, refMax!) * 1.1 : maxV * 1.1

  return (
    <div className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-serif text-lg font-bold text-on-surface">{trend.display_name}</h4>
          <p className="text-xs text-on-surface-variant">
            Latest: {latestValue} {trend.unit}
          </p>
        </div>
        {trend.latestDelta !== undefined && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              trend.isFlagged
                ? 'bg-amber-light text-amber-text'
                : 'bg-secondary-container text-on-secondary-container'
            }`}
            title={
              trend.isFlagged ? 'Latest value is outside your lab reference range.' : undefined
            }
          >
            {trend.latestDelta > 0 ? '+' : ''}
            {trend.latestDelta}% since last
          </span>
        )}
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#c0c9c0" opacity={0.3} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#414943' }}
              tickLine={false}
              axisLine={{ stroke: '#c0c9c0' }}
            />
            <YAxis
              domain={[yMin, yMax]}
              tick={{ fontSize: 11, fill: '#414943' }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fbf9f2',
                border: '1px solid #c0c9c0',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              formatter={(value) => [`${value} ${trend.unit}`, trend.display_name]}
            />
            {hasRef && (
              <>
                <ReferenceArea y1={refMin} y2={refMax} fill="#b6ecc9" fillOpacity={0.3} />
                <ReferenceLine y={refMin} stroke="#36684c" strokeDasharray="3 3" opacity={0.5} />
                <ReferenceLine y={refMax} stroke="#36684c" strokeDasharray="3 3" opacity={0.5} />
              </>
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3e6327"
              strokeWidth={2}
              dot={{ fill: '#3e6327', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#3e6327' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {hasRef && (
        <div className="flex items-center gap-4 mt-4 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-secondary-container/50" />
            <span>
              Normal range ({refMin}–{refMax})
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

type InsightsDatePreset = 'all' | 'last90' | 'last365' | 'ytd'

function formatYMD(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const READING_ITEMS = [
  {
    id: '1',
    icon: 'science',
    badge: 'Ferritin',
    badgeColor: '#562100',
    title: 'Understanding Iron Storage & Energy',
    searchQuery: 'Ferritin',
  },
  {
    id: '2',
    icon: 'favorite',
    badge: 'LDL',
    badgeColor: '#2c4f15',
    title: 'The Modern Guide to Cholesterol',
    searchQuery: 'LDL',
  },
  {
    id: '3',
    icon: 'psychology',
    badge: 'TSH',
    badgeColor: '#36684c',
    title: 'Thyroid Health and Metabolism',
    searchQuery: 'TSH',
  },
  {
    id: '4',
    icon: 'dark_mode',
    badge: 'Sleep',
    badgeColor: '#44403c',
    title: 'Optimizing Your Circadian Rhythm',
    searchQuery: 'sleep',
  },
] as const

export function InsightsPage() {
  const [datePreset, setDatePreset] = useState<InsightsDatePreset>('all')

  const { fromDate, toDate } = useMemo(() => {
    if (datePreset === 'all') return { fromDate: undefined, toDate: undefined }
    const today = new Date()
    const toDate = formatYMD(today)
    if (datePreset === 'ytd') {
      const from = new Date(today.getFullYear(), 0, 1)
      return { fromDate: formatYMD(from), toDate }
    }
    const days = datePreset === 'last90' ? 90 : 365
    const from = new Date(today)
    from.setDate(from.getDate() - days)
    return { fromDate: formatYMD(from), toDate }
  }, [datePreset])

  const { healthValues, loading: hvLoading, error: hvError, refetch } = useHealthValues({
    fromDate,
    toDate,
  })
  const { profile, loading: profileLoading } = useProfile()

  const loading = hvLoading || profileLoading
  const bundle = useMemo(() => insightsFromHealthValues(healthValues), [healthValues])

  const displayName = profile?.full_name?.trim() || 'You'
  const avatarInitials = initialsFromName(profile?.full_name ?? '')

  const lastUpdated = useMemo(() => {
    if (healthValues.length === 0) return null
    let max = 0
    for (const v of healthValues) {
      const t = new Date(v.report_date).getTime()
      if (!Number.isNaN(t) && t > max) max = t
    }
    return max
      ? new Date(max).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })
      : null
  }, [healthValues])

  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-surface/70 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center px-4 sm:px-6 lg:px-8 h-14 sm:h-16 lg:h-20 w-full border-b border-outline-variant/20">
        <span className="font-serif text-lg sm:text-xl text-primary font-bold pl-14 lg:pl-0">Health Insights</span>
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <label htmlFor="insights-date-range" className="sr-only">
              Date range for insights
            </label>
            <span
              className="material-symbols-outlined text-base absolute left-3 pointer-events-none text-on-surface-variant"
              aria-hidden="true"
            >
              calendar_today
            </span>
            <select
              id="insights-date-range"
              value={datePreset}
              onChange={(e) => setDatePreset(e.target.value as InsightsDatePreset)}
              className="appearance-none cursor-pointer pl-10 pr-9 py-2 bg-surface-container rounded-full text-sm text-on-surface-variant border border-outline-variant/20 hover:bg-surface-container-high transition-colors"
            >
              <option value="all">All time</option>
              <option value="last90">Last 90 days</option>
              <option value="last365">Last 12 months</option>
              <option value="ytd">Year to date</option>
            </select>
            <span
              className="material-symbols-outlined text-base absolute right-2 pointer-events-none text-on-surface-variant"
              aria-hidden="true"
            >
              expand_more
            </span>
          </div>
          <Link
            to="/settings"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
            aria-label="Settings"
          >
            <span className="material-symbols-outlined text-on-surface-variant">settings</span>
          </Link>
          <div className="w-10 h-10 rounded-full bg-surface-container-high flex items-center justify-center">
            <span className="text-sm font-bold text-on-surface">{avatarInitials}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-12">
        {hvError && (
          <div
            className="rounded-xl border border-error/30 bg-error/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            role="alert"
          >
            <p className="text-sm text-on-surface">{hvError.message}</p>
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
          <div className="space-y-6 animate-pulse">
            <div className="h-10 bg-surface-container-high rounded-lg w-2/3 max-w-md" />
            <div className="h-40 bg-surface-container-high rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-surface-container-high rounded-xl" />
              <div className="h-64 bg-surface-container-high rounded-xl" />
            </div>
          </div>
        ) : (
          <>
            <section>
              <h1 className="font-serif text-4xl font-bold text-primary tracking-tight mb-2">
                Health Insights &amp; Action Plan
              </h1>
              <p className="text-on-surface-variant font-medium">
                Analysis for {displayName}
                {lastUpdated ? ` · Last lab date in data ${lastUpdated}` : ''}
              </p>
            </section>

            <section className="bg-surface-container-low border border-outline-variant/30 rounded-xl p-8 shadow-sm">
              <div className="flex items-start gap-6">
                <div className="w-12 h-12 bg-secondary-container rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-on-secondary-container">auto_awesome</span>
                </div>
                <div>
                  <h2 className="font-serif text-xl font-bold text-primary mb-4">Current Health Summary</h2>
                  <div className="space-y-4 text-on-surface leading-relaxed max-w-3xl">
                    {bundle.summaryLines.map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <h2 className="font-serif text-2xl font-bold text-primary">Key Observations</h2>
              {bundle.insights.length === 0 ? (
                <div className="rounded-xl border border-outline-variant/20 bg-surface-container-lowest p-10 text-center text-on-surface-variant">
                  <p className="font-medium text-on-surface mb-2">No observations yet</p>
                  <p className="text-sm mb-4">
                    Upload lab reports with more than one date, or markers outside the reference range, to see
                    automated observations here.
                  </p>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center gap-1 text-primary font-bold text-sm hover:underline"
                  >
                    Go to dashboard
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {bundle.insights.map((insight) => (
                    <InsightCardComponent key={insight.id} insight={insight} />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-2xl font-bold text-primary">Biomarker Trends</h2>
                <Link
                  to="/timeline"
                  className="text-secondary font-bold text-sm flex items-center gap-1 hover:underline"
                >
                  View full timeline
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
              {bundle.trends.length === 0 ? (
                <p className="text-on-surface-variant text-sm">
                  Trends appear when a marker has at least two results in your uploads.
                </p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {bundle.trends.map((trend) => (
                    <TrendChart key={trend.canonical_name} trend={trend} />
                  ))}
                </div>
              )}
            </section>

            {bundle.actions.length > 0 && (
              <section className="space-y-6">
                <h2 className="font-serif text-2xl font-bold text-primary">Priority Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {bundle.actions.map((action) => (
                    <div
                      key={action.id}
                      className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary-fixed mb-4 flex items-center justify-center">
                        <span className="material-symbols-outlined text-primary">
                          {ACTION_ICON_MAP[action.type]}
                        </span>
                      </div>
                      <h3 className="font-bold text-lg text-primary mb-2">{action.action}</h3>
                      <p className="text-sm text-on-surface-variant leading-snug">{action.sub_note}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-6">
              <div className="flex justify-between items-end">
                <h2 className="font-serif text-2xl font-bold text-primary">Recommended Reading</h2>
                <Link
                  to="/biomarkers"
                  className="text-primary font-bold text-sm flex items-center gap-1 hover:underline"
                >
                  Biomarker Library{' '}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {READING_ITEMS.map((item) => (
                  <Link
                    key={item.id}
                    to={`/biomarkers?q=${encodeURIComponent(item.searchQuery)}`}
                    className="group w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="relative aspect-video rounded-lg overflow-hidden mb-3 bg-surface-container-high flex items-center justify-center group-hover:opacity-95 transition-opacity">
                      <span className="material-symbols-outlined text-3xl text-on-surface-variant">{item.icon}</span>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span
                        className="absolute bottom-2 left-3 text-on-primary text-xs font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: item.badgeColor }}
                      >
                        {item.badge}
                      </span>
                    </div>
                    <h4 className="font-bold font-serif text-primary leading-tight text-sm group-hover:underline">
                      {item.title}
                    </h4>
                  </Link>
                ))}
              </div>
            </section>

            <section className="pb-16">
              <div className="bg-primary text-on-primary rounded-xl p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-lg">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center">
                    <span className="material-symbols-outlined text-3xl">picture_as_pdf</span>
                  </div>
                  <div>
                    <h3 className="font-serif text-2xl font-bold mb-1">Doctor Discussion Guide</h3>
                    <p className="text-on-primary/80">
                      Export your reports and timeline from Reports and Timeline to share with your clinician.
                    </p>
                  </div>
                </div>
                <Link
                  to="/reports"
                  className="bg-white text-primary px-8 py-3 rounded-lg font-extrabold flex items-center gap-2 hover:bg-surface-container transition-colors"
                >
                  View reports
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  )
}
