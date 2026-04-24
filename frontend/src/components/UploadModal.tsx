import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { FREE_TIER_MAX_DOCUMENTS } from '../hooks/useProfile'
import { pollWithBackoff } from '../lib/poll'

type UploadState = 'idle' | 'uploading' | 'extracting' | 'complete' | 'failed'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called when extraction finishes successfully (health values are available). */
  onUploadComplete?: () => void
}

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png']
const MAX_BYTES = 20 * 1024 * 1024

const FREE_UPLOAD_LIMIT_CODE = 'free_upload_limit'

function FreeUploadLimitNotice({
  serverDetail,
  onClose,
}: {
  serverDetail: string | null
  onClose: () => void
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <div className="w-14 h-14 rounded-full bg-secondary-container flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-3xl" aria-hidden="true">
          lock
        </span>
      </div>
      <div className="text-center space-y-2">
        <h3 className="font-serif text-xl font-bold text-on-surface">
          You’ve used all {FREE_TIER_MAX_DOCUMENTS} free uploads
        </h3>
        <p className="text-sm text-stone-600">
          Your free plan includes up to {FREE_TIER_MAX_DOCUMENTS} saved reports. Upgrade to Pro for unlimited uploads
          and more family profiles.
        </p>
        {serverDetail ? (
          <p className="text-sm text-stone-500 pt-1">{serverDetail}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 w-full">
        <Link
          to="/settings/subscription"
          className="block w-full py-3 bg-primary text-white rounded-full font-semibold text-sm text-center hover:opacity-90 transition-opacity"
          onClick={onClose}
        >
          View plans & upgrade
        </Link>
        <Link
          to="/reports"
          className="block w-full py-3 border border-outline-variant rounded-full text-sm text-center text-on-surface hover:bg-surface-container-low transition-colors"
          onClick={onClose}
        >
          Review your reports
        </Link>
      </div>
    </div>
  )
}

export function UploadModal({ isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const [uploadState, setUploadState] = useState<UploadState>('idle')
  const [fileName, setFileName] = useState('')
  const [resultSummary, setResultSummary] = useState<{ count: number; flagged: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [completedDocId, setCompletedDocId] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [profileGate, setProfileGate] = useState<'loading' | 'ready'>('ready')
  const [freeLimitBlocked, setFreeLimitBlocked] = useState(false)
  const [freeLimitServerDetail, setFreeLimitServerDetail] = useState<string | null>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const prevIsOpenRef = useRef(false)
  /** Prevents backdrop close when orphaned click targets overlay after programmatic file input.click() (mousedown on button → mouseup on backdrop). */
  const suppressBackdropCloseRef = useRef(false)
  const navigate = useNavigate()

  // Reset when modal opens (false → true only; avoids Strict Mode wiping state while isOpen stays true)
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      setUploadState('idle')
      setFileName('')
      setResultSummary(null)
      setErrorMessage(null)
      setCompletedDocId(null)
      setIsDragOver(false)
      setFreeLimitBlocked(false)
      setFreeLimitServerDetail(null)
      setProfileGate('loading')
      void (async () => {
        try {
          const p = await api.profile.get()
          const blocked = p.plan !== 'pro' && p.document_count >= FREE_TIER_MAX_DOCUMENTS
          setFreeLimitBlocked(blocked)
        } catch {
          setFreeLimitBlocked(false)
        } finally {
          setProfileGate('ready')
        }
      })()
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen])

  // Focus trap + Escape
  useEffect(() => {
    if (!isOpen) return
    previousActiveElement.current = document.activeElement as HTMLElement
    modalRef.current?.focus()
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Tab' && modalRef.current) {
        const els = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const first = els[0]; const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
    }
  }, [isOpen, onClose])

  const runPipeline = useCallback(async (file: File) => {
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const p = await api.profile.get()
      if (p.plan !== 'pro' && p.document_count >= FREE_TIER_MAX_DOCUMENTS) {
        setFreeLimitBlocked(true)
        setFreeLimitServerDetail(null)
        setUploadState('idle')
        return
      }
    } catch {
      setErrorMessage('Could not verify your plan. Check your connection and try again.')
      setUploadState('failed')
      return
    }

    setUploadState('uploading')
    try {
      const uploaded = await api.documents.upload(file)
      window.dispatchEvent(new Event('vitalog-documents-changed'))
      setUploadState('extracting')
      // Extraction is started server-side on upload; poll until complete.

      let resolvedDoc = uploaded
      let settled = false

      await pollWithBackoff(
        async () => {
          const latest = await api.documents.get(uploaded.id)
          resolvedDoc = latest

          if (latest.extraction_status === 'complete') {
            setResultSummary({
              count: latest.health_values.length,
              flagged: latest.health_values.filter((value) => value.is_flagged).length,
            })
            setCompletedDocId(uploaded.id)
            setUploadState('complete')
            onUploadComplete?.()
            settled = true
            return true
          }

          if (latest.extraction_status === 'failed') {
            setErrorMessage('Extraction failed. Please try again with a clearer file.')
            setUploadState('failed')
            settled = true
            return true
          }

          return false
        },
        controller.signal,
        { initial: 2000, max: 30_000, factor: 1.5 },
      )

      if (!settled && !controller.signal.aborted) {
        setErrorMessage('Extraction timed out. Please check report status in My Reports.')
        setCompletedDocId(resolvedDoc.id)
        setUploadState('failed')
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError' || controller.signal.aborted) return
      if (err instanceof ApiError && err.status === 403) {
        const body = err.body as { code?: string; error?: string } | null | undefined
        if (body?.code === FREE_UPLOAD_LIMIT_CODE) {
          setFreeLimitBlocked(true)
          setFreeLimitServerDetail(typeof body.error === 'string' ? body.error : null)
          setUploadState('idle')
          return
        }
      }
      setErrorMessage(err instanceof Error ? err.message : 'Upload failed')
      setUploadState('failed')
    }
  }, [onUploadComplete])

  function handleFileSelect(file: File) {
    if (freeLimitBlocked) return
    if (!ALLOWED_TYPES.includes(file.type)) {
      setErrorMessage('Unsupported file type. Use PDF, JPG, or PNG.')
      setUploadState('failed')
      return
    }
    if (file.size > MAX_BYTES) {
      setErrorMessage('File too large. Maximum 20 MB.')
      setUploadState('failed')
      return
    }
    setFileName(file.name)
    runPipeline(file)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    if (freeLimitBlocked) return
    const file = e.dataTransfer.files?.[0]
    if (file) handleFileSelect(file)
  }

  function handleCancel() {
    abortRef.current?.abort()
    setUploadState('idle')
    setFileName('')
  }

  function triggerFilePicker() {
    if (freeLimitBlocked) return
    suppressBackdropCloseRef.current = true
    fileInputRef.current?.click()
    window.setTimeout(() => {
      suppressBackdropCloseRef.current = false
    }, 600)
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (suppressBackdropCloseRef.current) return
    if (e.target !== e.currentTarget) return
    onClose()
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(27,28,24,0.4)' }}
      onClick={handleBackdropClick}
      role="presentation"
    >
      {/* File input: not display:none so programmatic .click() is reliable across browsers */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="sr-only"
        onChange={handleFileInputChange}
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        tabIndex={-1}
        className="bg-white rounded-3xl p-8 max-w-lg w-full mx-4 shadow-2xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >

        {/* ── idle ─────────────────────────────────────────────────────────── */}
        {uploadState === 'idle' && (
          <div className="flex flex-col items-center gap-6">
            <div className="flex justify-between items-center w-full">
              <h2 id="upload-modal-title" className="font-serif text-xl font-bold">
                {freeLimitBlocked ? 'Upload limit reached' : 'Upload Report'}
              </h2>
              <button type="button" className="text-stone-400 hover:text-stone-600" onClick={onClose} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {profileGate === 'loading' ? (
              <div className="w-full py-16 flex flex-col items-center gap-3 text-stone-500" role="status" aria-live="polite">
                <span className="material-symbols-outlined text-3xl animate-spin" aria-hidden="true">progress_activity</span>
                <p className="text-sm">Checking your plan…</p>
              </div>
            ) : freeLimitBlocked ? (
              <FreeUploadLimitNotice serverDetail={freeLimitServerDetail} onClose={onClose} />
            ) : (
              <>
                <div
                  className={`w-full py-12 flex flex-col items-center gap-4 rounded-3xl cursor-pointer transition-colors ${isDragOver ? 'bg-primary/5' : 'hover:bg-surface-container-low'}`}
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='24' ry='24' stroke='%23C8DFD0' stroke-width='3' stroke-dasharray='12%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e\")",
                  }}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => triggerFilePicker()}
                >
                  <span className="material-symbols-outlined text-5xl text-primary">cloud_upload</span>
                  <p className="text-lg font-semibold text-on-surface">Drop your report here</p>
                  <p className="text-sm text-stone-500">PDF, JPG, PNG — max 20 MB</p>
                  <button
                    type="button"
                    className="mt-2 px-6 py-2.5 bg-primary text-white rounded-full text-sm font-semibold"
                    onClick={(e) => { e.stopPropagation(); triggerFilePicker() }}
                  >
                    Browse files
                  </button>
                </div>

                <p className="text-xs text-stone-400 text-center">
                  Supports: Apollo, SRL, Dr. Lal PathLabs, Thyrocare, Metropolis
                </p>
              </>
            )}
          </div>
        )}

        {/* ── uploading ────────────────────────────────────────────────────── */}
        {uploadState === 'uploading' && (
          <div className="flex flex-col gap-6" role="status" aria-live="polite">
            <div className="flex justify-between items-center">
              <h2 id="upload-modal-title" className="font-serif text-xl font-bold">Uploading…</h2>
              <button type="button" className="text-stone-400 hover:text-stone-600" onClick={onClose} aria-label="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex items-center gap-4 p-4 bg-surface-container rounded-xl">
              <span className="material-symbols-outlined text-primary">description</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{fileName}</p>
                <div className="w-full h-2 bg-surface-container-high rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
              <button type="button" className="text-stone-400 hover:text-stone-600 text-xs shrink-0" onClick={handleCancel}>
                Cancel
              </button>
            </div>

            <p className="text-sm text-stone-500 text-center">Saving to secure storage…</p>
          </div>
        )}

        {/* ── extracting ───────────────────────────────────────────────────── */}
        {uploadState === 'extracting' && (
          <div className="flex flex-col items-center gap-6 py-4" role="status" aria-live="polite">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-3xl animate-spin" aria-hidden="true">
                progress_activity
              </span>
            </div>

            <div className="text-center">
              <h2 id="upload-modal-title" className="font-serif text-xl font-bold mb-2">AI is reading your report…</h2>
              <p className="text-sm text-stone-500">
                Extracting biomarker values and generating your health summary.
              </p>
            </div>

            <button type="button" className="text-sm text-stone-400 hover:text-stone-600" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        )}

        {/* ── complete ─────────────────────────────────────────────────────── */}
        {uploadState === 'complete' && (
          <div className="flex flex-col items-center gap-6 py-4" role="status" aria-live="polite">
            <div className="w-16 h-16 rounded-full bg-secondary-container flex items-center justify-center">
              <span
                className="material-symbols-outlined text-primary text-3xl"
                style={{ fontVariationSettings: "'FILL' 1" }}
                aria-hidden="true"
              >
                check_circle
              </span>
            </div>

            <div className="text-center">
              <h2 id="upload-modal-title" className="font-serif text-xl font-bold mb-2">Report processed!</h2>
              {resultSummary && (
                <p className="text-sm text-stone-500">
                  {resultSummary.count} values extracted
                  {resultSummary.flagged > 0 && (
                    <span className="text-amber font-medium"> · {resultSummary.flagged} flagged</span>
                  )}
                </p>
              )}
            </div>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                className="flex-1 py-3 bg-primary text-white rounded-full font-semibold text-sm"
                onClick={() => { onClose(); if (completedDocId) navigate(`/reports/${completedDocId}`) }}
              >
                View report
              </button>
              <button
                type="button"
                className="flex-1 py-3 border border-outline-variant rounded-full text-sm"
                onClick={onClose}
              >
                Back to dashboard
              </button>
            </div>
          </div>
        )}

        {/* ── failed ───────────────────────────────────────────────────────── */}
        {uploadState === 'failed' && (
          <div className="flex flex-col items-center gap-6 py-4" role="alert" aria-live="assertive">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-3xl" aria-hidden="true">error</span>
            </div>

            <div className="text-center">
              <h2 id="upload-modal-title" className="font-serif text-xl font-bold mb-2">Upload failed</h2>
              <p className="text-sm text-stone-500">
                {errorMessage ?? "We couldn't read your report. Please try a clearer scan or different format."}
              </p>
            </div>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                className="flex-1 py-3 bg-primary text-white rounded-full font-semibold text-sm"
                onClick={() => { setUploadState('idle'); setErrorMessage(null) }}
              >
                Try again
              </button>
              <button
                type="button"
                className="flex-1 py-3 border border-outline-variant rounded-full text-sm"
                onClick={onClose}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Dev state-switcher */}
        {import.meta.env.DEV && (
          <div className="flex gap-2 mt-4 flex-wrap justify-center">
            {(['idle', 'uploading', 'extracting', 'complete', 'failed'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setUploadState(s)}
                className="text-[10px] px-2 py-1 bg-surface-container rounded text-stone-500"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
