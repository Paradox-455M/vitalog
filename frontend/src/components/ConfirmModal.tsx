import { useState, useRef, useEffect, useCallback } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  requireText?: string
  loading?: boolean
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  requireText,
  loading = false,
}: ConfirmModalProps) {
  const [typed, setTyped] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    if (loading) return
    setTyped('')
    onClose()
  }, [loading, onClose])

  const handleConfirm = useCallback(async () => {
    if (requireText && typed !== requireText) return
    await onConfirm()
    setTyped('')
  }, [onConfirm, requireText, typed])

  useEffect(() => {
    if (!isOpen) return

    previousActiveElement.current = document.activeElement as HTMLElement
    setTimeout(() => {
      if (requireText) {
        inputRef.current?.focus()
      } else {
        confirmButtonRef.current?.focus()
      }
    }, 0)
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
        return
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
    }
  }, [isOpen, handleClose, requireText])

  if (!isOpen) return null

  const confirmDisabled = loading || (!!requireText && typed !== requireText)
  const confirmClass =
    variant === 'danger'
      ? 'bg-error text-on-error hover:opacity-90 disabled:opacity-50'
      : 'bg-primary text-on-primary hover:opacity-90 disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        className="relative bg-surface rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl"
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-container transition-colors disabled:opacity-40"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-on-surface-variant">close</span>
        </button>

        {variant === 'danger' && (
          <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center mb-4">
            <span
              className="material-symbols-outlined text-error"
              style={{ fontVariationSettings: "'FILL' 1" }}
              aria-hidden="true"
            >
              warning
            </span>
          </div>
        )}

        <h3
          id="confirm-modal-title"
          className="font-serif text-xl font-bold text-on-surface mb-2"
        >
          {title}
        </h3>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-5">{description}</p>

        {requireText && (
          <div className="mb-5">
            <label
              htmlFor="confirm-modal-input"
              className="block text-xs font-semibold text-on-surface-variant mb-1.5 uppercase tracking-widest"
            >
              Type <span className="font-mono text-on-surface">{requireText}</span> to confirm
            </label>
            <input
              ref={inputRef}
              id="confirm-modal-input"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              disabled={loading}
              autoComplete="off"
              spellCheck={false}
              className="w-full border border-outline-variant rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-error/30 focus:border-error bg-surface disabled:opacity-50"
              aria-describedby="confirm-modal-title"
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button
            ref={confirmButtonRef}
            type="button"
            onClick={() => void handleConfirm()}
            disabled={confirmDisabled}
            className={`w-full py-3 rounded-full font-semibold text-sm transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${confirmClass} ${
              variant === 'danger' ? 'focus-visible:ring-error' : 'focus-visible:ring-primary'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Working…
              </span>
            ) : (
              confirmLabel
            )}
          </button>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="w-full text-center text-on-surface-variant font-semibold text-sm py-2 hover:text-on-surface transition-colors disabled:opacity-40"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
