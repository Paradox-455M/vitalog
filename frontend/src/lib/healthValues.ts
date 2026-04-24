import type { HealthValue } from './api'

/** Group values by `canonical_name`, each array sorted by `report_date` ascending. */
export function groupByCanonical(values: HealthValue[]): Map<string, HealthValue[]> {
  const map = new Map<string, HealthValue[]>()
  for (const v of values) {
    const arr = map.get(v.canonical_name) ?? []
    arr.push(v)
    map.set(v.canonical_name, arr)
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
  }
  return map
}

/** Latest row per `canonical_name` (by report_date). */
export function latestByCanonical(values: HealthValue[]): Map<string, HealthValue> {
  const map = new Map<string, HealthValue>()
  const grouped = groupByCanonical(values)
  for (const [canonical, arr] of grouped) {
    map.set(canonical, arr[arr.length - 1]!)
  }
  return map
}

/**
 * Latest values whose `canonical_name` is not in the provided curated catalog set
 * (e.g. extractions the static library does not list).
 */
export function unknownCanonicalHealthValues(
  values: HealthValue[],
  knownCanonicals: ReadonlySet<string>
): { canonical: string; latest: HealthValue }[] {
  const map = latestByCanonical(values)
  const out: { canonical: string; latest: HealthValue }[] = []
  for (const [canonical, latest] of map) {
    if (!knownCanonicals.has(canonical)) {
      out.push({ canonical, latest })
    }
  }
  out.sort((a, b) => a.latest.display_name.localeCompare(b.latest.display_name))
  return out
}

/** Stable `id` for trend chart cards (for deep-links from Biomarker Library). */
export function timelineChartElementId(canonical: string) {
  return `timeline-biomarker-${canonical.replace(/[^a-zA-Z0-9_-]+/g, '_')}`
}
