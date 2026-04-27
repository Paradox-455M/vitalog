import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { SettingsLayout } from '../layout/SettingsLayout'
import { useProfile } from '../hooks/useProfile'
import { useToast } from '../components/Toast'
import { api, ApiError } from '../lib/api'
import type { AccessEvent } from '../lib/api'
import { supabase } from '../lib/supabaseClient'

function deviceIconFromUA(ua: string | null): string {
  if (!ua) return 'devices'
  const s = ua.toLowerCase()
  if (s.includes('iphone') || s.includes('android')) return 'smartphone'
  if (s.includes('ipad') || s.includes('tablet')) return 'tablet_mac'
  return 'laptop_mac'
}

function shortDeviceLabel(ua: string | null): string {
  if (!ua || ua.length < 8) return 'Unknown device'
  if (ua.length > 72) return `${ua.slice(0, 69)}…`
  return ua
}

export function PrivacyPage() {
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { profile, loading: profileLoading } = useProfile()
  const [events, setEvents] = useState<AccessEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(true)
  const [eventsError, setEventsError] = useState<string | null>(null)
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null)
  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [signingOutOthers, setSigningOutOthers] = useState(false)

  const loadEvents = useCallback(async () => {
    setEventsLoading(true)
    setEventsError(null)
    try {
      const list = await api.privacy.listAccessEvents(50)
      setEvents(list)
    } catch (e) {
      setEventsError(e instanceof Error ? e.message : 'Could not load access history')
    } finally {
      setEventsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadEvents()
  }, [loadEvents])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors()
        if (cancelled) return
        if (error) {
          setMfaEnabled(false)
          return
        }
        const verified = (data?.all ?? []).some((f) => f.status === 'verified')
        setMfaEnabled(verified)
      } catch {
        if (!cancelled) setMfaEnabled(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      await api.privacy.downloadDataExport()
      addToast({ type: 'success', title: 'Download started', message: 'Your data export (JSON) is downloading.' })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Export failed'
      addToast({ type: 'error', title: 'Could not export data', message: msg })
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    const typed = window.prompt(
      'This permanently deletes your Vitalog account and data. Type DELETE_MY_ACCOUNT to confirm.',
    )
    if (typed !== 'DELETE_MY_ACCOUNT') {
      if (typed !== null) addToast({ type: 'info', title: 'Account deletion cancelled' })
      return
    }
    setDeleting(true)
    try {
      await api.privacy.deleteAccount('DELETE_MY_ACCOUNT')
      await supabase.auth.signOut()
      addToast({ type: 'success', title: 'Account deleted' })
      navigate('/login', { replace: true })
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Deletion failed'
      addToast({ type: 'error', title: 'Could not delete account', message: msg })
    } finally {
      setDeleting(false)
    }
  }

  const handleSignOutOthers = async () => {
    setSigningOutOthers(true)
    try {
      const { error } = await supabase.auth.signOut({ scope: 'others' })
      if (error) throw error
      addToast({ type: 'success', title: 'Signed out other sessions' })
      void loadEvents()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not sign out other devices'
      addToast({ type: 'error', title: 'Sign out failed', message: msg })
    } finally {
      setSigningOutOthers(false)
    }
  }

  const displayName =
    profile?.full_name?.trim() ||
    profile?.email ||
    (profileLoading ? 'Loading…' : 'Your account')

  return (
    <SettingsLayout title="Privacy & Security">
      <header className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-on-surface mb-2">Privacy &amp; Security</h1>
        <p className="text-on-surface-variant max-w-2xl">
          Manage your data export, account deletion, and a history of sign-in events recorded by
          Vitalog. We do not derive city or country from your IP in this version.
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/20 flex items-start gap-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-bl-full" />

          <div className="bg-primary/10 p-4 rounded-full text-primary shrink-0">
            <span
              className="material-symbols-outlined text-4xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              shield_with_heart
            </span>
          </div>

          <div>
            <h2 className="font-serif text-2xl font-bold mb-3 text-on-surface">
              How we protect your health data
            </h2>
            <p className="leading-relaxed mb-4 text-on-surface-variant">
              We use industry-standard HTTPS for data in transit. Your documents are stored in
              private cloud storage tied to your account, and our API only serves your data when you
              are signed in. This is an early product—review our practices as we grow, and use
              export and deletion below if you need to leave.
            </p>
            <div className="flex flex-wrap gap-4">
              {[
                { icon: 'lock', label: 'Authenticated access' },
                { icon: 'cloud_done', label: 'Private storage' },
                { icon: 'download', label: 'Data portability' },
              ].map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-sm font-semibold text-secondary">
                  <span className="material-symbols-outlined text-base">{b.icon}</span>
                  {b.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 bg-surface-inverse text-white p-8 rounded-xl flex flex-col justify-between">
          <div>
            <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">
              Identity Status
            </p>
            <h3 className="font-serif text-xl font-semibold">{displayName}</h3>
            {profile?.email ? (
              <p className="text-sm text-white/70 mt-1 break-all">{profile.email}</p>
            ) : null}

            <div className="mt-4">
              <div className="flex items-center justify-between text-sm py-2 border-b border-white/10">
                <span>Two-factor (MFA)</span>
                <span className="text-secondary-fixed font-bold">
                  {mfaEnabled === null ? '…' : mfaEnabled ? 'Enabled' : 'Not enabled'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm py-2">
                <span>Password</span>
                <span className="text-white/80">Managed in your auth provider</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('/settings')}
            className="mt-6 w-full py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm font-bold transition-colors"
          >
            Back to profile settings
          </button>
        </div>

        <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div className="bg-surface-container-low p-8 rounded-xl border border-outline-variant/20 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-primary text-2xl">download_for_offline</span>
                <h3 className="font-serif text-xl font-bold text-on-surface">Download My Data</h3>
              </div>
              <p className="text-sm text-on-surface-variant mb-6">
                Download a JSON snapshot of your profile, notification preferences, family members,
                document metadata, and extracted health values. Large accounts may take longer; very
                large exports may need a future async download.
              </p>
            </div>
            <div>
              <button
                type="button"
                disabled={exporting}
                onClick={() => void handleExport()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">download</span>
                {exporting ? 'Preparing…' : 'Export My Data (JSON)'}
              </button>
            </div>
          </div>

          <div className="bg-error-container/20 p-8 rounded-xl border border-error-container flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="material-symbols-outlined text-error text-2xl">delete_forever</span>
                <h3 className="font-serif text-xl font-bold text-on-surface">Delete My Account</h3>
              </div>
              <p className="text-sm text-on-surface-variant mb-6">
                Permanently deletes your auth account, profile, documents, and related data. Stored
                files are removed first, then your login is deleted. This cannot be undone.
              </p>
            </div>
            <div>
              <button
                type="button"
                disabled={deleting}
                onClick={() => void handleDeleteAccount()}
                className="inline-flex items-center gap-2 px-6 py-3 border border-error text-error font-bold rounded-lg hover:bg-error/5 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-base">delete_forever</span>
                {deleting ? 'Deleting…' : 'Delete account permanently'}
              </button>
            </div>
          </div>
        </div>

        <div className="col-span-12 mt-4 bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden">
          <div className="px-8 py-6 border-b border-outline-variant/20 flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
            <h3 className="font-serif text-xl font-bold text-on-surface">Recent access history</h3>
            <button
              type="button"
              disabled={signingOutOthers}
              onClick={() => void handleSignOutOthers()}
              className="text-sm font-bold text-primary hover:underline disabled:opacity-50 text-left sm:text-right"
            >
              {signingOutOthers ? 'Signing out…' : 'Log out all other devices'}
            </button>
          </div>

          {eventsError ? (
            <p className="px-8 py-4 text-sm text-error" role="alert">
              {eventsError}
            </p>
          ) : null}

          {eventsLoading ? (
            <p className="px-8 py-4 text-sm text-on-surface-variant">Loading access history…</p>
          ) : null}

          {!eventsLoading && !events.length ? (
            <p className="px-8 py-4 text-sm text-on-surface-variant">
              No sign-in events yet. After your next login, entries will appear here.
            </p>
          ) : null}

          {events.length > 0 ? (
            <table className="w-full text-left">
              <thead className="bg-surface-container text-on-surface-variant text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-8 py-3 font-semibold">Date &amp; Time</th>
                  <th className="px-8 py-3 font-semibold">IP address</th>
                  <th className="px-8 py-3 font-semibold">Device</th>
                  <th className="px-8 py-3 font-semibold text-right">Note</th>
                </tr>
              </thead>
              <tbody>
                {events.map((log, index) => {
                  const when = format(new Date(log.created_at), "MMM d, yyyy · HH:mm")
                  const ip = log.ip_address?.trim() || 'Unknown'
                  const icon = deviceIconFromUA(log.user_agent)
                  const device = shortDeviceLabel(log.user_agent)
                  return (
                    <tr key={log.id} className="hover:bg-surface-container transition-colors">
                      <td className="px-8 py-4 text-sm text-on-surface">{when}</td>
                      <td className="px-8 py-4 text-sm text-on-surface-variant">{ip}</td>
                      <td className="px-8 py-4 text-sm text-on-surface">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">
                            {icon}
                          </span>
                          <span className="truncate" title={log.user_agent ?? undefined}>
                            {device}
                          </span>
                        </span>
                      </td>
                      <td
                        className={`px-8 py-4 text-sm text-right ${
                          index === 0 ? 'text-secondary font-bold' : 'text-on-surface-variant'
                        }`}
                      >
                        {index === 0 ? 'Latest' : 'Recorded'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </SettingsLayout>
  )
}
