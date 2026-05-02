export type BiomarkerStatusKind = 'above' | 'below' | 'outside'

export interface BiomarkerRefs {
  value: number
  reference_low: number | null
  reference_high: number | null
}

export function classifyBiomarkerStatus(hv: BiomarkerRefs): BiomarkerStatusKind {
  if (hv.reference_high !== null && hv.value > hv.reference_high) return 'above'
  if (hv.reference_low !== null && hv.value < hv.reference_low) return 'below'
  return 'outside'
}

export function biomarkerStatusLabel(kind: BiomarkerStatusKind): string {
  switch (kind) {
    case 'above':
      return 'Above reference'
    case 'below':
      return 'Below reference'
    case 'outside':
      return 'Outside reference'
  }
}

export function biomarkerStatusIcon(kind: BiomarkerStatusKind): string {
  switch (kind) {
    case 'above':
      return 'trending_up'
    case 'below':
      return 'trending_down'
    case 'outside':
      return 'priority_high'
  }
}

/** Snapshot chip: text + icon; not color-only (icon carries meaning). */
export function biomarkerSnapshotChipClass(kind: BiomarkerStatusKind): string {
  switch (kind) {
    case 'above':
      return 'text-amber bg-amber/10 border-amber/20'
    case 'below':
      return 'text-primary bg-primary/10 border-primary/20'
    case 'outside':
      return 'text-on-surface-variant bg-surface-container-high border-outline-variant/30'
  }
}

export function biomarkerPillClass(kind: BiomarkerStatusKind): string {
  switch (kind) {
    case 'above':
      return 'bg-amber-container text-tertiary border-tertiary/10'
    case 'below':
      return 'bg-primary-fixed/30 text-primary border-primary/15'
    case 'outside':
      return 'bg-surface-container-high text-on-surface-variant border-outline-variant/20'
  }
}
