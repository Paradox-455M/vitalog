import { useState, useRef, useEffect, useCallback } from 'react'
import type { CreateFamilyMemberRequest } from '../lib/api'
import { DatePickerField } from './DatePickerField'

interface AddFamilyMemberModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateFamilyMemberRequest) => Promise<void>
  creating?: boolean
  errorMessage?: string | null
}

export function AddFamilyMemberModal({
  isOpen,
  onClose,
  onSubmit,
  creating = false,
  errorMessage = null,
}: AddFamilyMemberModalProps) {
  const [form, setForm] = useState({ name: '', relationship: '', dob: '' })
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  const handleClose = useCallback(() => {
    setForm({ name: '', relationship: '', dob: '' })
    onClose()
  }, [onClose])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const payload: CreateFamilyMemberRequest = {
      name: form.name.trim(),
      relationship: form.relationship || undefined,
      date_of_birth: form.dob || undefined,
    }
    await onSubmit(payload)
  }

  useEffect(() => {
    if (!isOpen) return

    previousActiveElement.current = document.activeElement as HTMLElement
    setTimeout(() => firstInputRef.current?.focus(), 0)
    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose()
        return
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
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
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
      previousActiveElement.current?.focus()
    }
  }, [isOpen, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="presentation">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} aria-hidden="true" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-family-modal-title"
        className="relative bg-surface rounded-2xl p-8 max-w-lg w-full mx-4 shadow-2xl"
      >
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-surface-container transition-colors"
          type="button"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-on-surface-variant">close</span>
        </button>

        <h3 id="add-family-modal-title" className="font-serif text-2xl font-bold text-on-surface mb-1">
          Add family member
        </h3>
        <p className="text-sm text-on-surface-variant mb-6">
          Track health records for another member of your family
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="member-name" className="block text-sm font-semibold text-on-surface-variant mb-1">
                Full name
              </label>
              <input
                ref={firstInputRef}
                id="member-name"
                type="text"
                required
                autoComplete="name"
                disabled={creating}
                placeholder="Priya Sharma"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full border border-outline-variant rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            <div>
              <label
                htmlFor="member-relationship"
                className="block text-sm font-semibold text-on-surface-variant mb-1"
              >
                Relationship
              </label>
              <select
                id="member-relationship"
                value={form.relationship}
                disabled={creating}
                onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
                className="w-full border border-outline-variant rounded-xl px-4 py-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-surface"
              >
                <option value="">— Optional —</option>
                <option value="self">Self</option>
                <option value="spouse">Spouse</option>
                <option value="parent">Parent</option>
                <option value="child">Child</option>
                <option value="sibling">Sibling</option>
              </select>
            </div>

            <DatePickerField
              id="member-dob"
              label="Date of birth (optional)"
              value={form.dob}
              onChange={(d) => setForm((f) => ({ ...f, dob: d }))}
              disabled={creating}
              placeholder="Select date of birth"
            />
          </div>

          {errorMessage && (
            <p className="mt-4 text-sm text-error" role="alert">
              {errorMessage}
            </p>
          )}

          <div className="mt-6 flex flex-col gap-3">
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-primary text-on-primary py-3 rounded-full font-semibold font-sans text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {creating ? 'Adding…' : 'Add member'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={creating}
              className="w-full text-center text-on-surface-variant font-semibold text-sm py-2 hover:text-on-surface transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
