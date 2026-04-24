import { Link, useLocation } from 'react-router-dom'

const SETTINGS_NAV = [
  { path: '/settings', label: 'Profile', icon: 'account_circle' },
  { path: '/settings/notifications', label: 'Notifications', icon: 'notifications' },
  { path: '/settings/privacy', label: 'Privacy', icon: 'lock' },
  { path: '/settings/subscription', label: 'Subscription', icon: 'payments' },
]

interface SettingsLayoutProps {
  title: string
  children: React.ReactNode
}

export function SettingsLayout({ title, children }: SettingsLayoutProps) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-surface">
      {/* Sticky header */}
      <header className="bg-surface/70 backdrop-blur-md sticky top-0 z-40 flex justify-between items-center px-8 h-16 w-full border-b border-outline-variant/20">
        <span className="font-serif text-xl font-bold text-primary">{title}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Notifications"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">
              notifications
            </span>
          </button>
          <button
            type="button"
            aria-label="Help"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-[22px]">
              help
            </span>
          </button>
        </div>
      </header>

      {/* Page body with sidebar */}
      <div className="max-w-6xl mx-auto px-8 py-10">
        <div className="flex gap-8 items-start">
          {/* Sidebar sub-nav — sticky so Back to Dashboard stays visible while main scrolls */}
          <aside className="w-56 shrink-0 sticky top-24 z-30 self-start">
            <nav className="space-y-1">
              {SETTINGS_NAV.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </nav>

            {/* Back to app link */}
            <div className="mt-8 pt-8 border-t border-outline-variant/20">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 text-sm text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
                Back to Dashboard
              </Link>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
