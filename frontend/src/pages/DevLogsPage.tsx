import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

interface LogEvent {
  id: number
  time: string
  level: string
  message: string
  fields?: Record<string, unknown>
}

type LevelFilter = 'all' | 'info' | 'warn' | 'error'

function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined
  return raw != null && raw !== '' ? raw.replace(/\/$/, '') : ''
}

function levelBadgeClass(level: string): string {
  switch (level) {
    case 'error': return 'bg-red-100 text-red-700'
    case 'warn':  return 'bg-amber-100 text-amber-700'
    default:      return 'bg-surface-container text-on-surface-variant'
  }
}

function rowBgClass(level: string): string {
  switch (level) {
    case 'error': return 'bg-red-50/60'
    case 'warn':  return 'bg-amber-50/60'
    default:      return ''
  }
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
  } catch {
    return iso
  }
}

// Keys extracted inline for request events — shown directly in message column.
const REQUEST_INLINE_KEYS = new Set(['method', 'path', 'status', 'duration_ms'])

function inlineSummary(message: string, fields: Record<string, unknown>): string | null {
  if (message === 'request_started' || message === 'request_completed') {
    const method = fields.method as string | undefined
    const path = fields.path as string | undefined
    const status = fields.status as number | undefined
    const ms = fields.duration_ms as number | undefined
    const parts = [method, path, status != null ? `→ ${status}` : null, ms != null ? `${ms}ms` : null]
    return parts.filter(Boolean).join('  ')
  }
  return null
}

function FieldsChip({ fields, omitKeys }: { fields: Record<string, unknown>; omitKeys?: Set<string> }) {
  const [open, setOpen] = useState(false)
  const entries = Object.entries(fields).filter(([k]) => !omitKeys?.has(k))
  if (entries.length === 0) return null

  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="text-[10px] bg-surface-container-high text-on-surface-variant rounded px-1.5 py-0.5 hover:bg-surface-container-highest transition-colors font-mono"
      >
        {entries.length} field{entries.length > 1 ? 's' : ''}
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-surface border border-outline-variant/30 rounded-lg shadow-lg p-3 min-w-[260px] max-w-xs text-[11px] font-mono">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2 py-0.5">
              <span className="text-primary shrink-0">{k}:</span>
              <span className="text-on-surface break-all">{JSON.stringify(v)}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  )
}

export default function DevLogsPage() {
  const [events, setEvents] = useState<LogEvent[]>([])
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const [errorMsg, setErrorMsg] = useState('')
  const [reconnectKey, setReconnectKey] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const connect = useCallback(async () => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort
    setStatus('connecting')
    setErrorMsg('')

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''

    try {
      const resp = await fetch(`${getApiBaseUrl()}/api/dev/logs/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abort.signal,
      })

      if (!resp.ok) {
        setStatus('error')
        setErrorMsg(`HTTP ${resp.status} — is the backend running in dev mode?`)
        return
      }

      setStatus('connected')
      const reader = resp.body!.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })

        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''

        for (const chunk of parts) {
          const dataLine = chunk.split('\n').find(l => l.startsWith('data:'))
          if (!dataLine) continue
          try {
            const ev: LogEvent = JSON.parse(dataLine.slice(5).trim())
            setEvents(prev => [...prev, ev])
          } catch { /* skip malformed */ }
        }
      }

      // Stream closed — auto-reconnect after 1 s (backend restart / network blip).
      if (!abort.signal.aborted) {
        await new Promise(r => setTimeout(r, 1000))
        setReconnectKey(k => k + 1)
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setStatus('error')
      setErrorMsg(String(err))
    }
  }, [])

  useEffect(() => {
    void connect()
    return () => abortRef.current?.abort()
  // reconnectKey intentionally included to re-run connect on auto-reconnect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect, reconnectKey])

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [events, autoScroll])

  const visible = events.filter(e => {
    if (levelFilter !== 'all' && e.level !== levelFilter) return false
    if (keyword) {
      const kw = keyword.toLowerCase()
      if (!e.message.toLowerCase().includes(kw) &&
          !JSON.stringify(e.fields ?? {}).toLowerCase().includes(kw)) return false
    }
    return true
  })

  const errorCount = events.filter(e => e.level === 'error').length
  const warnCount  = events.filter(e => e.level === 'warn').length

  return (
    <div className="h-full flex flex-col bg-surface p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold text-on-surface">Backend Logs</h1>
          <p className="text-sm text-on-surface-variant mt-0.5">Live stream from Go backend — dev mode only</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
            status === 'connected' ? 'bg-green-100 text-green-700' :
            status === 'connecting' ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-700'
          }`}>
            {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Disconnected'}
          </span>
          {status === 'error' && (
            <button
              type="button"
              onClick={() => setReconnectKey(k => k + 1)}
              className="text-xs bg-surface-container text-on-surface px-3 py-1 rounded-lg hover:bg-surface-container-high transition-colors"
            >
              Reconnect
            </button>
          )}
          <button
            type="button"
            onClick={() => setEvents([])}
            className="text-xs bg-surface-container text-on-surface-variant px-3 py-1 rounded-lg hover:bg-surface-container-high transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {status === 'error' && errorMsg && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Level filters */}
        <div className="flex gap-1 bg-surface-container rounded-xl p-1">
          {(['all', 'info', 'warn', 'error'] as LevelFilter[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setLevelFilter(f)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors capitalize ${
                levelFilter === f
                  ? 'bg-surface text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {f}
              {f === 'error' && errorCount > 0 && (
                <span className="ml-1 bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{errorCount}</span>
              )}
              {f === 'warn' && warnCount > 0 && (
                <span className="ml-1 bg-amber-500 text-white text-[10px] rounded-full px-1.5 py-0.5">{warnCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Keyword search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-base pointer-events-none">search</span>
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="Filter by doc_id or message…"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface-container border border-outline-variant/30 rounded-xl text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Auto-scroll toggle */}
        <label className="flex items-center gap-2 text-sm text-on-surface-variant cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={e => setAutoScroll(e.target.checked)}
            className="accent-primary"
          />
          Auto-scroll
        </label>

        <span className="text-xs text-on-surface-variant ml-auto">
          {visible.length} / {events.length} events
        </span>
      </div>

      {/* Log list */}
      <div className="flex-1 overflow-y-auto rounded-xl border border-outline-variant/20 bg-surface-container/30 font-mono text-xs">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl">terminal</span>
            <span>{events.length === 0 ? 'Waiting for events…' : 'No events match the filter'}</span>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-surface-container/80 backdrop-blur-sm">
              <tr className="text-[10px] uppercase text-on-surface-variant border-b border-outline-variant/20">
                <th className="text-left px-3 py-2 w-28">Time</th>
                <th className="text-left px-2 py-2 w-16">Level</th>
                <th className="text-left px-2 py-2">Message</th>
                <th className="text-left px-2 py-2 w-20">Fields</th>
              </tr>
            </thead>
            <tbody>
              {visible.map(ev => {
                const fields = ev.fields ?? {}
                const summary = inlineSummary(ev.message, fields)
                const status = fields.status as number | undefined
                const statusColor = status != null
                  ? status >= 500 ? 'text-red-600' : status >= 400 ? 'text-amber-600' : 'text-green-700'
                  : ''
                return (
                  <tr key={ev.id} className={`border-b border-outline-variant/10 hover:bg-surface-container/50 ${rowBgClass(ev.level)}`}>
                    <td className="px-3 py-1.5 text-on-surface-variant whitespace-nowrap">{formatTime(ev.time)}</td>
                    <td className="px-2 py-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${levelBadgeClass(ev.level)}`}>
                        {ev.level}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-on-surface">
                      <span className="text-on-surface-variant">{ev.message}</span>
                      {summary && (
                        <span className={`ml-2 ${statusColor}`}>{summary}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      {Object.keys(fields).length > 0 && (
                        <FieldsChip fields={fields} omitKeys={summary ? REQUEST_INLINE_KEYS : undefined} />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
