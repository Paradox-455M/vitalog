import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { AuthSplitPanel } from '../components/AuthSplitPanel'

export function LoginPage() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: signInError } = await signIn(email, password)

      if (signInError) {
        setError(signInError)
        return
      }

      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplitPanel>
      {/* Logo mark */}
      <div className="mb-12">
        <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-3xl">energy_savings_leaf</span>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex w-full mb-10 border-b border-outline-variant/30">
        <button
          type="button"
          className="flex-1 py-4 text-sm font-semibold text-outline hover:text-primary transition-colors"
          onClick={() => navigate('/signup')}
        >
          Sign up
        </button>
        <button
          type="button"
          className="flex-1 py-4 text-sm font-semibold text-primary border-b-2 border-primary"
        >
          Log in
        </button>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="w-full space-y-6">
        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1 mb-1.5">
            Email
          </label>
          <input
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            autoComplete="email"
            placeholder="arjun@vitalog.health"
            className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all outline-none"
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex justify-between items-center ml-1 mb-1.5">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
              Password
            </label>
          </div>
          <input
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            className="w-full bg-surface-container-highest border-0 rounded-xl px-4 py-3.5 focus:ring-2 focus:ring-primary/20 focus:bg-surface-container-lowest transition-all outline-none"
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              disabled
              title="Coming soon — password reset via email"
              className="text-sm text-outline opacity-50 cursor-not-allowed"
            >
              Forgot password?
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-error">{error}</p>
        )}

        {/* Sign in button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary hover:bg-forest text-white font-semibold py-4 rounded-full transition-all active:scale-[0.98] shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing in…
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="flex items-center w-full my-8">
        <div className="flex-1 h-px bg-outline-variant/40" />
        <span className="mx-4 text-xs font-medium text-outline uppercase tracking-widest">
          or continue with
        </span>
        <div className="flex-1 h-px bg-outline-variant/40" />
      </div>

      {/* Google OAuth — coming in Phase 8 */}
      <button
        type="button"
        disabled
        title="Coming soon"
        className="w-full py-3.5 flex items-center justify-center gap-3 bg-white border border-outline-variant/50 rounded-full opacity-50 cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span className="text-on-surface font-medium">Continue with Google</span>
      </button>

      {/* Footer — new to Vitalog */}
      <p className="mt-12 text-sm text-on-surface-variant">
        New to Vitalog?
        <Link to="/signup" className="text-primary font-bold hover:underline ml-1">
          Sign up
        </Link>
      </p>

      {/* Fixed bottom footer — right panel only */}
      <div className="fixed bottom-0 w-full lg:w-[45%] right-0 py-6 px-12 flex justify-center lg:justify-between items-center bg-surface/80 backdrop-blur-sm">
        <a href="#" className="text-xs uppercase tracking-widest text-outline hover:text-primary transition-colors">
          Privacy Policy
        </a>
        <a href="#" className="text-xs uppercase tracking-widest text-outline hover:text-primary transition-colors">
          Terms of Service
        </a>
        <a href="#" className="text-xs uppercase tracking-widest text-outline hover:text-primary transition-colors">
          Help Center
        </a>
      </div>
    </AuthSplitPanel>
  )
}
