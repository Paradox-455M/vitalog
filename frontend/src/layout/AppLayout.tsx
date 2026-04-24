import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <div>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: 'rgba(250,250,247,0.92)',
          borderBottom: '1px solid var(--border, #e5e4e7)',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ fontWeight: 700 }}>Vitalog</div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <NavLink to="/" style={{ textDecoration: 'none' }}>
            Home
          </NavLink>
          {!loading && !user ? (
            <>
              <NavLink to="/login" style={{ textDecoration: 'none' }}>
                Login
              </NavLink>
              <NavLink to="/signup" style={{ textDecoration: 'none' }}>
                Signup
              </NavLink>
            </>
          ) : null}

          {user ? (
            <button
              type="button"
              onClick={async () => {
                await signOut()
                navigate('/login')
              }}
            >
              Sign out
            </button>
          ) : null}
        </nav>
      </header>

      <main>{children}</main>
    </div>
  )
}

