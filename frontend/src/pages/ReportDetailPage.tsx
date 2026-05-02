import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../lib/api'
import { pollWithBackoff } from '../lib/poll'
import {
  biomarkerStatusIcon,
  biomarkerStatusLabel,
  classifyBiomarkerStatus,
} from '../lib/biomarkerStatus'
import { getReportPrimaryTitle } from '../lib/reportDisplay'

// ── Types ────────────────────────────────────────────────────────────────────

interface DocumentRow {
  id: string
  file_name: string
  lab_name: string | null
  report_date: string | null
  extraction_status: 'pending' | 'processing' | 'complete' | 'failed'
  explanation_text: string | null
  storage_path: string
  created_at: string
}

interface HealthValueRow {
  id: string
  document_id: string
  canonical_name: string
  display_name: string
  value: number
  unit: string | null
  reference_low: number | null
  reference_high: number | null
  is_flagged: boolean
  report_date: string
}

interface Layer2Finding {
  canonical_name: string
  display_name: string
  status: 'flagged' | 'borderline' | 'normal'
  flag_direction: 'low' | 'high' | null
  value: number
  unit: string
  reference_range: string | null
  definition?: string
  plain_explanation: string
  plain_result: string
  severity: 'all_clear' | 'watch' | 'attention' | 'discuss_soon'
}

interface Layer2Result {
  summary: string
  overall_status: 'attention_needed' | 'mostly_normal' | 'all_clear'
  findings: Layer2Finding[]
  all_clear_summary: string
  possible_root_causes: string[]
  what_to_do_next: string
  has_pending_tests: boolean
  pending_note: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function parseExplanation(raw: string | null): Layer2Result | null {
  if (!raw) return null
  try { return JSON.parse(raw) as Layer2Result } catch { return null }
}

function isWorthWatching(f: Layer2Finding): boolean {
  if (f.status === 'flagged' || f.status === 'borderline') return true
  return f.severity === 'watch' || f.severity === 'attention' || f.severity === 'discuss_soon'
}

function whatCanItLeadTo(f: Layer2Finding, rowIndex: number, layer2: Layer2Result): string {
  const causes = layer2.possible_root_causes
  if (causes.length > 0) return causes[rowIndex % causes.length]
  const ex = f.plain_explanation?.trim() ?? ''
  const parts = ex.split(/(?<=[.!?])\s+/).filter(Boolean)
  if (parts.length > 1) return parts.slice(1).join(' ')
  return 'Discuss with your clinician if you have symptoms or concerns. This information is not a diagnosis.'
}

function formatNormalRangeForTile(hv: HealthValueRow, finding: Layer2Finding | undefined): string {
  const fromFinding = finding?.reference_range?.trim()
  if (fromFinding) return fromFinding
  const u = hv.unit ? ` ${hv.unit}` : ''
  if (hv.reference_low != null && hv.reference_high != null) {
    return `${hv.reference_low}–${hv.reference_high}${u}`
  }
  if (hv.reference_high != null) return `≤ ${hv.reference_high}${u}`
  if (hv.reference_low != null) return `≥ ${hv.reference_low}${u}`
  return '—'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: DocumentRow['extraction_status'] }) {
  const map = {
    complete:   { label: 'Complete',   cls: 'bg-secondary-container text-on-secondary-container' },
    processing: { label: 'Processing', cls: 'bg-surface-container-high text-on-surface-variant' },
    pending:    { label: 'Pending',    cls: 'bg-surface-container-high text-on-surface-variant' },
    failed:     { label: 'Failed',     cls: 'bg-error/10 text-error' },
  }
  const { label, cls } = map[status]
  return <span className={`px-3 py-1 rounded-full text-xs font-bold ${cls}`}>{label}</span>
}

function OverallStatusBadge({ status }: { status: Layer2Result['overall_status'] }) {
  if (status === 'all_clear') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
        <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block" />
        All Clear
      </span>
    )
  }
  if (status === 'mostly_normal') {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber/10 text-amber">
        <span className="w-1.5 h-1.5 rounded-full bg-amber inline-block" />
        Mostly Normal
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-error/10 text-error">
      <span className="w-1.5 h-1.5 rounded-full bg-error inline-block" />
      Attention Needed
    </span>
  )
}

function FindingBadge({
  status,
  flagDirection,
  hvRefs,
}: {
  status: Layer2Finding['status']
  flagDirection?: Layer2Finding['flag_direction'] | null
  hvRefs?: Pick<HealthValueRow, 'value' | 'reference_low' | 'reference_high'> | null
}) {
  if (status === 'normal') {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-secondary-container text-on-secondary-container">
        Normal
      </span>
    )
  }
  if (status === 'borderline') {
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber/10 text-amber">
        Borderline
      </span>
    )
  }
  let label: string
  let iconName: string
  if (flagDirection === 'high') {
    label = biomarkerStatusLabel('above')
    iconName = biomarkerStatusIcon('above')
  } else if (flagDirection === 'low') {
    label = biomarkerStatusLabel('below')
    iconName = biomarkerStatusIcon('below')
  } else if (hvRefs) {
    const k = classifyBiomarkerStatus(hvRefs)
    label = biomarkerStatusLabel(k)
    iconName = biomarkerStatusIcon(k)
  } else {
    label = biomarkerStatusLabel('outside')
    iconName = biomarkerStatusIcon('outside')
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-error/10 text-error">
      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">
        {iconName}
      </span>
      {label}
    </span>
  )
}

function FlagDirectionIcon({ direction, status }: { direction: Layer2Finding['flag_direction']; status: Layer2Finding['status'] }) {
  if (!direction || status === 'normal') return null
  if (direction === 'high') {
    return <span className="material-symbols-outlined text-sm text-error">arrow_upward</span>
  }
  return <span className="material-symbols-outlined text-sm text-error">arrow_downward</span>
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="px-4 sm:px-8 lg:px-12 py-8 max-w-7xl mx-auto space-y-10 animate-pulse">
      <div className="flex items-center gap-6">
        <div className="w-16 h-16 rounded-2xl bg-surface-container-high" />
        <div className="space-y-2">
          <div className="h-8 w-64 bg-surface-container-high rounded-lg" />
          <div className="h-4 w-48 bg-surface-container rounded" />
        </div>
      </div>
      <div className="h-40 rounded-2xl bg-surface-container-high" />
      <div className="h-64 rounded-2xl bg-surface-container-high" />
    </div>
  )
}

// ── Processing state ──────────────────────────────────────────────────────────

function ProcessingState({ fileName }: { fileName: string }) {
  return (
    <div className="px-4 sm:px-8 lg:px-12 py-16 max-w-7xl mx-auto text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">
          progress_activity
        </span>
      </div>
      <div>
        <h1 className="font-serif text-2xl font-bold text-on-surface mb-2">
          Analysing your report…
        </h1>
        <p className="text-on-surface-variant text-sm">
          <span className="font-medium">{fileName}</span> is being processed. This page will update automatically.
        </p>
      </div>
      <Link to="/reports" className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        Back to My Reports
      </Link>
    </div>
  )
}

// ── Failed state ──────────────────────────────────────────────────────────────

function FailedState({
  fileName,
  signedUrl,
  onRetry,
  retrying,
}: {
  fileName: string
  signedUrl: string | null
  onRetry?: () => void
  retrying?: boolean
}) {
  return (
    <div className="px-4 sm:px-8 lg:px-12 py-16 max-w-7xl mx-auto text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-error/10 flex items-center justify-center mx-auto">
        <span className="material-symbols-outlined text-error text-4xl">error</span>
      </div>
      <div>
        <h1 className="font-serif text-2xl font-bold text-on-surface mb-2">
          Extraction failed
        </h1>
        <p className="text-on-surface-variant text-sm max-w-md mx-auto">
          We couldn't extract values from <span className="font-medium">{fileName}</span>.
          The original file is safely stored — try uploading a clearer scan.
        </p>
      </div>
      <div className="flex items-center justify-center gap-4">
        {onRetry && (
          <button
            type="button"
            disabled={retrying}
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-full text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {retrying ? 'Retrying…' : 'Retry extraction'}
          </button>
        )}
        {signedUrl && (
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-outline-variant rounded-full text-sm font-semibold hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download original
          </a>
        )}
        <Link to="/reports" className="inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to My Reports
        </Link>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [doc, setDoc] = useState<DocumentRow | null | undefined>(undefined) // undefined = loading
  const [healthValues, setHealthValues] = useState<HealthValueRow[]>([])
  const [signedUrl, setSignedUrl] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)

  const fetchData = useCallback(async (docId: string) => {
    try {
      const [docData, fileUrl] = await Promise.all([
        api.documents.get(docId),
        api.documents.downloadFile(docId),
      ])
      setDoc(docData as unknown as DocumentRow)
      setHealthValues((docData.health_values ?? []) as HealthValueRow[])
      setSignedUrl(fileUrl ?? null)
    } catch {
      setDoc(null)
      setHealthValues([])
      setSignedUrl(null)
    }
  }, [])

  /* eslint-disable react-hooks/set-state-in-effect -- load report on id change */
  useEffect(() => {
    if (!id) return
    fetchData(id)
  }, [id, fetchData])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Poll while processing with exponential backoff.
  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => {
    if (!id) return
    if (doc?.extraction_status !== 'processing' && doc?.extraction_status !== 'pending') return

    const controller = new AbortController()
    abortRef.current = controller

    void pollWithBackoff(
      async () => {
        await fetchData(id)
        return doc?.extraction_status !== 'processing' && doc?.extraction_status !== 'pending'
      },
      controller.signal,
      { initial: 2000, max: 30_000, factor: 1.5 },
    )

    return () => controller.abort()
  }, [id, doc?.extraction_status, fetchData])

  // ── Loading ────────────────────────────────────────────────────────────────
  if (doc === undefined) return <LoadingSkeleton />

  // ── Not found ──────────────────────────────────────────────────────────────
  if (doc === null) {
    return (
      <div className="px-4 sm:px-8 lg:px-12 py-16 max-w-7xl mx-auto text-center">
        <span className="material-symbols-outlined text-5xl text-outline/30 mb-4 block">description</span>
        <h1 className="font-serif text-2xl font-bold text-on-surface mb-2">Report not found</h1>
        <p className="text-on-surface-variant mb-6">
          This report does not exist or has been removed.
        </p>
        <Link to="/reports" className="inline-flex items-center gap-2 text-primary font-semibold hover:underline">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to My Reports
        </Link>
      </div>
    )
  }

  // ── Processing / pending ───────────────────────────────────────────────────
  if (doc.extraction_status === 'pending' || doc.extraction_status === 'processing') {
    return <ProcessingState fileName={doc.file_name} />
  }

  // ── Failed ─────────────────────────────────────────────────────────────────
  if (doc.extraction_status === 'failed') {
    return (
      <FailedState
        fileName={doc.file_name}
        signedUrl={signedUrl}
        retrying={retrying}
        onRetry={async () => {
          if (!id) return
          setRetrying(true)
          try {
            await api.documents.extract(id)
            await fetchData(id)
          } catch {
            /* error is visible via status poll */
          } finally {
            setRetrying(false)
          }
        }}
      />
    )
  }

  // ── Complete ───────────────────────────────────────────────────────────────
  const layer2 = parseExplanation(doc.explanation_text)

  const pageTitle = getReportPrimaryTitle(doc.lab_name, doc.report_date, doc.file_name)

  // Build a lookup map from layer2 findings for enriching health_value rows
  const findingsByCanonical = new Map<string, Layer2Finding>()
  layer2?.findings.forEach((f) => findingsByCanonical.set(f.canonical_name, f))

  const flaggedCount = healthValues.filter((hv) => hv.is_flagged).length

  const worthWatchingFindings = layer2?.findings.filter(isWorthWatching) ?? []
  const keyValuesSorted = [...healthValues]
    .sort((a, b) => Number(b.is_flagged) - Number(a.is_flagged))
    .slice(0, 18)

  return (
    <>
      {/* Sticky topbar */}
      <header className="sticky top-0 z-40 flex justify-between items-center w-full px-4 sm:px-8 lg:px-12 py-4 sm:py-5 bg-surface/70 backdrop-blur-md border-b border-outline-variant/15">
        <div className="flex items-center gap-3 text-sm font-medium pl-14 lg:pl-0">
          <Link to="/reports" className="text-on-surface-variant hover:text-on-surface transition-colors">My Reports</Link>
          <span className="material-symbols-outlined text-xs text-outline/30">chevron_right</span>
          <span className="text-primary font-semibold truncate max-w-xs" title={pageTitle}>
            {pageTitle}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
            >
              <span className="material-symbols-outlined text-xl">download</span>
              <span className="text-sm font-medium">Download original</span>
            </a>
          )}
          <button
            type="button"
            className="flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
            onClick={() => window.print()}
          >
            <span className="material-symbols-outlined text-xl">print</span>
          </button>
        </div>
      </header>

      {/* Page body */}
      <div className="px-4 sm:px-8 lg:px-12 py-8 max-w-7xl mx-auto space-y-10">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 rounded-2xl bg-surface-container-high flex items-center justify-center text-primary shrink-0">
            <span
              className="material-symbols-outlined text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              lab_profile
            </span>
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-on-surface mb-2 font-serif break-words">
              {pageTitle}
            </h1>
            <div className="flex items-center gap-4 text-on-surface-variant text-sm flex-wrap">
              {doc.lab_name && !pageTitle.includes(doc.lab_name.trim()) && (
                <>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">apartment</span>
                    {doc.lab_name}
                  </span>
                  <span>•</span>
                </>
              )}
              <span>{formatDate(doc.report_date)}</span>
              <span>•</span>
              <StatusBadge status={doc.extraction_status} />
              {healthValues.length > 0 && (
                <>
                  <span>•</span>
                  <span>{healthValues.length} values</span>
                  {flaggedCount > 0 && (
                    <span className="text-error font-medium">· {flaggedCount} out of range</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── AI Explanation (What this means) ───────────────────────────── */}
        <div className="bg-surface-container rounded-2xl p-8">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                auto_awesome
              </span>
              <h2 className="font-serif text-xl font-bold text-on-surface">What this means</h2>
            </div>
            {layer2 && <OverallStatusBadge status={layer2.overall_status} />}
          </div>

          {layer2 ? (
            <div className="space-y-4">
              <p className="text-on-surface-variant leading-relaxed">{layer2.summary}</p>

              {layer2.possible_root_causes.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-on-surface mb-2">Possible factors</p>
                  <ul className="space-y-1">
                    {layer2.possible_root_causes.map((cause, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                        <span className="text-primary mt-0.5">·</span>
                        {cause}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {layer2.what_to_do_next && (
                <div className="flex items-start gap-3 p-4 bg-surface rounded-xl border border-outline-variant/20">
                  <span
                    className="material-symbols-outlined text-primary text-xl shrink-0 mt-0.5"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    tips_and_updates
                  </span>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {layer2.what_to_do_next}
                  </p>
                </div>
              )}

              {layer2.all_clear_summary && layer2.overall_status !== 'attention_needed' && (
                <p className="text-sm text-on-surface-variant italic">{layer2.all_clear_summary}</p>
              )}
            </div>
          ) : (
            <p className="text-on-surface-variant">AI analysis not available.</p>
          )}

          <div className="flex items-center gap-2 text-sm text-on-surface-variant italic border-t border-outline-variant/20 pt-4 mt-4">
            <span className="material-symbols-outlined text-sm">info</span>
            This is an observation only, not a medical diagnosis.
          </div>
        </div>

        {/* ── Biomarker findings table ────────────────────────────────────── */}
        {healthValues.length > 0 && (
          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/10">
              <h2 className="font-serif text-xl font-bold text-on-surface">Biomarker Results</h2>
              <span className="text-sm text-on-surface-variant">
                {healthValues.length} value{healthValues.length !== 1 ? 's' : ''} extracted
              </span>
            </div>
            <table className="w-full">
              <thead className="bg-surface-container">
                <tr>
                  {['Name', 'Value', 'Reference Range', 'Status', 'What it measures'].map((col) => (
                    <th
                      key={col}
                      className="text-left text-xs uppercase tracking-widest text-on-surface-variant px-6 py-3 font-semibold"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {healthValues.map((hv) => {
                  const finding = findingsByCanonical.get(hv.canonical_name)
                  const refRange = finding?.reference_range ??
                    (hv.reference_low != null && hv.reference_high != null
                      ? `${hv.reference_low}–${hv.reference_high}`
                      : hv.reference_high != null
                      ? `up to ${hv.reference_high}`
                      : hv.reference_low != null
                      ? `above ${hv.reference_low}`
                      : '—')
                  const status: Layer2Finding['status'] = finding?.status ?? (hv.is_flagged ? 'flagged' : 'normal')
                  return (
                    <tr key={hv.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="px-6 py-4 font-medium text-on-surface">{hv.display_name}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-on-surface">{hv.value}</span>
                          {hv.unit && <span className="text-on-surface-variant text-sm">{hv.unit}</span>}
                          {finding && (
                            <FlagDirectionIcon direction={finding.flag_direction} status={status} />
                          )}
                        </div>
                        {finding?.plain_result && (
                          <p className="text-xs text-on-surface-variant mt-0.5">{finding.plain_result}</p>
                        )}
                      </td>
                      <td className="px-6 py-4 text-on-surface-variant text-sm">{refRange}</td>
                      <td className="px-6 py-4">
                        <FindingBadge
                          status={status}
                          flagDirection={finding?.flag_direction ?? null}
                          hvRefs={
                            status === 'flagged'
                              ? { value: hv.value, reference_low: hv.reference_low, reference_high: hv.reference_high }
                              : undefined
                          }
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-on-surface-variant max-w-xs">
                        {finding?.definition || finding?.plain_explanation || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Worth watching (cards) ─────────────────────────────────────── */}
        {worthWatchingFindings.length > 0 && layer2 && (
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Worth watching
            </h2>
            <div className="space-y-3">
              {worthWatchingFindings.map((f) => {
                const ref =
                  f.reference_range ??
                  (() => {
                    const hv = healthValues.find((h) => h.canonical_name === f.canonical_name)
                    if (hv?.reference_low != null && hv?.reference_high != null) {
                      return `${hv.reference_low}–${hv.reference_high}`
                    }
                    return null
                  })()
                return (
                  <div
                    key={f.canonical_name}
                    className="rounded-xl border border-outline-variant border-l-4 border-l-amber-500 bg-surface-container-lowest p-4"
                  >
                    <h3 className="font-bold text-on-surface">{f.display_name}</h3>
                    <p className="text-sm text-on-surface-variant mt-1">
                      {f.value} {f.unit}
                      {ref ? ` · Ref: ${ref}` : ''}
                    </p>
                    <p className="text-sm text-on-surface mt-2 leading-relaxed">{f.plain_explanation}</p>
                    {f.plain_result && (
                      <p className="text-xs text-on-surface-variant mt-1">{f.plain_result}</p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Implications (table) + Ask analyser ────────────────────────── */}
        {worthWatchingFindings.length > 0 && layer2 && (
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Implications
            </h2>
            <div className="overflow-x-auto rounded-xl border border-outline-variant">
              <table className="w-full text-sm">
                <thead className="bg-surface-container border-b border-outline-variant">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-on-surface">Worth watching</th>
                    <th className="text-left px-4 py-3 font-semibold text-on-surface">What it can lead to</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/30">
                  {worthWatchingFindings.map((f, i) => (
                    <tr key={`imp-${f.canonical_name}`} className="bg-surface-container-lowest">
                      <td className="px-4 py-3 align-top text-on-surface max-w-md">
                        <span className="font-semibold">{f.display_name}</span>
                        <p className="text-on-surface-variant mt-1">
                          {f.plain_result || f.plain_explanation.split(/[.!?]/)[0]}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top text-on-surface-variant max-w-xl">
                        {whatCanItLeadTo(f, i, layer2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-on-surface-variant italic">
              Insights are generated from your stored report analysis. They are not a medical diagnosis.
            </p>
          </section>
        )}

        {/* ── Key values at a glance ───────────────────────────────────── */}
        {keyValuesSorted.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Key values at a glance
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {keyValuesSorted.map((hv) => {
                const finding = findingsByCanonical.get(hv.canonical_name)
                const flagged = hv.is_flagged || finding?.status === 'flagged'
                const borderClass = flagged
                  ? 'border-amber-500/80'
                  : finding?.status === 'normal'
                    ? 'border-secondary'
                    : 'border-outline-variant'
                const rangeText = formatNormalRangeForTile(hv, finding)
                return (
                  <div
                    key={hv.id}
                    className={`rounded-xl border-2 ${borderClass} bg-surface-container-lowest p-3 flex flex-col justify-between min-h-[7.5rem]`}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-on-surface-variant line-clamp-2 leading-tight text-center">
                      {hv.display_name}
                    </p>
                    <p
                      className={`text-xl font-bold font-serif text-center ${
                        flagged ? 'text-amber' : 'text-primary'
                      }`}
                    >
                      {hv.value}
                      {hv.unit && (
                        <span className="text-xs font-normal text-on-surface-variant ml-0.5">{hv.unit}</span>
                      )}
                    </p>
                    <div className="pt-2 mt-auto border-t border-outline-variant/30">
                      <p className="text-[11px] uppercase tracking-wide text-on-surface-variant text-center mb-0.5">
                        Reference range
                      </p>
                      <p className="text-xs text-on-surface text-center leading-snug break-words px-0.5">
                        {rangeText}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── What to do next ─────────────────────────────────────────────── */}
        {layer2 && (
          <div className="bg-surface-container-lowest rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <span
                className="material-symbols-outlined text-primary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                checklist
              </span>
              <h2 className="font-serif text-xl font-bold text-on-surface">Next Steps</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Summary card */}
              <div className="md:col-span-3 bg-surface-container rounded-xl p-5 border border-outline-variant/10">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-secondary-container rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-on-secondary-container">lightbulb</span>
                  </div>
                  <div>
                    <h3 className="font-bold text-on-surface mb-1">Recommended actions</h3>
                    <p className="text-sm text-on-surface-variant leading-relaxed">{layer2.what_to_do_next}</p>
                  </div>
                </div>
              </div>

              {/* Flagged values card — only shown if any */}
              {flaggedCount > 0 && (
                <div className="md:col-span-3 bg-error/5 rounded-xl p-5 border border-error/10">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-error/10 rounded-lg flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-error">flag</span>
                    </div>
                    <div>
                      <h3 className="font-bold text-on-surface mb-2">
                        {flaggedCount} value{flaggedCount !== 1 ? 's' : ''} outside reference range
                      </h3>
                      <ul className="space-y-1">
                        {healthValues
                          .filter((hv) => hv.is_flagged)
                          .map((hv) => {
                            const f = findingsByCanonical.get(hv.canonical_name)
                            return (
                              <li key={hv.id} className="text-sm text-on-surface-variant">
                                <span className="font-medium text-on-surface">{hv.display_name}</span>
                                {f?.plain_result ? ` — ${f.plain_result}` : ` — ${hv.value} ${hv.unit ?? ''}`}
                              </li>
                            )
                          })}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </>
  )
}
