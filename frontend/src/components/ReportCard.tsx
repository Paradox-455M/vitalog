import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

export interface ReportRow {
  id: string
  file_name: string
  lab_name: string | null
  report_date: string | null
  extraction_status: 'pending' | 'processing' | 'complete' | 'failed'
  explanation_text: string | null
  document_type?: string | null
  family_member_id?: string | null
}

export interface FlaggedValue {
  id: string
  display_name: string
  value: number
  unit: string | null
}

interface ReportCardProps {
  report: ReportRow
  flaggedValues?: FlaggedValue[]
  onMenuClick?: (reportId: string) => void
}

function formatReportDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function parseSummary(explanationText: string | null): string {
  if (!explanationText) return 'Processing complete.'
  try {
    const parsed = JSON.parse(explanationText) as { summary?: string }
    return parsed.summary ?? 'Analysis complete.'
  } catch {
    return 'Analysis complete.'
  }
}

function StatusChip({ status }: { status: ReportRow['extraction_status'] }) {
  const map = {
    complete:   { label: 'Complete',   cls: 'bg-secondary-container text-on-secondary-container' },
    processing: { label: 'Processing', cls: 'bg-surface-container-high text-stone-500' },
    pending:    { label: 'Pending',    cls: 'bg-surface-container-high text-stone-500' },
    failed:     { label: 'Failed',     cls: 'bg-error/10 text-error' },
  }
  const { label, cls } = map[status]
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${cls}`}>{label}</span>
  )
}

export const ReportCard = memo(function ReportCard({ report, flaggedValues = [], onMenuClick }: ReportCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const menuItemsRef = useRef<(HTMLButtonElement | null)[]>([])
  const navigate = useNavigate()

  const pillsToShow = flaggedValues.slice(0, 2)
  const summary = parseSummary(report.explanation_text)

  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!menuOpen) return
      if (event.key === 'Escape') { closeMenu(); return }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const items = menuItemsRef.current.filter(Boolean) as HTMLButtonElement[]
        const currentIndex = items.findIndex(item => item === document.activeElement)
        const nextIndex = event.key === 'ArrowDown'
          ? currentIndex < items.length - 1 ? currentIndex + 1 : 0
          : currentIndex > 0 ? currentIndex - 1 : items.length - 1
        items[nextIndex]?.focus()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [menuOpen, closeMenu])

  function handleMenuAction(action: string) {
    setMenuOpen(false)
    if (action === 'view') navigate(`/reports/${report.id}`)
    onMenuClick?.(report.id)
  }

  return (
    <article
      className="bg-surface-container-lowest p-6 rounded-xl transition-all hover:bg-surface-container-low border border-transparent hover:border-outline-variant/20 cursor-pointer"
      onClick={() => navigate(`/reports/${report.id}`)}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-lg">
              {report.file_name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ')}
            </h3>
            <StatusChip status={report.extraction_status} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            {report.lab_name && (
              <>
                <span className="text-xs text-stone-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">lab_profile</span>
                  {report.lab_name}
                </span>
                <span className="text-xs text-stone-500">•</span>
              </>
            )}
            <span className="text-xs text-stone-500">{formatReportDate(report.report_date)}</span>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            ref={menuButtonRef}
            type="button"
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen) }}
            aria-label="Report options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={`report-menu-${report.id}`}
            className="p-1 rounded-full text-stone-400 cursor-pointer hover:text-stone-600 hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined" aria-hidden="true">more_vert</span>
          </button>
          {menuOpen && (
            <div
              id={`report-menu-${report.id}`}
              role="menu"
              aria-label="Report actions"
              className="absolute right-0 top-8 bg-surface-container-lowest border border-outline-variant/20 rounded-lg shadow-lg py-1 min-w-[140px] z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                ref={el => { menuItemsRef.current[0] = el }}
                role="menuitem"
                onClick={() => handleMenuAction('view')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors text-left focus:bg-surface-container focus:outline-none"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">visibility</span>
                View
              </button>
              <button
                ref={el => { menuItemsRef.current[1] = el }}
                role="menuitem"
                onClick={() => handleMenuAction('share')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-on-surface hover:bg-surface-container transition-colors text-left focus:bg-surface-container focus:outline-none"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">share</span>
                Share
              </button>
              <hr className="my-1 border-outline-variant/20" aria-hidden="true" />
              <button
                ref={el => { menuItemsRef.current[2] = el }}
                role="menuitem"
                onClick={() => handleMenuAction('delete')}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-error hover:bg-error-container/30 transition-colors text-left focus:bg-error-container/30 focus:outline-none"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">delete</span>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {report.extraction_status === 'complete' && (
        <p className="text-sm text-on-surface-variant leading-relaxed mb-4">
          <span className="text-primary font-bold">AI Summary: </span>
          {summary}
        </p>
      )}

      {report.extraction_status === 'processing' || report.extraction_status === 'pending' ? (
        <p className="text-sm text-stone-400 italic mb-4">Analysing your report…</p>
      ) : null}

      {report.extraction_status === 'failed' && (
        <p className="text-sm text-error/70 mb-4">Extraction failed — original file is saved.</p>
      )}

      {pillsToShow.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pillsToShow.map((hv) => (
            <span
              key={hv.id}
              className="bg-amber-container text-tertiary px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-tertiary/10"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-tertiary" aria-hidden="true" />
              {hv.display_name} {hv.value} {hv.unit}
            </span>
          ))}
          {flaggedValues.length > 2 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-surface-container text-stone-500">
              +{flaggedValues.length - 2} more
            </span>
          )}
        </div>
      )}
    </article>
  )
})
