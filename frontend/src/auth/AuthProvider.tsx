import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import { AuthContext, type AuthContextValue } from './authContext'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthContextValue['session']>(null)
  const [user, setUser] = useState<AuthContextValue['user']>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const { data, error } = await supabase.auth.getSession()
      if (!mounted) return

      if (error && import.meta.env.DEV) {
        // L5: Only log auth errors in development — never in production.
        console.error('Supabase getSession error:', error.message)
      }

      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession)
      setUser(newSession?.user ?? null)
      setLoading(false)

      if (event === 'SIGNED_IN' && newSession) {
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : undefined
        void api.privacy.recordAccessEvent(ua).catch(() => {
          /* non-blocking privacy audit */
        })
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loading,
      signOut: async () => {
        await supabase.auth.signOut()
      },
      signIn: async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        return { error: error?.message ?? null }
      },
      signUp: async (email: string, password: string, fullName: string) => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
        if (error) return { error: error.message, needsConfirmation: false }
        return { error: null, needsConfirmation: !data.session }
      },
    }),
    [loading, session, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
