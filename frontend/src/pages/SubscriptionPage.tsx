import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { SettingsLayout } from '../layout/SettingsLayout'
import { useToast } from '../components/Toast'
import { useFamilyMembers } from '../hooks/useFamilyMembers'
import { useProfile } from '../hooks/useProfile'
import { api } from '../lib/api'
import type { SubscriptionPayment } from '../lib/api'

function loadRazorpayScript(): Promise<void> {
  if (document.querySelector('script[src*="razorpay"]')) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Razorpay SDK'))
    document.head.appendChild(s)
  })
}

const FREE_MAX_UPLOADS = 3
const FAMILY_MAX_FREE = 1
const FAMILY_MAX_PRO = 5
const PRO_PRICE_INR = 299

function formatInrFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(paise / 100)
}

function billingLoadErrorMessage(detail: string): string {
  const t = detail.trim()
  if (/^not found$/i.test(t) || t.toLowerCase().includes('not found')) {
    return 'Could not load payments. Check that the Vitalog API is running and exposes GET /api/subscription/payments (e.g. rebuild and restart cmd/server).'
  }
  return `Could not load payments. ${t}`
}

export function SubscriptionPage() {
  const { addToast } = useToast()
  const { profile, loading: profileLoading, error: profileError, refetch: refetchProfile } = useProfile()
  const { members, loading: familyLoading, error: familyError } = useFamilyMembers()
  const [payments, setPayments] = useState<SubscriptionPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsError, setPaymentsError] = useState<string | null>(null)

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true)
    setPaymentsError(null)
    try {
      const rows = await api.subscription.listPayments(50)
      setPayments(rows)
    } catch (e) {
      setPaymentsError(e instanceof Error ? e.message : 'Could not load billing history')
    } finally {
      setPaymentsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPayments()
  }, [loadPayments])

  const loading = profileLoading || familyLoading
  const isPro = profile?.plan === 'pro'
  const maxFamily = isPro ? FAMILY_MAX_PRO : FAMILY_MAX_FREE
  const familyCount = members.length
  const docCount = profile?.document_count ?? 0

  const uploadPercent = isPro ? 100 : Math.min(100, (docCount / FREE_MAX_UPLOADS) * 100)
  const familyPercent = Math.min(100, (familyCount / maxFamily) * 100)

  const uploadLabel = isPro
    ? 'Unlimited'
    : `${docCount} / ${FREE_MAX_UPLOADS} uploads`
  const familyLabel = `${familyCount} / ${maxFamily} family profiles`

  const [upgrading, setUpgrading] = useState(false)

  const handleUpgrade = useCallback(async () => {
    setUpgrading(true)
    try {
      const order = await api.subscription.createOrder()
      if (order.mock) {
        addToast({ type: 'success', title: 'Upgrade successful!', message: 'Welcome to Vitalog Pro!' })
        void refetchProfile()
        void loadPayments()
        return
      }
      // Real mode: load Razorpay SDK and open checkout
      await loadRazorpayScript()
      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: 'Vitalog',
        description: 'Pro Plan - Monthly',
        handler: () => {
          addToast({ type: 'success', title: 'Payment successful!' })
          setTimeout(() => {
            void refetchProfile()
            void loadPayments()
          }, 2000)
        },
        prefill: { email: profile?.email },
        theme: { color: '#3e6327' },
      })
      rzp.open()
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Checkout failed',
        message: err instanceof Error ? err.message : 'Please try again.',
      })
    } finally {
      setUpgrading(false)
    }
  }, [addToast, profile?.email, refetchProfile, loadPayments])

  const handleNotAvailable = (what: string) => {
    addToast({
      type: 'info',
      title: 'Not available',
      message: `${what} is not available in the app yet.`,
    })
  }

  return (
    <SettingsLayout title="Subscription">
      <header className="mb-10">
        <h1 className="font-serif text-3xl font-bold text-on-surface tracking-tight">Subscription</h1>
        <p className="text-on-surface-variant mt-2">
          Your plan, usage, and payments recorded by Vitalog after a successful Razorpay charge.
        </p>
      </header>

      {(profileError || familyError) && (
        <p className="mb-6 text-sm text-error" role="alert">
          {profileError?.message || familyError?.message}
        </p>
      )}

      {loading || !profile ? (
        <p className="text-on-surface-variant">Loading subscription…</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            <div
              className={`rounded-xl p-8 shadow-sm border ${
                !isPro
                  ? 'bg-surface-container-lowest border-primary border-2'
                  : 'bg-surface-container-lowest border-outline-variant'
              }`}
            >
              <div className="mb-6">
                <span className="inline-flex items-center px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-xs font-bold uppercase tracking-widest">
                  Free Plan
                </span>
              </div>
              <h3 className="font-serif text-2xl font-bold text-on-surface mb-2">Free</h3>
              <p className="text-on-surface-variant mb-6">Get started with basic health tracking.</p>
              <div className="flex items-baseline gap-2 mb-6">
                <span className="font-serif text-3xl font-bold text-on-surface">₹0</span>
                <span className="text-on-surface-variant">/forever</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-secondary text-lg">check_circle</span>
                  {FREE_MAX_UPLOADS} lifetime uploads on free tier
                </li>
                <li className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-secondary text-lg">check_circle</span>
                  {FAMILY_MAX_FREE} family member
                </li>
                <li className="flex items-center gap-3 text-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-secondary text-lg">check_circle</span>
                  Basic AI summary
                </li>
                <li className="flex items-center gap-3 text-sm text-stone-400">
                  <span className="material-symbols-outlined text-lg">cancel</span>
                  Higher family limits
                </li>
                <li className="flex items-center gap-3 text-sm text-stone-400">
                  <span className="material-symbols-outlined text-lg">cancel</span>
                  Unlimited uploads
                </li>
              </ul>
              {!isPro ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 border-2 border-primary text-primary rounded-lg font-bold bg-primary/5"
                >
                  Current plan
                </button>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 border-2 border-outline-variant text-on-surface-variant rounded-lg font-bold"
                >
                  Not on Free
                </button>
              )}
            </div>

            <div
              className={`rounded-xl p-8 shadow-xl relative overflow-hidden ${
                isPro
                  ? 'bg-gradient-to-br from-primary to-forest text-white ring-2 ring-secondary'
                  : 'bg-gradient-to-br from-primary to-forest text-white opacity-95'
              }`}
            >
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/5 rounded-full" />
              <div className="absolute -left-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full" />

              <div className="relative z-10">
                <div className="mb-6">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/20 text-white rounded-full text-xs font-bold uppercase tracking-widest">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>
                      star
                    </span>
                    Pro Plan
                  </span>
                </div>
                <h3 className="font-serif text-2xl font-bold mb-2">Pro</h3>
                <p className="text-white/80 mb-6">Full access to uploads and family sharing.</p>
                <div className="flex items-baseline gap-2 mb-6">
                  <span className="font-serif text-3xl font-bold">₹{PRO_PRICE_INR}</span>
                  <span className="text-white/80">/month</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    'Unlimited uploads',
                    `Up to ${FAMILY_MAX_PRO} family profiles`,
                    'Advanced AI insights',
                    'Trend charts and analytics',
                    'PDF export where available',
                  ].map((line) => (
                    <li key={line} className="flex items-center gap-3 text-sm">
                      <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                        check_circle
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
                {isPro ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 bg-white/30 text-white rounded-lg font-bold cursor-default"
                  >
                    Current plan
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleUpgrade()}
                    disabled={upgrading}
                    className="w-full py-3 bg-white text-primary rounded-lg font-bold hover:bg-white/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-lg">bolt</span>
                    Upgrade to Pro
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8 space-y-6">
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 flex flex-col md:flex-row justify-between items-start gap-8 shadow-sm">
                <div className="space-y-4 max-w-md">
                  <span className="inline-flex items-center px-3 py-1 bg-primary-fixed text-on-primary-fixed-variant rounded-full text-xs font-bold uppercase tracking-widest">
                    Current Plan
                  </span>
                  <h3 className="font-serif text-3xl font-bold text-primary">
                    {isPro ? 'Pro Plan' : 'Free Plan'}
                  </h3>
                  <p className="text-on-surface-variant">
                    {isPro
                      ? 'Full access to biomarker tracking and expanded family sharing.'
                      : 'Limited uploads and one family profile. Upgrade when you are ready.'}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <span className="font-serif text-4xl font-bold text-primary">
                      {isPro ? `₹${PRO_PRICE_INR}` : '₹0'}
                    </span>
                    <span className="text-on-surface-variant">{isPro ? '/month (list price)' : '/forever'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                    <span className="material-symbols-outlined text-base">event_repeat</span>
                    Renewal dates are not stored in Vitalog yet. Pro access follows your Razorpay billing.
                  </div>
                </div>

                <div className="flex flex-col w-full md:w-auto gap-3">
                  {!isPro && (
                    <button
                      type="button"
                      onClick={() => void handleUpgrade()}
                      disabled={upgrading}
                      className="bg-primary-container text-on-primary-container hover:opacity-90 px-8 py-3 rounded-lg font-bold transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-base">bolt</span>
                      Upgrade Plan
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNotAvailable('Changing payment method')}
                    className="border-2 border-primary-container text-primary-container hover:bg-primary-container/5 px-8 py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-base">payments</span>
                    Change Payment Method
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNotAvailable('Cancel subscription')}
                    className="text-on-surface-variant hover:text-error transition-colors font-medium text-sm mt-2 underline underline-offset-4 decoration-outline-variant text-left"
                  >
                    Cancel Subscription
                  </button>
                </div>
              </div>

              {isPro && (
                <div className="bg-surface-container-low rounded-xl p-8">
                  <h4 className="font-serif font-bold text-xl mb-6 flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>
                      verified
                    </span>
                    Pro Perks Included
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                      'Unlimited document uploads and extraction.',
                      `Up to ${FAMILY_MAX_PRO} family members on one plan.`,
                      'Richer insights and timeline features as we ship them.',
                      'Priority access to new health insight features.',
                    ].map((perk) => (
                      <div key={perk} className="flex items-start gap-4">
                        <div className="bg-secondary-container p-1 rounded-full text-on-secondary-container shrink-0">
                          <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                            check_circle
                          </span>
                        </div>
                        <p className="text-on-surface-variant leading-relaxed">{perk}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                <div className="p-6 border-b border-outline-variant">
                  <h4 className="font-serif font-bold text-lg text-primary">Billing History</h4>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Charges recorded when Razorpay sends <code className="text-xs bg-surface-container px-1 rounded">payment.captured</code>{' '}
                    to our webhook. Older upgrades may not appear.
                  </p>
                </div>

                <table className="w-full text-left">
                  <thead className="bg-surface-container text-on-surface-variant text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Date</th>
                      <th className="px-6 py-3 font-semibold">Amount</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">Payment ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant">
                    {paymentsLoading ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-sm text-on-surface-variant">
                          Loading payments…
                        </td>
                      </tr>
                    ) : paymentsError ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-sm text-error" role="alert">
                          {billingLoadErrorMessage(paymentsError)}
                        </td>
                      </tr>
                    ) : payments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-6 py-4 text-sm text-on-surface-variant">
                          No payments recorded yet.
                        </td>
                      </tr>
                    ) : (
                      payments.map((row) => (
                        <tr key={row.id} className="hover:bg-surface-container transition-colors">
                          <td className="px-6 py-4 text-sm font-medium">
                            {format(new Date(row.created_at), 'MMM d, yyyy')}
                          </td>
                          <td className="px-6 py-4 text-sm">{formatInrFromPaise(row.amount_paise)}</td>
                          <td className="px-6 py-4">
                            <span className="inline-flex px-2 py-0.5 bg-secondary-fixed text-on-secondary-fixed-variant rounded text-[10px] font-bold uppercase">
                              {row.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right text-xs font-mono text-on-surface-variant">
                            {row.razorpay_payment_id.length > 10
                              ? `…${row.razorpay_payment_id.slice(-10)}`
                              : row.razorpay_payment_id}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-primary-container rounded-xl p-6 text-on-primary-container shadow-xl relative overflow-hidden border border-outline-variant/20">
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
                <div className="relative z-10 space-y-3">
                  <span className="material-symbols-outlined text-3xl opacity-90">payments</span>
                  <h4 className="font-serif font-bold text-lg">Payment details</h4>
                  <p className="text-sm opacity-90 leading-relaxed">
                    Card and UPI details are handled by Razorpay at checkout. Vitalog does not store full card numbers—only
                    successful charges appear in billing history above.
                  </p>
                </div>
              </div>

              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-sm">
                <h4 className="font-serif font-bold text-lg text-primary mb-4">Plan Usage</h4>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                      <span>Reports uploaded</span>
                      <span className="text-secondary">{uploadLabel}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all"
                        style={{ width: `${uploadPercent}%` }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-bold uppercase tracking-wide">
                      <span>Family members</span>
                      <span className="text-secondary">{familyLabel}</span>
                    </div>
                    <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div
                        className="h-full bg-secondary rounded-full transition-all"
                        style={{ width: `${familyPercent}%` }}
                      />
                    </div>
                  </div>
                </div>

                <Link
                  to="/family"
                  className="mt-6 block w-full text-center text-sm font-bold text-secondary py-2 border border-secondary rounded-lg hover:bg-secondary/5 transition-colors"
                >
                  Manage family
                </Link>
              </div>

              <div className="bg-tertiary-fixed rounded-xl p-6 flex items-start gap-4 shadow-sm border border-tertiary-fixed-dim/30">
                <div className="bg-tertiary-container p-2 rounded-lg shrink-0">
                  <span className="material-symbols-outlined text-on-tertiary-container">support_agent</span>
                </div>
                <div>
                  <h5 className="font-serif font-bold text-tertiary">Need assistance?</h5>
                  <p className="text-xs text-on-tertiary-fixed-variant mt-1 mb-3">
                    Questions about billing or your plan? Reach out through your usual support channel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </SettingsLayout>
  )
}
