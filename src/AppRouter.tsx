import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { RequireAuth, RequireAdmin, RequireWorker, RootRedirect } from './components/RouteGuards'

// Lazy load pages to reduce initial bundle
const LoginPage = lazy(() => import('./pages/LoginPage'))
const WorkerHomePage = lazy(() => import('./pages/WorkerHomePage'))
const ScannerPage = lazy(() => import('./pages/ScannerPage'))
const ReportFormPage = lazy(() => import('./pages/ReportFormPage'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))
const QrGeneratorPage = lazy(() => import('./pages/QrGeneratorPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage'))

function PageLoader() {
  return (
    <div className="min-h-screen bg-factory-dark flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
    </div>
  )
}

export default function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Worker routes */}
        <Route path="/home" element={
          <RequireAuth><RequireWorker><WorkerHomePage /></RequireWorker></RequireAuth>
        } />
        <Route path="/scan" element={
          <RequireAuth><RequireWorker><ScannerPage /></RequireWorker></RequireAuth>
        } />
        <Route path="/report" element={
          <RequireAuth><RequireWorker><ReportFormPage /></RequireWorker></RequireAuth>
        } />
        <Route path="/profile" element={
          <RequireAuth><RequireWorker><ProfilePage /></RequireWorker></RequireAuth>
        } />
        <Route path="/history" element={
          <RequireAuth><RequireWorker><HistoryPage /></RequireWorker></RequireAuth>
        } />

        {/* Admin routes */}
        <Route path="/dashboard" element={
          <RequireAdmin><AdminDashboard /></RequireAdmin>
        } />
        <Route path="/qr-generator" element={
          <RequireAdmin><QrGeneratorPage /></RequireAdmin>
        } />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
