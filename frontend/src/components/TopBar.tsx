import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { useToast } from './Toast'
import { useNotifications } from '../hooks/useNotifications'
import { useProfile } from '../hooks/useProfile'
import {
  accountDisplayName,
  accountEmail,
  initialsFromDisplayName,
  profileAvatarUrl,
} from '../lib/accountDisplay'
import { formatRelativeTime } from '../lib/formatRelativeTime'

interface TopBarProps {
  title: string
  subtitle?: string
  ctaLabel?: string
  onCtaClick?: () => void
  showCta?: boolean
}

export function TopBar({
  title,
  subtitle,
  ctaLabel = 'Upload Report',
  onCtaClick,
  showCta = true,
}: TopBarProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { addToast } = useToast()
  const { profile, loading: profileLoading } = useProfile()
  const { items: notifications, unreadCount, loading: notifLoading, refetch: refetchNotifications, markRead, markAllRead } =
    useNotifications({ limit: 20, loadOnMount: true })
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)
  const notifButtonRef = useRef<HTMLButtonElement>(null)
  const accountRef = useRef<HTMLDivElement>(null)
  const accountButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (notificationsOpen) {
      refetchNotifications()
    }
  }, [notificationsOpen, refetchNotifications])

  const closeNotifications = useCallback(() => {
    setNotificationsOpen(false)
    notifButtonRef.current?.focus()
  }, [])

  const closeAccount = useCallback(() => {
    setAccountOpen(false)
    accountButtonRef.current?.focus()
  }, [])

  const displayName = useMemo(() => accountDisplayName(profile, user), [profile, user])
  const email = useMemo(() => accountEmail(profile, user), [profile, user])
  const initials = useMemo(() => initialsFromDisplayName(displayName), [displayName])
  const avatarUrl = profileAvatarUrl(profile)

  const handleSignOut = useCallback(async () => {
    closeAccount()
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch {
      addToast({ type: 'error', title: 'Could not sign out' })
    }
  }, [addToast, closeAccount, navigate, signOut])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false)
      }
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false)
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (notificationsOpen) closeNotifications()
        if (accountOpen) closeAccount()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [notificationsOpen, accountOpen, closeNotifications, closeAccount])

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-4 sm:px-6 lg:px-8 h-14 sm:h-16 bg-surface/70 backdrop-blur-md border-b border-outline-variant/20">
      {/* Left: title + subtitle — pl-14 clears the mobile hamburger button */}
      <div className="min-w-0 flex-1 pl-14 lg:pl-0">
        <h1 className="font-serif text-lg sm:text-xl font-bold text-primary truncate">{title}</h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-on-surface-variant truncate hidden sm:block">{subtitle}</p>
        )}
      </div>

      {/* Right: CTA + icons */}
      <div className="flex items-center gap-1 sm:gap-2 shrink-0">
        {showCta && onCtaClick && (
          <button
            type="button"
            onClick={onCtaClick}
            className="bg-primary text-on-primary text-xs sm:text-sm font-bold px-3 sm:px-5 py-2 sm:py-2.5 rounded-full hover:opacity-90 transition-opacity flex items-center gap-1 sm:gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">upload_file</span>
            <span className="hidden sm:inline">{ctaLabel}</span>
          </button>
        )}

        {/* Notifications */}
        <div ref={notifRef} className="relative">
          <button
            ref={notifButtonRef}
            onClick={() => {
              setNotificationsOpen(!notificationsOpen)
              setAccountOpen(false)
            }}
            aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            aria-expanded={notificationsOpen}
            aria-haspopup="true"
            aria-controls="notifications-dropdown"
            className="relative w-10 h-10 rounded-full flex items-center justify-center hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center" aria-hidden="true">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationsOpen && (
            <div
              id="notifications-dropdown"
              role="menu"
              aria-label="Notifications"
              className="absolute right-0 top-12 w-80 bg-surface border border-outline-variant/30 rounded-xl shadow-xl overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
                <h3 className="font-bold text-on-surface">Notifications</h3>
                <button
                  type="button"
                  disabled={unreadCount === 0}
                  onClick={() => {
                    void markAllRead()
                  }}
                  className="text-xs text-secondary font-semibold hover:underline disabled:opacity-40 disabled:no-underline"
                >
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifLoading && notifications.length === 0 && (
                  <p className="px-4 py-6 text-sm text-on-surface-variant text-center">Loading…</p>
                )}
                {!notifLoading && notifications.length === 0 && (
                  <p className="px-4 py-6 text-sm text-on-surface-variant text-center">No notifications yet</p>
                )}
                {notifications.map((notif) => (
                  <button
                    key={notif.id}
                    type="button"
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-container transition-colors ${
                      !notif.read ? 'bg-primary-fixed/10' : ''
                    }`}
                    onClick={() => {
                      if (!notif.read) {
                        void markRead(notif.id)
                      }
                      if (notif.document_id) {
                        setNotificationsOpen(false)
                        navigate(`/reports/${notif.document_id}`)
                      }
                    }}
                  >
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                        !notif.read ? 'bg-primary-fixed' : 'bg-surface-container'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-lg ${
                          !notif.read ? 'text-primary' : 'text-on-surface-variant'
                        }`}
                      >
                        {notif.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${!notif.read ? 'font-bold text-on-surface' : 'text-on-surface-variant'}`}
                      >
                        {notif.title}
                      </p>
                      <p className="text-xs text-on-surface-variant truncate">{notif.body}</p>
                      <p className="text-[10px] text-on-surface-variant/60 mt-1">
                        {formatRelativeTime(notif.created_at)}
                      </p>
                    </div>
                    {!notif.read && <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />}
                  </button>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-outline-variant/20">
                <Link
                  to="/notifications"
                  className="text-sm text-secondary font-semibold hover:underline flex items-center justify-center gap-1"
                  onClick={() => setNotificationsOpen(false)}
                >
                  View all notifications
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Account */}
        <div ref={accountRef} className="relative">
          <button
            ref={accountButtonRef}
            onClick={() => {
              setAccountOpen(!accountOpen)
              setNotificationsOpen(false)
            }}
            aria-label={`Account menu, ${displayName}`}
            aria-expanded={accountOpen}
            aria-haspopup="true"
            aria-controls="account-dropdown"
            className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center hover:opacity-90 transition-opacity overflow-hidden shrink-0"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="font-bold text-sm text-primary" aria-hidden="true">
                {profileLoading && !profile ? '…' : initials}
              </span>
            )}
          </button>

          {/* Account Dropdown */}
          {accountOpen && (
            <div
              id="account-dropdown"
              role="menu"
              aria-label="Account options"
              className="absolute right-0 top-12 w-64 bg-surface border border-outline-variant/30 rounded-xl shadow-xl overflow-hidden"
            >
              {/* User info */}
              <div className="px-4 py-4 border-b border-outline-variant/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center overflow-hidden shrink-0">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="font-bold text-lg text-primary">{initials}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-on-surface truncate">{displayName}</p>
                    <p className="text-xs text-on-surface-variant truncate">{email || '—'}</p>
                  </div>
                </div>
                {profile && (
                  <div className="mt-3 px-3 py-1.5 bg-primary-fixed/30 rounded-full inline-flex items-center gap-1">
                    <span
                      className="material-symbols-outlined text-primary text-sm"
                      style={{ fontVariationSettings: "'FILL' 1" }}
                    >
                      star
                    </span>
                    <span className="text-xs font-bold text-primary">
                      {profile.plan === 'pro' ? 'Pro Plan' : 'Free'}
                    </span>
                  </div>
                )}
              </div>

              {/* Menu items */}
              <div className="py-2">
                <Link
                  to="/settings"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  onClick={() => setAccountOpen(false)}
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">account_circle</span>
                  My Profile
                </Link>
                <Link
                  to="/settings/subscription"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  onClick={() => setAccountOpen(false)}
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">payments</span>
                  Subscription
                </Link>
                <Link
                  to="/settings/privacy"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  onClick={() => setAccountOpen(false)}
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">lock</span>
                  Privacy & Security
                </Link>
                <Link
                  to="/settings/notifications"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container transition-colors"
                  onClick={() => setAccountOpen(false)}
                >
                  <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
                  Notification Settings
                </Link>
              </div>

              {/* Sign out */}
              <div className="border-t border-outline-variant/20 py-2">
                <button
                  type="button"
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-error hover:bg-error-container/20 transition-colors w-full"
                  onClick={() => void handleSignOut()}
                >
                  <span className="material-symbols-outlined text-xl">logout</span>
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default TopBar
