import type { HealthValue } from './api'
import type { BiomarkerEntry } from '../types/biomarkers'
import { getCatalogEntry } from '../data/biomarkerCatalog'

function formatReferenceFromHealthValue(hv: HealthValue): string {
  if (hv.reference_low != null && hv.reference_high != null) {
    const u = hv.unit ? ` ${hv.unit}` : ''
    return `${hv.reference_low}–${hv.reference_high}${u}`
  }
  return 'See your lab report'
}

function syntheticDescription(displayName: string): string {
  return `${displayName} was detected in your uploaded reports. Check your lab report for the reference range provided by your testing lab, and use the timeline to track how this value changes across multiple reports.`
}

/** Merge API health value row with optional catalog enrichment for library UI. */
export function biomarkerRowFromLatest(latest: HealthValue, plainExplanation?: string): BiomarkerEntry {
  const cat = getCatalogEntry(latest.canonical_name)
  if (cat) {
    return { ...cat }
  }
  return {
    id: `user-${latest.canonical_name}`,
    canonical_name: latest.canonical_name,
    display_name: latest.display_name,
    aliases: [],
    category: 'Other',
    normal_range_male: formatReferenceFromHealthValue(latest),
    normal_range_female: formatReferenceFromHealthValue(latest),
    description: plainExplanation ?? syntheticDescription(latest.display_name),
    causes_high: [],
    causes_low: [],
  }
}
