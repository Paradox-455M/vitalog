import { useEffect, useMemo, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useProfile } from '../hooks/useProfile'
import { accountDisplayName, initialsFromDisplayName, profileAvatarUrl } from '../lib/accountDisplay'
import { api } from '../lib/api'

const navItems = [
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { label: 'My Reports', to: '/reports', icon: 'description' },
  { label: 'Health Timeline', to: '/timeline', icon: 'timeline' },
  { label: 'Family', to: '/family', icon: 'family_restroom' },
  { label: 'Biomarker Library', to: '/biomarkers', icon: 'science' },
  { label: 'Insights', to: '/insights', icon: 'lightbulb' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
  
]

export function SideNav() {
  const { user } = useAuth()
  const location = useLocation()
  const { profile, loading: profileLoading } = useProfile()
  const [reportCount, setReportCount] = useState<number | null>(null)

  const displayName = useMemo(() => accountDisplayName(profile, user), [profile, user])

  const initials = useMemo(() => initialsFromDisplayName(displayName), [displayName])

  const avatarUrl = profileAvatarUrl(profile)

  useEffect(() => {
    let cancelled = false
    const refreshReportCount = async () => {
      try {
        const docs = await api.documents.list()
        if (!cancelled) setReportCount(docs.total)
      } catch {
        if (!cancelled) setReportCount(null)
      }
    }
    void refreshReportCount()

    const onFocus = () => {
      void refreshReportCount()
    }
    const onDocumentsChanged = () => {
      void refreshReportCount()
    }
    window.addEventListener('focus', onFocus)
    window.addEventListener('vitalog-documents-changed', onDocumentsChanged)
    return () => {
      cancelled = true
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('vitalog-documents-changed', onDocumentsChanged)
    }
  }, [location.pathname])

  return (
    <aside className="w-64 h-screen sticky top-0 flex flex-col bg-surface px-3 py-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-forest flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-on-primary text-xl" aria-hidden="true">eco</span>
        </div>
        <span className="font-serif text-xl font-bold text-on-surface">Vitalog</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 py-2.5 px-4 rounded-xl cursor-pointer transition-colors',
                isActive
                  ? 'text-primary font-bold bg-surface-container-high'
                  : 'text-on-surface-variant hover:bg-surface-container-highest',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span 
                  className={`material-symbols-outlined text-xl ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
                {item.to === '/reports' && reportCount !== null && (
                  <span className="bg-secondary-container text-[10px] font-bold px-2 py-0.5 rounded-full text-on-secondary-container ml-auto min-w-[1.25rem] text-center">
                    {reportCount > 99 ? '99+' : reportCount}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="mt-auto">
        {/* Upgrade nudge — only on free tier once profile is known */}
        {(!profile || profile.plan !== 'pro') && (
          <div className="bg-surface-container rounded-2xl p-4 mb-4">
            <p className="font-serif text-sm font-semibold text-on-surface">Upgrade to Pro</p>
            <p className="text-xs text-on-surface-variant mt-1">Unlimited reports + family profiles</p>
            <Link
              to="/settings/subscription"
              className="mt-3 block w-full text-center bg-primary text-white text-xs font-semibold py-2 px-4 rounded-full hover:opacity-90 transition-opacity"
            >
              Upgrade Now
            </Link>
          </div>
        )}

        {/* User avatar row */}
        <div className="flex items-center gap-3 px-2 py-2">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-outline-variant/20"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {profileLoading ? '…' : initials}
            </div>
          )}
          <span className="text-sm font-medium text-on-surface flex-1 truncate">
            {profileLoading ? 'Loading…' : displayName}
          </span>
          <Link
            to="/settings"
            aria-label="Account settings"
            className="flex items-center justify-center p-1 rounded-full hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-lg" aria-hidden="true">
              more_vert
            </span>
          </Link>
        </div>
      </div>
    </aside>
  )
}
