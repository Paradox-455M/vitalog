import { useState, useRef, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { ReportRow, FlaggedValue } from './ReportCard'
import { ConfirmModal } from './ConfirmModal'
import { getReportPrimaryTitle, getReportSubtitle } from '../lib/reportDisplay'

function formatReportDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function rowIcon(documentType: string | null | undefined, fileName: string): string {
  const t = (documentType ?? '').toLowerCase()
  if (t === 'scan') return 'radiology'
  if (t === 'prescription') return 'prescriptions'
  if (t === 'blood_test' || /cbc|blood|hemogram/i.test(fileName)) return 'water_drop'
  return 'description'
}

function iconBgClass(documentType: string | null | undefined, fileName: string): string {
  const t = (documentType ?? '').toLowerCase()
  if (t === 'scan') return 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
  if (t === 'prescription') return 'bg-primary-fixed text-on-primary-fixed-variant'
  if (t === 'blood_test' || /cbc|blood/i.test(fileName)) return 'bg-secondary-container text-on-secondary-container'
  return 'bg-surface-container-high text-outline'
}

interface ReportsTableProps {
  reports: ReportRow[]
  flaggedMap: Map<string, FlaggedValue[]>
  loading: boolean
  onDelete?: (id: string) => Promise<void>
}

export function ReportsTable({ reports, flaggedMap, loading, onDelete }: ReportsTableProps) {
  const navigate = useNavigate()
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDownload = useCallback(async (e: React.MouseEvent, docId: string) => {
    e.stopPropagation()
    try {
      const url = await api.documents.downloadFile(docId)
      if (url) window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      /* ignore */
    }
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!pendingDeleteId || !onDelete) return
    const id = pendingDeleteId
    setDeletingId(id)
    setPendingDeleteId(null)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }, [onDelete, pendingDeleteId])

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
        <div className="h-12 bg-surface-container-low border-b border-outline-variant animate-pulse" />
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="h-20 border-b border-outline-variant animate-pulse bg-surface-container-lowest" />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden">
      <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-surface-container-low border-b border-outline-variant text-[10px] uppercase tracking-wider font-bold text-outline">
        <div className="col-span-5 sm:col-span-5">Report details</div>
        <div className="col-span-2 hidden sm:block">Date</div>
        <div className="col-span-3 sm:col-span-2">Status</div>
        <div className="col-span-4 sm:col-span-3 text-right">Actions</div>
      </div>

      {reports.map((r) => {
        const primaryTitle = getReportPrimaryTitle(r.lab_name, r.report_date, r.file_name)
        const subtitle = getReportSubtitle(r.lab_name, r.report_date, r.file_name)
        const flagged = flaggedMap.get(r.id) ?? []
        const needsAttention = r.extraction_status === 'complete' && flagged.length > 0
        const statusLabel =
          r.extraction_status === 'complete'
            ? needsAttention
              ? 'Out of range'
              : 'Processed'
            : r.extraction_status === 'processing' || r.extraction_status === 'pending'
              ? 'Processing'
              : r.extraction_status === 'failed'
                ? 'Failed'
                : 'Processed'

        const statusClass =
          r.extraction_status === 'complete'
            ? needsAttention
              ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant border border-tertiary'
              : 'bg-secondary-fixed text-on-secondary-fixed-variant'
            : r.extraction_status === 'failed'
              ? 'bg-error-container text-on-error-container'
              : 'bg-surface-container-high text-outline border border-outline-variant'

        const canView = r.extraction_status === 'complete'
        const processing = r.extraction_status === 'processing' || r.extraction_status === 'pending'

        return (
          <div
            key={r.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/reports/${r.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                navigate(`/reports/${r.id}`)
              }
            }}
            className="grid grid-cols-12 gap-4 px-4 sm:px-6 py-5 items-center border-b border-outline-variant hover:bg-surface-container-lowest transition-colors cursor-pointer group last:border-b-0"
          >
            <div className="col-span-12 sm:col-span-5 flex items-center gap-4 min-w-0">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBgClass(r.document_type, r.file_name)}`}
              >
                <span className="material-symbols-outlined">{rowIcon(r.document_type, r.file_name)}</span>
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-on-surface truncate" title={primaryTitle}>
                  {primaryTitle}
                </h4>
                {subtitle ? (
                  <p className="text-xs text-outline truncate" title={subtitle}>
                    {subtitle}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="col-span-6 sm:col-span-2 text-sm text-on-surface-variant font-medium hidden sm:block">
              {formatReportDate(r.report_date)}
            </div>
            <div className="col-span-6 sm:col-span-2">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusClass} ${processing ? 'animate-pulse' : ''}`}
              >
                {statusLabel}
              </span>
            </div>
            <div
              className="col-span-12 sm:col-span-3 flex items-center justify-end gap-2 sm:gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              {canView ? (
                <Link
                  to={`/reports/${r.id}`}
                  className="text-xs font-bold text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  View summary
                </Link>
              ) : (
                <span className="text-xs font-bold text-outline">Summary pending</span>
              )}
              <button
                type="button"
                onClick={(e) => handleDownload(e, r.id)}
                className={`p-1.5 text-outline hover:text-primary transition-colors ${processing ? 'opacity-50' : ''}`}
                aria-label="Download original"
              >
                <span className="material-symbols-outlined text-lg">download</span>
              </button>
              <div className="relative" ref={menuOpenId === r.id ? menuRef : undefined}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setMenuOpenId((id) => (id === r.id ? null : r.id))
                  }}
                  className="p-1.5 text-outline hover:text-primary transition-colors rounded-full"
                  aria-label="More actions"
                  aria-expanded={menuOpenId === r.id}
                >
                  <span className="material-symbols-outlined text-lg">more_vert</span>
                </button>
                {menuOpenId === r.id && (
                  <div
                    role="menu"
                    className="absolute right-0 top-9 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-lg py-1 min-w-[140px] z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-4 py-2 text-left text-sm hover:bg-surface-container"
                      onClick={() => {
                        setMenuOpenId(null)
                        navigate(`/reports/${r.id}`)
                      }}
                    >
                      View report
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      className="w-full px-4 py-2 text-left text-sm hover:bg-surface-container"
                      onClick={(e) => void handleDownload(e, r.id)}
                    >
                      Download
                    </button>
                    {onDelete && (
                      <button
                        type="button"
                        role="menuitem"
                        disabled={deletingId === r.id}
                        className="w-full px-4 py-2 text-left text-sm text-error hover:bg-error-container/20 disabled:opacity-50"
                        onClick={() => {
                          setMenuOpenId(null)
                          setPendingDeleteId(r.id)
                        }}
                      >
                        {deletingId === r.id ? 'Deleting…' : 'Delete report'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <ConfirmModal
        isOpen={pendingDeleteId !== null}
        onClose={() => setPendingDeleteId(null)}
        onConfirm={handleConfirmDelete}
        title="Delete report"
        description="This will permanently remove the report and all its extracted health values. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deletingId !== null && pendingDeleteId === null}
      />
    </div>
  )
}
