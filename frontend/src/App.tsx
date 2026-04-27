import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RequireAuth } from './components/RequireAuth'
import { AppShell } from './layout/AppShell'

// Eager — small pages, needed on first load
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { SignupPage } from './pages/SignupPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { SettingsPage } from './pages/SettingsPage'
import { NotificationSettingsPage } from './pages/NotificationSettingsPage'
import { PrivacyPage } from './pages/PrivacyPage'
import { SubscriptionPage } from './pages/SubscriptionPage'
import { BiomarkerLibraryPage } from './pages/BiomarkerLibraryPage'
import { InsightsPage } from './pages/InsightsPage'
import { NotificationInboxPage } from './pages/NotificationInboxPage'

// Lazy — heavy Recharts-backed pages
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage').then((m) => ({ default: m.ReportDetailPage })))
const HealthTimelinePage = lazy(() => import('./pages/HealthTimelinePage').then((m) => ({ default: m.HealthTimelinePage })))
const FamilyPage = lazy(() => import('./pages/FamilyPage').then((m) => ({ default: m.FamilyPage })))

function PageSkeleton() {
  return (
    <div className="flex-1 h-screen overflow-y-auto px-6 py-8 space-y-4 animate-pulse">
      <div className="h-12 bg-surface-container rounded-xl w-64" />
      <div className="h-4 bg-surface-container rounded w-48" />
      <div className="grid grid-cols-4 gap-4 mt-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-surface-container rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />

          {/* Protected — AppShell layout */}
          <Route element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/reports" element={
              <Suspense fallback={<PageSkeleton />}><ReportsPage /></Suspense>
            } />
            <Route path="/reports/:id" element={
              <Suspense fallback={<PageSkeleton />}><ReportDetailPage /></Suspense>
            } />
            <Route path="/timeline" element={
              <Suspense fallback={<PageSkeleton />}><HealthTimelinePage /></Suspense>
            } />
            <Route path="/family" element={
              <Suspense fallback={<PageSkeleton />}><FamilyPage /></Suspense>
            } />
            <Route path="/biomarkers" element={<BiomarkerLibraryPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/notifications" element={<NotificationInboxPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/notifications" element={<NotificationSettingsPage />} />
            <Route path="/settings/privacy" element={<PrivacyPage />} />
            <Route path="/settings/subscription" element={<SubscriptionPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
