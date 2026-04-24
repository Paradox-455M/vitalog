/* eslint-disable react-refresh/only-export-components -- ToastProvider + useToast + imperative toast API */
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextType {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: React.ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    setToasts((prev) => {
      const trimmed = prev.length >= 3 ? prev.slice(1) : prev
      return [...trimmed, { ...toast, id }]
    })
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

interface ToastContainerProps {
  toasts: Toast[]
  removeToast: (id: string) => void
}

function ToastContainer({ toasts, removeToast }: ToastContainerProps) {
  return (
    <div
      className="fixed top-8 right-6 z-[100] flex flex-col gap-3 pointer-events-none"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

interface ToastItemProps {
  toast: Toast
  onClose: () => void
}

const TOAST_ICONS: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
}

const TOAST_STYLES: Record<ToastType, { bg: string; border: string; icon: string; text: string }> = {
  success: {
    bg: 'bg-secondary-container',
    border: 'border-secondary/20',
    icon: 'text-secondary',
    text: 'text-on-secondary-container',
  },
  error: {
    bg: 'bg-error-container',
    border: 'border-error/20',
    icon: 'text-error',
    text: 'text-on-error-container',
  },
  warning: {
    bg: 'bg-amber-light',
    border: 'border-amber/20',
    icon: 'text-amber',
    text: 'text-amber-text',
  },
  info: {
    bg: 'bg-surface-container',
    border: 'border-outline-variant/20',
    icon: 'text-primary',
    text: 'text-on-surface',
  },
}

function ToastItem({ toast, onClose }: ToastItemProps) {
  const { type, title, message, duration = 5000 } = toast
  const styles = TOAST_STYLES[type]

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  return (
    <div
      role="alert"
      className={`pointer-events-auto min-w-[320px] max-w-md ${styles.bg} ${styles.border} border rounded-xl p-4 shadow-lg animate-in slide-in-from-top-2 fade-in duration-300`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`material-symbols-outlined text-xl ${styles.icon} shrink-0`}
          style={{ fontVariationSettings: "'FILL' 1" }}
          aria-hidden="true"
        >
          {TOAST_ICONS[type]}
        </span>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold text-sm ${styles.text}`}>{title}</p>
          {message && (
            <p className={`text-xs mt-0.5 ${styles.text} opacity-80`}>{message}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className={`shrink-0 p-1 rounded-full hover:bg-on-surface/5 transition-colors ${styles.text}`}
          aria-label="Dismiss notification"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">close</span>
        </button>
      </div>
    </div>
  )
}

export function toast(options: Omit<Toast, 'id'>) {
  const event = new CustomEvent('toast', { detail: options })
  window.dispatchEvent(event)
}

toast.success = (title: string, message?: string) => toast({ type: 'success', title, message })
toast.error = (title: string, message?: string) => toast({ type: 'error', title, message })
toast.warning = (title: string, message?: string) => toast({ type: 'warning', title, message })
toast.info = (title: string, message?: string) => toast({ type: 'info', title, message })
