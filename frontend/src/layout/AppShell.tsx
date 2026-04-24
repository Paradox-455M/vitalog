import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { SideNav } from '../components/SideNav'

export function AppShell() {
  const location = useLocation()
  const isSettingsPage = location.pathname.startsWith('/settings')
  
  const [sideNavCollapsed, setSideNavCollapsed] = useState(isSettingsPage)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect -- derive layout from route */
  useEffect(() => {
    if (isSettingsPage) {
      setSideNavCollapsed(true)
    }
  }, [isSettingsPage])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false)
  }, [location.pathname])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle escape key and body scroll lock for mobile drawer
  useEffect(() => {
    if (!mobileDrawerOpen) return

    document.body.style.overflow = 'hidden'

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [mobileDrawerOpen])

  const closeMobileDrawer = useCallback(() => {
    setMobileDrawerOpen(false)
  }, [])

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-primary focus:text-on-primary focus:px-4 focus:py-2 focus:rounded-lg focus:shadow-lg focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Mobile hamburger button - visible on small screens */}
      <button
        type="button"
        onClick={() => setMobileDrawerOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-50 bg-surface-container text-on-surface-variant p-2 rounded-lg shadow-md hover:bg-surface-container-high transition-colors border border-outline-variant/20"
        aria-label="Open navigation menu"
        aria-expanded={mobileDrawerOpen}
        aria-controls="mobile-nav-drawer"
      >
        <span className="material-symbols-outlined" aria-hidden="true">menu</span>
      </button>

      {/* Mobile drawer overlay */}
      {mobileDrawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60] bg-on-surface/40 backdrop-blur-sm"
          onClick={closeMobileDrawer}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={`lg:hidden fixed inset-y-0 left-0 z-[70] w-64 bg-surface shadow-2xl transform transition-transform duration-300 ease-out ${
          mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Close button inside drawer */}
        <button
          type="button"
          onClick={closeMobileDrawer}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-surface-container transition-colors"
          aria-label="Close navigation menu"
        >
          <span className="material-symbols-outlined text-on-surface-variant" aria-hidden="true">close</span>
        </button>
        <SideNav />
      </aside>

      {/* Desktop SideNav - hidden on mobile */}
      <div
        className={`hidden lg:block relative transition-all duration-300 ease-in-out ${
          sideNavCollapsed ? 'w-0' : 'w-64'
        }`}
      >
        <div className={`absolute inset-y-0 left-0 w-64 transition-transform duration-300 ease-in-out ${
          sideNavCollapsed ? '-translate-x-full' : 'translate-x-0'
        }`}>
          <SideNav />
        </div>
      </div>

      {/* Desktop expand button when collapsed */}
      {sideNavCollapsed && (
        <button
          type="button"
          onClick={() => setSideNavCollapsed(false)}
          className="hidden lg:flex fixed left-0 top-1/2 -translate-y-1/2 z-50 bg-primary text-on-primary p-2 rounded-r-lg shadow-lg hover:bg-primary/90 transition-colors"
          aria-label="Expand navigation"
        >
          <span className="material-symbols-outlined" aria-hidden="true">chevron_right</span>
        </button>
      )}

      {/* Desktop collapse button when expanded */}
      {!sideNavCollapsed && isSettingsPage && (
        <button
          type="button"
          onClick={() => setSideNavCollapsed(true)}
          className="hidden lg:flex fixed left-60 top-1/2 -translate-y-1/2 z-50 bg-surface-container text-on-surface-variant p-1.5 rounded-full shadow-md hover:bg-surface-container-high transition-colors border border-outline-variant/20"
          aria-label="Collapse navigation"
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">chevron_left</span>
        </button>
      )}

      <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
