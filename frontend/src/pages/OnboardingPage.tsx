import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UploadModal } from '../components/UploadModal'

export function OnboardingPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const navigate = useNavigate()

  function handleModalClose() {
    setUploadOpen(false)
    navigate('/dashboard')
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full flex flex-col items-center text-center gap-8">

        {/* Icon mark */}
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
          <span className="material-symbols-outlined text-primary text-4xl">energy_savings_leaf</span>
        </div>

        {/* Heading and value prop */}
        <div className="flex flex-col gap-3">
          <h1 className="font-serif text-3xl font-bold text-on-surface">Welcome to Vitalog</h1>
          <p className="text-on-surface-variant leading-relaxed">
            Upload a lab report and we'll extract your results, explain what they mean,
            and build your personal health timeline over time.
          </p>
        </div>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 w-full">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="w-full bg-primary hover:bg-forest text-white font-semibold py-4 rounded-full transition-all active:scale-[0.98] shadow-lg"
          >
            Upload your first report
          </button>
          <Link
            to="/dashboard"
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Skip for now →
          </Link>
        </div>
      </div>

      <UploadModal isOpen={uploadOpen} onClose={handleModalClose} />
    </div>
  )
}
