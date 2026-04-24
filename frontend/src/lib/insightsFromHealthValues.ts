import type { HealthValue } from './api'
import { groupByCanonical } from './healthValues'
import type { ActionItem, InsightCard } from '../types/insights'

export interface TrendDataPoint {
  date: string
  value: number
  referenceMin?: number
  referenceMax?: number
}

export interface BiomarkerTrend {
  canonical_name: string
  display_name: string
  unit: string
  data: TrendDataPoint[]
  latestDelta?: number
  isFlagged?: boolean
}

export interface InsightsBundle {
  insights: InsightCard[]
  trends: BiomarkerTrend[]
  actions: ActionItem[]
  summaryLines: string[]
}

function formatInsightDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

function formatChartDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export function insightsFromHealthValues(values: HealthValue[]): InsightsBundle {
  const grouped = groupByCanonical(values)
  const insights: InsightCard[] = []
  const actions: ActionItem[] = []
  const actionKeys = new Set<string>()
  const medicalCanonicals = new Set<string>()

  for (const [canonical, arr] of grouped) {
    const latest = arr[arr.length - 1]!
    if (latest.is_flagged) {
      medicalCanonicals.add(canonical)
      const refNote =
        latest.reference_low != null && latest.reference_high != null
          ? `The reference range on that report was ${latest.reference_low}–${latest.reference_high}${
              latest.unit ? ` ${latest.unit}` : ''
            }.`
          : ''
      insights.push({
        id: `medical-${canonical}`,
        category: 'medical',
        headline: `${latest.display_name} is outside the reference range`,
        context: `Your latest result was ${latest.value}${
          latest.unit ? ` ${latest.unit}` : ''
        } (${formatInsightDate(latest.report_date)}). ${refNote} Use your timeline to see earlier values and share this with a clinician if you have questions.`.trim(),
        document_id: latest.document_id,
        created_at: latest.report_date,
      })
      const ak = `doctor-${canonical}`
      if (!actionKeys.has(ak)) {
        actionKeys.add(ak)
        actions.push({
          id: ak,
          type: 'doctor',
          action: `Discuss ${latest.display_name} with your clinician`,
          sub_note: 'Bring your Vitalog timeline or lab PDFs for context.',
        })
      }
    }
  }

  for (const [canonical, arr] of grouped) {
    if (medicalCanonicals.has(canonical)) continue
    const latest = arr[arr.length - 1]!
    if (
      canonical.includes('vitamin') &&
      latest.reference_low != null &&
      latest.value < latest.reference_low
    ) {
      insights.push({
        id: `nutrition-${canonical}`,
        category: 'nutrition',
        headline: `${latest.display_name} may be below your lab's reference range`,
        context: `Your latest value was ${latest.value}${
          latest.unit ? ` ${latest.unit}` : ''
        } (${formatInsightDate(latest.report_date)}), below the lower reference of ${
          latest.reference_low
        }${latest.unit ? ` ${latest.unit}` : ''}. Diet, absorption, and sun exposure can affect vitamins — confirm next steps with your healthcare provider.`,
        document_id: latest.document_id,
        created_at: latest.report_date,
      })
      const ak = `diet-vit-${canonical}`
      if (!actionKeys.has(ak)) {
        actionKeys.add(ak)
        actions.push({
          id: ak,
          type: 'diet',
          action: 'Review diet and supplementation with your clinician',
          sub_note: 'Ask whether recheck timing or dosing changes are appropriate for you.',
        })
      }
      if (canonical.includes('vitamin_d')) {
        const ak2 = 'sun-vitamin-d'
        if (!actionKeys.has(ak2)) {
          actionKeys.add(ak2)
          actions.push({
            id: ak2,
            type: 'exercise',
            action: 'Discuss safe sun exposure and Vitamin D strategy',
            sub_note: 'Many people use a mix of lifestyle and guided supplementation.',
          })
        }
      }
    }
  }

  type TrendCand = { canonical: string; arr: HealthValue[]; pct: number; latest: HealthValue }
  const trendCands: TrendCand[] = []
  for (const [canonical, arr] of grouped) {
    if (arr.length < 2) continue
    const prev = arr[arr.length - 2]!
    const latest = arr[arr.length - 1]!
    let pct = 0
    if (prev.value !== 0) {
      pct = ((latest.value - prev.value) / Math.abs(prev.value)) * 100
    } else if (latest.value !== prev.value) {
      pct = latest.value > prev.value ? 100 : -100
    }
    if (Math.abs(pct) >= 3 || (prev.value === 0 && latest.value !== prev.value)) {
      trendCands.push({ canonical, arr, pct, latest })
    }
  }
  trendCands.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))

  let trendInsightCount = 0
  for (const { canonical, arr, pct, latest } of trendCands) {
    if (trendInsightCount >= 5) break
    const prev = arr[arr.length - 2]!
    const isHb =
      canonical.includes('haemoglobin') || canonical.includes('hemoglobin')
    if (isHb && pct <= -5 && !latest.is_flagged) {
      insights.push({
        id: `lifestyle-${canonical}`,
        category: 'lifestyle',
        headline: `${latest.display_name} has declined between reports`,
        context: `Compared to ${formatInsightDate(prev.report_date)} (${prev.value}${
          latest.unit ? ` ${latest.unit}` : ''
        }) and ${formatInsightDate(latest.report_date)} (${latest.value}${
          latest.unit ? ` ${latest.unit}` : ''
        }), a drop of about ${Math.round(Math.abs(pct) * 10) / 10}%. Worth reviewing with your clinician if you have fatigue or other symptoms.`,
        document_id: latest.document_id,
        created_at: latest.report_date,
      })
      trendInsightCount += 1
      continue
    }
    if (insights.some((i) => i.id === `trend-${canonical}`)) continue
    insights.push({
      id: `trend-${canonical}`,
      category: 'trend',
      headline: `${latest.display_name} changed by ${pct > 0 ? '+' : ''}${Math.round(pct * 10) / 10}% since your prior result`,
      context: `Compared to ${formatInsightDate(prev.report_date)} (${prev.value}${
        latest.unit ? ` ${latest.unit}` : ''
      }) and ${formatInsightDate(latest.report_date)} (${latest.value}${
        latest.unit ? ` ${latest.unit}` : ''
      }). This is an observation from your uploads only — not a diagnosis.`,
      document_id: latest.document_id,
      created_at: latest.report_date,
    })
    trendInsightCount += 1
  }

  const rank = (c: InsightCard['category']) =>
    ({ medical: 0, nutrition: 1, trend: 2, lifestyle: 3 } as const)[c]
  insights.sort(
    (a, b) =>
      rank(a.category) - rank(b.category) ||
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  const trendCharts: BiomarkerTrend[] = []
  const chartCandidates = [...grouped.entries()]
    .filter(([, arr]) => arr.length >= 2)
    .map(([canonical, arr]) => {
      const latest = arr[arr.length - 1]!
      const prev = arr[arr.length - 2]!
      const pct =
        prev.value !== 0
          ? ((latest.value - prev.value) / Math.abs(prev.value)) * 100
          : latest.value !== prev.value
            ? 100
            : 0
      return { canonical, arr, latest, pct }
    })
  chartCandidates.sort((a, b) => {
    if (a.latest.is_flagged !== b.latest.is_flagged) return a.latest.is_flagged ? -1 : 1
    if (a.arr.length !== b.arr.length) return b.arr.length - a.arr.length
    return Math.abs(b.pct) - Math.abs(a.pct)
  })

  for (const { canonical, arr, latest, pct } of chartCandidates.slice(0, 6)) {
    const data: TrendDataPoint[] = arr.map((hv) => ({
      date: formatChartDate(hv.report_date),
      value: hv.value,
      referenceMin: hv.reference_low ?? undefined,
      referenceMax: hv.reference_high ?? undefined,
    }))
    trendCharts.push({
      canonical_name: canonical,
      display_name: latest.display_name,
      unit: latest.unit ?? '',
      data,
      latestDelta: Math.round(pct * 10) / 10,
      isFlagged: latest.is_flagged,
    })
  }

  const flaggedN = [...grouped.values()].filter((a) => a[a.length - 1]!.is_flagged).length
  const multiPointN = [...grouped.values()].filter((a) => a.length >= 2).length
  const summaryLines: string[] = []
  if (values.length === 0) {
    summaryLines.push('Upload a lab report to generate insights from your results.')
  } else {
    summaryLines.push(
      `We are tracking ${grouped.size} biomarker${grouped.size !== 1 ? 's' : ''} from your reports.`
    )
    if (flaggedN > 0) {
      summaryLines.push(
        `${flaggedN} marker${flaggedN !== 1 ? 's' : ''} ${flaggedN === 1 ? 'is' : 'are'} outside the reference range on the latest report.`
      )
    } else {
      summaryLines.push('No markers are flagged outside the reference range on the latest results we have.')
    }
    if (multiPointN > 0) {
      summaryLines.push(
        `${multiPointN} marker${multiPointN !== 1 ? 's' : ''} have at least two results so we can show change over time.`
      )
    }
  }

  return { insights, trends: trendCharts, actions, summaryLines }
}
