import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'

export function RequireAuth({ children }: { children: React.ReactElement }) {
  const { session, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center" role="status" aria-label="Loading">
        <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Navigate to="/login" replace />
  return children
}

