import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/authContext'
import { AuthSplitPanel } from '../components/AuthSplitPanel'

export function SignupPage() {
  const { signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error: signUpError, needsConfirmation } = await signUp(email, password, name)

      if (signUpError) {
        setError(signUpError)
        return
      }

      if (!needsConfirmation) {
        navigate('/onboarding')
      } else {
        // Email confirmation still enabled on remote — guide the user
        setError('Account created — please check your email to verify before signing in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthSplitPanel>
      {/* Eco icon mark */}
      <div className="mb-8 p-3 bg-primary/10 rounded-2xl">
        <span className="material-symbols-outlined text-primary text-4xl">eco</span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-8 mb-10 w-full justify-center">
        <button
          type="button"
          className="pb-2 text-[#3e6327] font-bold border-b-2 border-[#3e6327] transition-all"
        >
          Sign up
        </button>
        <button
          type="button"
          className="pb-2 text-[#44483d] hover:text-[#3e6327] transition-all"
          onClick={() => navigate('/login')}
        >
          Log in
        </button>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="w-full space-y-5">
        {/* Full name */}
        <div>
          <label htmlFor="name" className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1 mb-1.5">
            Full name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            required
            autoComplete="name"
            placeholder="Arjun Sharma"
            className="w-full px-5 py-3.5 bg-surface-container-highest/30 border-none rounded-xl focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all outline-none"
          />
        </div>

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
            className="w-full px-5 py-3.5 bg-surface-container-highest/30 border-none rounded-xl focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all outline-none"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-on-surface-variant ml-1 mb-1.5">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              placeholder="Create a strong password"
              className="w-full px-5 py-3.5 bg-surface-container-highest/30 border-none rounded-xl focus:ring-2 focus:ring-primary/40 focus:bg-white transition-all outline-none pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              <span className="material-symbols-outlined text-xl">
                {showPassword ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p className="text-sm text-error mt-1">{error}</p>
        )}

        {/* CTA button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-[#4A7C5F] text-white font-semibold rounded-full hover:shadow-lg hover:opacity-90 active:scale-[0.98] transition-all duration-300 mt-2 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Creating account…
            </>
          ) : (
            'Create account'
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
        className="w-full py-3.5 flex items-center justify-center gap-3 bg-white border border-outline-variant/50 rounded-xl opacity-50 cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        <span className="text-on-surface font-medium">Continue with Google</span>
      </button>

      {/* Footer terms */}
      <p className="mt-8 text-[12px] text-outline text-center px-4">
        By signing up, you agree to our{' '}
        <a href="#" className="text-primary hover:underline">Terms of Service</a>
        {' '}and{' '}
        <a href="#" className="text-primary hover:underline">Privacy Policy</a>
      </p>
    </AuthSplitPanel>
  )
}
