import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi } from 'vitest'
import { OnboardingPage } from './OnboardingPage'

// Stub UploadModal so we can assert it opens without full modal rendering
vi.mock('../components/UploadModal', () => ({
  UploadModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="upload-modal">Upload Modal</div> : null,
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>
  )
}

test('renders welcome heading and value prop', () => {
  renderPage()
  expect(screen.getByRole('heading', { name: /welcome to vitalog/i })).toBeInTheDocument()
  expect(screen.getByText(/upload a lab report/i)).toBeInTheDocument()
})

test('CTA button opens upload modal', async () => {
  renderPage()
  expect(screen.queryByTestId('upload-modal')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: /upload your first report/i }))
  expect(screen.getByTestId('upload-modal')).toBeInTheDocument()
})

test('skip link navigates to /dashboard', async () => {
  renderPage()
  await userEvent.click(screen.getByRole('link', { name: /skip for now/i }))
  expect(screen.getByText('Dashboard')).toBeInTheDocument()
})
