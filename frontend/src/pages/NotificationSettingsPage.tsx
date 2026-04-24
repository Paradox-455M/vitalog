import { useState } from 'react'
import { SettingsLayout } from '../layout/SettingsLayout'
import { useNotificationPreferences } from '../hooks/useNotificationPreferences'
import { useToast } from '../components/Toast'
import type { NotificationPreferences } from '../lib/api'

type BoolPrefKey = Exclude<keyof NotificationPreferences, 'tone'>

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="sr-only peer"
      />
      <div className="w-11 h-6 bg-surface-container-high rounded-full peer peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
    </label>
  )
}

export function NotificationSettingsPage() {
  const { addToast } = useToast()
  const { prefs, setPrefs, loading, saving, error, save, discard } = useNotificationPreferences()
  const [saveError, setSaveError] = useState<string | null>(null)

  const toggle = (key: BoolPrefKey) =>
    setPrefs((p) => ({ ...p, [key]: !p[key] }))

  const alertRows: { label: string; description: string; key: BoolPrefKey }[] = [
    {
      label: 'New Report Ready',
      description: 'Get notified immediately when lab results or monthly summaries are generated.',
      key: 'new_report',
    },
    {
      label: 'Significant Trend Detected',
      description: 'Insights into metabolic changes, sleep patterns, or activity shifts.',
      key: 'trend_detected',
    },
    {
      label: 'Family Member Updates',
      description: 'Receive alerts from linked profiles in your household plan.',
      key: 'family_updates',
    },
    {
      label: 'Health Tips',
      description: 'Personalized wellness recommendations based on your recent activity.',
      key: 'health_tips',
    },
  ]

  const channelRows: { icon: string; label: string; key: BoolPrefKey }[] = [
    { icon: 'mail', label: 'Email', key: 'email' },
    { icon: 'notifications_active', label: 'Push Alerts', key: 'push' },
    { icon: 'chat', label: 'WhatsApp', key: 'whatsapp' },
  ]

  const handleSave = async () => {
    setSaveError(null)
    try {
      await save()
      addToast({ type: 'success', title: 'Notification preferences saved' })
    } catch {
      setSaveError('Could not save preferences. Please try again.')
    }
  }

  if (loading) {
    return (
      <SettingsLayout title="Notification Settings">
        <p className="text-on-surface-variant">Loading notification settings…</p>
      </SettingsLayout>
    )
  }

  return (
    <SettingsLayout title="Notification Settings">
      {error && (
        <p className="mb-4 text-sm text-error" role="alert">
          {error.message}
        </p>
      )}

      {/* Page heading */}
      <header className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-on-surface mb-2">
          Notification Settings
        </h1>
        <p className="text-on-surface-variant max-w-2xl">
          Tailor how and when Vitalog communicates with you. Our 'Soft &amp;
          Supportive' tone is recommended for a calmer health journey.
        </p>
      </header>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Card A — Alert Types */}
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/20 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px]">tune</span>
              Alert Types
            </h2>
            <div className="divide-y divide-outline-variant/20">
              {alertRows.map((row) => (
                <div key={row.key} className="py-5 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-on-surface">{row.label}</p>
                    <p className="text-sm text-on-surface-variant">{row.description}</p>
                  </div>
                  <Toggle checked={prefs[row.key] as boolean} onChange={() => toggle(row.key)} />
                </div>
              ))}
            </div>
          </div>

          {/* Card B — Alert Tone */}
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/20 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-[22px]">forum</span>
                Alert Tone
              </h2>
              <p className="text-sm text-on-surface-variant mt-1">
                Choose the communication style for Vitalog messages.
              </p>
            </div>

            {/* Tone switcher */}
            <div className="grid grid-cols-2 p-1.5 bg-surface-container rounded-xl">
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, tone: 'direct' }))}
                className={`py-3 px-4 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all ${
                  prefs.tone === 'direct'
                    ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span>Direct</span>
                <span className="text-[10px] font-normal opacity-70">Action-oriented &amp; concise</span>
              </button>
              <button
                type="button"
                onClick={() => setPrefs((p) => ({ ...p, tone: 'soft' }))}
                className={`py-3 px-4 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all ${
                  prefs.tone === 'soft'
                    ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant/20'
                    : 'text-on-surface-variant hover:text-primary'
                }`}
              >
                <span>Soft &amp; Supportive</span>
                <span className="text-[10px] font-normal opacity-70">Empathetic &amp; encouraging</span>
              </button>
            </div>

            {/* Preview block */}
            <div className="mt-6 p-4 rounded-lg bg-surface-container-low border border-outline-variant/20 flex gap-4">
              <span className="material-symbols-outlined text-primary-container shrink-0">auto_awesome</span>
              <p className="text-xs italic text-on-surface-variant leading-relaxed">
                {prefs.tone === 'soft'
                  ? '"Preview: Hello Arjun! It looks like you\'ve been resting well. Since your recovery score is high, today might be a great day for a light walk if you\'re feeling up to it."'
                  : '"Preview: New report ready. Ferritin: 74 ng/mL (Optimal). LDL improved 12% since August. Action required: Schedule TSH follow-up."'}
              </p>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Card C — Channels */}
          <div className="bg-surface-container-lowest rounded-xl p-8 border border-outline-variant/20 shadow-sm">
            <h2 className="text-lg font-bold text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-[22px]">hub</span>
              Channels
            </h2>
            <p className="text-xs text-on-surface-variant mb-4">
              In-app notifications work today; email, push, and WhatsApp are stored for when delivery is available.
            </p>
            <div className="space-y-4">
              {channelRows.map((ch) => (
                <div
                  key={ch.key}
                  className="flex items-center justify-between p-3 rounded-lg border border-outline-variant/10 hover:border-outline-variant/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary text-[20px]">{ch.icon}</span>
                    </div>
                    <span className="text-sm font-semibold text-on-surface">{ch.label}</span>
                  </div>
                  <Toggle checked={prefs[ch.key] as boolean} onChange={() => toggle(ch.key)} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-container rounded-xl p-6 border border-outline-variant/20">
            <p className="font-serif text-lg font-bold text-primary mb-2">Restorative Pulse</p>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              Our 'Soft' tone uses your health data to suggest recovery windows without the stress of
              rigid goal-tracking.
            </p>
          </div>
        </div>
      </div>

      {saveError && (
        <p className="mt-4 text-sm text-error" role="alert">
          {saveError}
        </p>
      )}

      {/* Footer actions */}
      <div className="mt-12 pt-8 border-t border-outline-variant/20 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
        <button
          type="button"
          onClick={discard}
          className="px-6 py-2.5 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Discard Changes
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-8 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </SettingsLayout>
  )
}
