import type { HealthValue } from './api'
import type { BiomarkerEntry } from '../types/biomarkers'
import { getCatalogEntry } from '../data/biomarkerCatalog'

export function formatReferenceRange(hv: HealthValue, referenceRange?: string | null): string {
  const fromAnalyser = referenceRange?.trim()
  if (fromAnalyser) return fromAnalyser

  const u = hv.unit ? ` ${hv.unit}` : ''
  if (hv.reference_low != null && hv.reference_high != null) {
    return `${hv.reference_low}–${hv.reference_high}${u}`
  }
  if (hv.reference_high != null) return `<${hv.reference_high}${u}`
  if (hv.reference_low != null) return `>${hv.reference_low}${u}`
  return 'See your lab report'
}

function syntheticDescription(displayName: string): string {
  return `${displayName} was detected in your uploaded reports. Check your lab report for the reference range provided by your testing lab, and use the timeline to track how this value changes across multiple reports.`
}

/** Merge API health value row with optional catalog enrichment for library UI. */
export function biomarkerRowFromLatest(
  latest: HealthValue,
  plainExplanation?: string,
  referenceRange?: string | null,
): BiomarkerEntry {
  const cat = getCatalogEntry(latest.canonical_name)
  const reportRange = formatReferenceRange(latest, referenceRange)
  if (cat) {
    return {
      ...cat,
      normal_range_male: reportRange !== 'See your lab report' ? reportRange : cat.normal_range_male,
      normal_range_female: reportRange !== 'See your lab report' ? reportRange : cat.normal_range_female,
      description: plainExplanation ?? cat.description,
    }
  }
  return {
    id: `user-${latest.canonical_name}`,
    canonical_name: latest.canonical_name,
    display_name: latest.display_name,
    aliases: [],
    category: 'Other',
    normal_range_male: reportRange,
    normal_range_female: reportRange,
    description: plainExplanation ?? syntheticDescription(latest.display_name),
    causes_high: [],
    causes_low: [],
  }
}
