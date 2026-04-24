import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { BiomarkerEntry } from '../types/biomarkers'
import type { HealthValue } from '../lib/api'

interface BiomarkerDetailDrawerProps {
  biomarker: BiomarkerEntry | null
  isOpen: boolean
  onClose: () => void
  latestValue?: HealthValue | null
}

function formatReportDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, { dateStyle: 'medium' })
  } catch {
    return iso
  }
}

export function BiomarkerDetailDrawer({
  biomarker,
  isOpen,
  onClose,
  latestValue = null,
}: BiomarkerDetailDrawerProps) {
  const drawerRef = useRef<HTMLElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    // Store previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement

    // Focus the drawer
    drawerRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }

      // Focus trap
      if (e.key === 'Tab' && drawerRef.current) {
        const focusableElements = drawerRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0]
        const lastElement = focusableElements[focusableElements.length - 1]

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      // Return focus to previously focused element
      previousActiveElement.current?.focus()
    }
  }, [isOpen, onClose])

  if (!biomarker) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="biomarker-drawer-title"
        tabIndex={-1}
        className={`fixed right-0 top-0 h-full w-full max-w-lg bg-surface z-50 shadow-2xl transform transition-transform duration-300 ease-out focus:outline-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="h-full overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-surface/95 backdrop-blur-md border-b border-outline-variant/20 px-8 py-6 flex items-start justify-between">
            <div>
              <span className="px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-xs font-semibold mb-3 inline-block">
                {biomarker.category}
              </span>
              <h2 id="biomarker-drawer-title" className="font-serif text-3xl font-bold text-on-surface">{biomarker.display_name}</h2>
              {biomarker.aliases.length > 0 && (
                <p className="text-sm text-on-surface-variant mt-1">
                  Also known as: {biomarker.aliases.join(', ')}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-surface-container transition-colors"
              aria-label="Close"
            >
              <span className="material-symbols-outlined text-on-surface-variant">close</span>
            </button>
          </div>

          {/* Content */}
          <div className="px-8 py-8 space-y-8">
            {latestValue && (
              <section className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                <h3 className="font-serif text-lg font-bold text-primary mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">lab_profile</span>
                  Your latest result
                </h3>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-3xl font-bold font-serif text-on-surface">
                    {latestValue.value}
                    {latestValue.unit ? ` ${latestValue.unit}` : ''}
                  </span>
                  {latestValue.is_flagged && (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-light text-amber-text">
                      Outside reference on latest report
                    </span>
                  )}
                </div>
                <p className="text-sm text-on-surface-variant mt-1">
                  Report date: {formatReportDate(latestValue.report_date)}
                </p>
                {latestValue.reference_low != null && latestValue.reference_high != null && (
                  <p className="text-sm text-on-surface-variant mt-2">
                    Reference on report: {latestValue.reference_low} – {latestValue.reference_high}
                    {latestValue.unit ? ` ${latestValue.unit}` : ''}
                  </p>
                )}
              </section>
            )}

            {/* What it measures */}
            <section>
              <h3 className="font-serif text-xl font-bold text-primary mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">science</span>
                What it measures
              </h3>
              <p className="text-on-surface leading-relaxed">{biomarker.description}</p>
            </section>

            {/* Normal ranges */}
            <section className="bg-surface-container-low rounded-xl p-6">
              <h3 className="font-serif text-lg font-bold text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">straighten</span>
                Reference ranges
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-surface rounded-lg p-4 border border-outline-variant/20">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Male</p>
                  <p className="text-lg font-bold text-on-surface">{biomarker.normal_range_male}</p>
                </div>
                <div className="bg-surface rounded-lg p-4 border border-outline-variant/20">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">Female</p>
                  <p className="text-lg font-bold text-on-surface">{biomarker.normal_range_female}</p>
                </div>
              </div>
            </section>

            {/* Causes of high */}
            {biomarker.causes_high.length > 0 && biomarker.causes_high[0] !== 'Generally not clinically significant' && (
              <section>
                <h3 className="font-serif text-lg font-bold text-primary mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-amber">trending_up</span>
                  Why levels may be high
                </h3>
                <ul className="space-y-2">
                  {biomarker.causes_high.map((cause, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber mt-2 shrink-0" />
                      <span className="text-on-surface-variant">{cause}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Causes of low */}
            {biomarker.causes_low.length > 0 && biomarker.causes_low[0] !== 'Generally not clinically significant' && (
              <section>
                <h3 className="font-serif text-lg font-bold text-primary mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">trending_down</span>
                  Why levels may be low
                </h3>
                <ul className="space-y-2">
                  {biomarker.causes_low.map((cause, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-secondary mt-2 shrink-0" />
                      <span className="text-on-surface-variant">{cause}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Disclaimer */}
            <section className="bg-surface-container rounded-xl p-5 border border-outline-variant/20">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-on-surface-variant text-sm">info</span>
                <p className="text-xs text-on-surface-variant leading-relaxed italic">
                  This information is for educational purposes only and does not constitute medical advice.
                  Always consult with a healthcare provider for diagnosis and treatment.
                </p>
              </div>
            </section>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4">
              <Link
                to={`/timeline?canonical=${encodeURIComponent(biomarker.canonical_name)}`}
                onClick={onClose}
                className="flex-1 min-w-[12rem] bg-primary text-on-primary py-3 rounded-full font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-base">timeline</span>
                See my values
              </Link>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
