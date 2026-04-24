import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { Skeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import { SettingsLayout } from '../layout/SettingsLayout'
import { useProfile } from '../hooks/useProfile'
import { ApiError, type UpdateProfileRequest } from '../lib/api'
import type { ProfileWithDocCount } from '../lib/api'

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

const inputClass =
  'bg-surface-container border border-outline-variant/30 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 w-full disabled:opacity-60'

const labelClass = 'text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1 block'

interface ProfileFormProps {
  profile: ProfileWithDocCount
  update: (data: UpdateProfileRequest) => Promise<void>
  updating: boolean
  addToast: ReturnType<typeof useToast>['addToast']
}

function SettingsProfileForm({ profile, update, updating, addToast }: ProfileFormProps) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url?.trim() ?? '')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const name = fullName.trim()
    if (!name) {
      addToast({ type: 'error', title: 'Please enter your name' })
      return
    }
    try {
      const trimmedAvatar = avatarUrl.trim()
      await update({
        full_name: name,
        ...(trimmedAvatar ? { avatar_url: trimmedAvatar } : {}),
      })
      addToast({ type: 'success', title: 'Profile saved' })
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not save profile'
      addToast({ type: 'error', title: message })
    }
  }

  const safeAvatar = avatarUrl.trim()
  const showAvatarImage = safeAvatar && /^https?:\/\//i.test(safeAvatar)

  return (
    <form
      onSubmit={handleSave}
      className="md:col-span-8 bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-6 shadow-sm"
    >
      <h2 className="text-xl font-bold text-primary flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined">account_circle</span>
        Profile information
      </h2>

      <p className="text-sm text-on-surface-variant mb-4">
        Date of birth and blood group for health context are set per person under{' '}
        <Link to="/family" className="font-semibold text-primary hover:underline">
          Family
        </Link>
        .
      </p>

      <div className="flex flex-col md:flex-row gap-8">
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="w-24 h-24 rounded-full bg-primary-fixed/30 flex items-center justify-center border-2 border-primary-fixed overflow-hidden">
            {showAvatarImage ? (
              <img
                src={safeAvatar}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="font-serif text-2xl font-bold text-primary">
                {initialsFromName(fullName || 'User')}
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant text-center max-w-[10rem]">
            Paste a public image URL below to use as your profile photo
          </p>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label htmlFor="settings-name" className={labelClass}>
              Full name
            </label>
            <input
              id="settings-name"
              type="text"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              required
              disabled={updating}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="settings-email" className={labelClass}>
              Email
            </label>
            <input
              id="settings-email"
              type="email"
              value={profile.email}
              readOnly
              className={inputClass}
              title="Use your sign-in provider to change email"
            />
            <p className="text-xs text-on-surface-variant mt-1">Managed by your login provider</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="settings-avatar-url" className={labelClass}>
              Profile image URL
              <span className="font-normal text-on-surface-variant"> (optional)</span>
            </label>
            <input
              id="settings-avatar-url"
              type="url"
              inputMode="url"
              placeholder="https://"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              className={inputClass}
              disabled={updating}
            />
          </div>
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="submit"
          disabled={updating}
          className="px-6 py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {updating ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const { addToast } = useToast()
  const { profile, loading, error, refetch, update, updating } = useProfile()

  async function handleSignOut() {
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      addToast({ type: 'error', title: 'Could not sign out' })
    }
  }

  if (loading) {
    return (
      <SettingsLayout title="Settings">
        <div className="mb-10">
          <Skeleton className="h-9 w-48 rounded-md mb-2" />
          <Skeleton className="h-4 w-96 max-w-full rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-8 rounded-xl border border-outline-variant/20 p-6 space-y-6">
            <div className="flex gap-8">
              <Skeleton className="h-24 w-24 rounded-full shrink-0" />
              <div className="flex-1 space-y-4">
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>
            <div className="flex justify-end">
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
          <div className="md:col-span-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </SettingsLayout>
    )
  }

  return (
    <SettingsLayout title="Settings">
      <div className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-on-surface mb-2">Profile</h1>
        <p className="text-on-surface-variant">Your name and photo shown across Vitalog. Email is managed at sign-in.</p>
      </div>

      {error && (
        <div
          className="mb-6 rounded-xl border border-error/30 bg-error/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          role="alert"
        >
          <p className="text-sm text-on-surface">{error.message}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-semibold shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {!profile ? (
        <p className="text-on-surface-variant">We couldn&apos;t load your profile. Try again later.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          <SettingsProfileForm
            key={`${profile.id}:${profile.full_name}:${profile.avatar_url ?? ''}`}
            profile={profile}
            update={update}
            updating={updating}
            addToast={addToast}
          />

          <div
            className={`md:col-span-4 rounded-xl p-6 shadow-sm overflow-hidden relative ${
              profile.plan === 'pro'
                ? 'bg-[#173901] text-white'
                : 'bg-surface-container-lowest border border-outline-variant/20'
            }`}
          >
              {profile.plan === 'pro' && (
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#2d5016] rounded-full opacity-50" />
              )}
              <div className="relative z-10 h-full flex flex-col min-h-[12rem]">
                <h2
                  className={`text-lg font-bold mb-4 flex items-center gap-2 ${
                    profile.plan === 'pro' ? '' : 'text-on-surface'
                  }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    stars
                  </span>
                  Current plan
                </h2>
                <span
                  className={`text-2xl sm:text-3xl font-black ${profile.plan === 'pro' ? '' : 'text-on-surface'}`}
                >
                  {profile.plan === 'pro' ? 'Pro' : 'Free'}
                </span>
                <p
                  className={
                    profile.plan === 'pro' ? 'text-primary-fixed text-sm mt-1' : 'text-on-surface-variant text-sm mt-1'
                  }
                >
                  {profile.plan === 'pro'
                    ? 'Full access to tracking and family sharing'
                    : (() => {
                        const left = Math.max(0, 3 - profile.document_count)
                        return `${left} free upload${left !== 1 ? 's' : ''} remaining · 1 family member (free tier)`
                      })()}
                </p>

                <div
                  className={
                    profile.plan === 'pro'
                      ? 'mt-4 bg-[#2d5016]/50 p-3 rounded-lg border border-[#3e6327]/30'
                      : 'mt-4 bg-surface-container p-3 rounded-lg border border-outline-variant/20'
                  }
                >
                  <p
                    className={
                      profile.plan === 'pro' ? 'text-xs text-primary-fixed/80' : 'text-xs text-on-surface-variant'
                    }
                  >
                    Reports uploaded
                  </p>
                  <p className={`text-sm font-semibold ${profile.plan === 'pro' ? '' : 'text-on-surface'}`}>
                    {profile.document_count}
                  </p>
                </div>

                <div className="mt-auto pt-4">
                  <Link
                    to="/settings/subscription"
                    className={
                      profile.plan === 'pro'
                        ? 'flex w-full justify-center py-2.5 bg-white text-primary rounded-lg text-sm font-bold hover:bg-surface-container transition-colors'
                        : 'flex w-full justify-center py-2.5 bg-primary text-on-primary rounded-lg text-sm font-bold hover:opacity-90 transition-opacity'
                    }
                  >
                    {profile.plan === 'pro' ? 'Manage subscription' : 'View plans and upgrade'}
                  </Link>
                </div>
              </div>
            </div>
        </div>
      )}

      <div className="mt-8 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <p className="text-sm text-on-surface-variant">Notification and privacy options are in the sidebar</p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="text-sm font-bold text-error border border-error/30 px-4 py-2.5 rounded-lg hover:bg-error-container/20 transition-colors self-start sm:self-auto"
        >
          Sign out
        </button>
      </div>
    </SettingsLayout>
  )
}
