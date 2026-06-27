/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { AdminDashboard } from './pages/AdminDashboard';
import { DispatcherDashboard } from './pages/DispatcherDashboard';
import { PassengerDashboard } from './pages/PassengerDashboard';
import { RoutesPage } from './pages/RoutesPage';
import { StopsPage } from './pages/StopsPage';
import { FleetPage } from './pages/FleetPage';
import { AlertsPage } from './pages/AlertsPage';
import { LogsPage } from './pages/LogsPage';
import { NotifyPage } from './pages/NotifyPage';
import { Contact } from './pages/Contact';
import { Reports } from './pages/Reports';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && profile && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />
            <Route path="/login" element={<Login />} />
            
            <Route path="/admin/*" element={
              <ProtectedRoute roles={['admin', 'red_admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/dispatcher/*" element={
              <ProtectedRoute roles={['admin', 'dispatcher', 'red_admin']}>
                <DispatcherDashboard />
              </ProtectedRoute>
            } />

            <Route path="/admin-logs" element={
              <ProtectedRoute roles={['red_admin']}>
                <LogsPage />
              </ProtectedRoute>
            } />

            <Route path="/notify" element={
              <ProtectedRoute roles={['admin', 'red_admin']}>
                <NotifyPage />
              </ProtectedRoute>
            } />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <PassengerDashboard />
              </ProtectedRoute>
            } />

            <Route path="/routes" element={
              <ProtectedRoute>
                <RoutesPage />
              </ProtectedRoute>
            } />

            <Route path="/stops" element={
              <ProtectedRoute>
                <StopsPage />
              </ProtectedRoute>
            } />

            <Route path="/fleet" element={
              <ProtectedRoute>
                <FleetPage />
              </ProtectedRoute>
            } />

            <Route path="/alerts" element={
              <ProtectedRoute>
                <AlertsPage />
              </ProtectedRoute>
            } />

            <Route path="/contact" element={
              <ProtectedRoute>
                <Contact />
              </ProtectedRoute>
            } />

            <Route path="/reports" element={
              <ProtectedRoute roles={['admin', 'red_admin']}>
                <Reports />
              </ProtectedRoute>
            } />
          </Routes>
        </Layout>
      </Router>
    </AuthProvider>
  );
}
