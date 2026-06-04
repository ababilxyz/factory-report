import { Navigate } from 'react-router-dom'
import { type ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-factory-dark flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-factory-accent/30 border-t-factory-accent animate-spin" />
    </div>
  )
}

/** Requires authentication. Redirects to /login if not signed in. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUser, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!currentUser) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Requires admin role. Redirects to /home if worker. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { appUser, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!appUser) return <Navigate to="/login" replace />
  if (appUser.role !== 'admin') return <Navigate to="/home" replace />
  return <>{children}</>
}

/** Requires worker role. Redirects to /dashboard if admin. */
export function RequireWorker({ children }: { children: ReactNode }) {
  const { appUser, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!appUser) return <Navigate to="/login" replace />
  if (appUser.role !== 'worker') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

/** Smart root redirect based on role. */
export function RootRedirect() {
  const { appUser, currentUser, loading } = useAuth()
  if (loading) return <LoadingSpinner />
  if (!currentUser) return <Navigate to="/login" replace />
  if (appUser?.role === 'admin') return <Navigate to="/dashboard" replace />
  return <Navigate to="/home" replace />
}
