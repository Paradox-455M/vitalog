import {
  biomarkerSnapshotChipClass,
  biomarkerStatusIcon,
  biomarkerStatusLabel,
  classifyBiomarkerStatus,
  type BiomarkerRefs,
} from '../lib/biomarkerStatus'

type Props = {
  value: number
  reference_low: number | null
  reference_high: number | null
  className?: string
}

/** Compact status chip: icon + label (not color-only). */
export function BiomarkerStatusChip({ value, reference_low, reference_high, className = '' }: Props) {
  const hv: BiomarkerRefs = { value, reference_low, reference_high }
  const kind = classifyBiomarkerStatus(hv)
  const label = biomarkerStatusLabel(kind)
  const icon = biomarkerStatusIcon(kind)
  return (
    <span
      className={`text-xs font-bold px-2.5 py-1 rounded-full border inline-flex items-center gap-1 ${biomarkerSnapshotChipClass(kind)} ${className}`}
    >
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  )
}
