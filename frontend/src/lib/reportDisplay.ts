/** UUID v4 pattern (hex with optional hyphens) */
const UUID_LIKE =
  /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

/** Long hex / hash-like basename (no extension) */
const HASH_LIKE = /^[0-9a-f]{24,}$/i

export function isCrypticFileName(fileName: string): boolean {
  const base = fileName.replace(/\.[^/.]+$/, '').trim()
  if (base.length === 0) return true
  if (UUID_LIKE.test(base) || HASH_LIKE.test(base)) return true
  if (base.length > 48 && /^[0-9a-z_-]+$/i.test(base)) return true
  return false
}

export function formatReportDateShort(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Primary heading: lab + date, or friendly fallback when filename is not human-readable */
export function getReportPrimaryTitle(
  labName: string | null,
  reportDate: string | null,
  fileName: string,
): string {
  const datePart = formatReportDateShort(reportDate)
  if (labName?.trim()) {
    return `${labName.trim()} · ${datePart}`
  }
  if (!isCrypticFileName(fileName)) {
    const friendly = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim()
    return friendly ? `${friendly} · ${datePart}` : `Lab report · ${datePart}`
  }
  return `Lab report · ${datePart}`
}

/** Secondary line under title: lab if title already used date-only context, else omit */
export function getReportSubtitle(
  labName: string | null,
  reportDate: string | null,
  fileName: string,
): string | null {
  if (isCrypticFileName(fileName)) return null
  const friendly = fileName.replace(/\.[^/.]+$/, '').replace(/_/g, ' ').trim()
  if (!friendly) return null
  const primary = getReportPrimaryTitle(labName, reportDate, fileName)
  if (primary.includes(friendly)) return null
  return friendly
}
