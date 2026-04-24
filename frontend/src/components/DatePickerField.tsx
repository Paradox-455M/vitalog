import { useState, useRef, useEffect, useId } from 'react'
import { DayPicker } from 'react-day-picker'
import { format, parse, isValid, startOfDay } from 'date-fns'
import 'react-day-picker/style.css'

export interface DatePickerFieldProps {
  id?: string
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  placeholder?: string
  /** Defaults to 120 years ago */
  minDate?: Date
  /** Defaults to end of today */
  maxDate?: Date
  /** Override label styles (e.g. Settings page uppercase labels) */
  labelClassName?: string
}

function parseYmd(s: string): Date | undefined {
  if (!s) return undefined
  const d = parse(s, 'yyyy-MM-dd', new Date())
  return isValid(d) ? d : undefined
}

export function DatePickerField({
  id: idProp,
  label,
  value,
  onChange,
  disabled = false,
  placeholder = 'Select date',
  minDate: minDateProp,
  maxDate: maxDateProp,
  labelClassName,
}: DatePickerFieldProps) {
  const autoId = useId()
  const id = idProp ?? `dp-${autoId}`
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState<Date | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  const now = new Date()
  const maxDate = startOfDay(maxDateProp ?? now)
  const minDate = startOfDay(minDateProp ?? new Date(now.getFullYear() - 120, 0, 1))
  const fromYear = minDate.getFullYear()
  const toYear = maxDate.getFullYear()

  useEffect(() => {
    if (!open) return
    function onDocDown(e: MouseEvent) {
      if (containerRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  function handleTriggerClick() {
    if (disabled) return
    setPending(parseYmd(value) ?? undefined)
    setOpen(true)
  }

  function handleCancel() {
    setOpen(false)
  }

  function handleSelect() {
    if (pending) {
      onChange(format(pending, 'yyyy-MM-dd'))
    }
    setOpen(false)
  }

  function handleClear() {
    onChange('')
    setOpen(false)
  }

  const displayText = (() => {
    const d = parseYmd(value)
    if (!d) return null
    return format(d, 'MMMM d, yyyy')
  })()

  const defaultMonth = pending ?? parseYmd(value) ?? maxDate

  return (
    <div className="relative" ref={containerRef}>
      <label
        htmlFor={id}
        className={labelClassName ?? 'block text-sm font-semibold text-on-surface-variant mb-1'}
      >
        {label}
      </label>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={handleTriggerClick}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="w-full border border-outline-variant rounded-xl px-4 py-3 text-sm font-sans text-left flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 bg-surface"
      >
        <span className={displayText ? 'text-on-surface' : 'text-on-surface-variant'}>
          {displayText ?? placeholder}
        </span>
        <span className="material-symbols-outlined text-on-surface-variant text-xl shrink-0" aria-hidden>
          calendar_today
        </span>
      </button>

      {open && (
        <div
          className="absolute z-[60] mt-2 left-0 right-0 sm:left-0 sm:right-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-xl p-4 min-w-[min(100%,20rem)] sm:min-w-[20rem]"
          role="dialog"
          aria-label="Choose date"
        >
          <DayPicker
            mode="single"
            selected={pending}
            onSelect={setPending}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            startMonth={minDate}
            endMonth={maxDate}
            defaultMonth={defaultMonth}
            disabled={[{ after: maxDate }, { before: minDate }]}
            weekStartsOn={1}
            className="vitalog-rdp-root"
          />
          <div className="flex flex-wrap items-center justify-end gap-2 mt-4 pt-4 border-t border-outline-variant/20">
            {value ? (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 text-sm font-semibold text-on-surface-variant hover:text-on-surface rounded-full mr-auto"
              >
                Clear
              </button>
            ) : (
              <span className="mr-auto" />
            )}
            <button
              type="button"
              onClick={handleCancel}
              className="px-5 py-2.5 text-sm font-semibold rounded-full border-2 border-primary text-primary bg-transparent hover:bg-primary/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSelect}
              disabled={!pending}
              className="px-5 py-2.5 text-sm font-semibold rounded-full bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Select
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
