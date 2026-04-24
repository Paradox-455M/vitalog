import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { vi } from 'vitest'
import { RequireAuth } from './RequireAuth'

// Mock useAuth so we control session/loading state
vi.mock('../auth/authContext', () => ({
  useAuth: vi.fn(),
}))

import { useAuth } from '../auth/authContext'
const mockUseAuth = useAuth as ReturnType<typeof vi.fn>

function renderWithRouter(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/protected" element={ui} />
        <Route path="/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

test('shows spinner while loading', () => {
  mockUseAuth.mockReturnValue({ session: null, loading: true })
  renderWithRouter(<RequireAuth><div>Protected</div></RequireAuth>)
  expect(screen.getByRole('status')).toBeInTheDocument()
  expect(screen.queryByText('Protected')).not.toBeInTheDocument()
})

test('redirects to /login when unauthenticated', () => {
  mockUseAuth.mockReturnValue({ session: null, loading: false })
  renderWithRouter(<RequireAuth><div>Protected</div></RequireAuth>)
  expect(screen.getByText('Login page')).toBeInTheDocument()
  expect(screen.queryByText('Protected')).not.toBeInTheDocument()
})

test('renders children when authenticated', () => {
  mockUseAuth.mockReturnValue({ session: { user: { id: '1' } }, loading: false })
  renderWithRouter(<RequireAuth><div>Protected</div></RequireAuth>)
  expect(screen.getByText('Protected')).toBeInTheDocument()
})
