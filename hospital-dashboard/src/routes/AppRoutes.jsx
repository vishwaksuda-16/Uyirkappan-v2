import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLayout from '../components/layout/AppLayout';
import LoginPage from '../pages/Login/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import EmergencyDetailsPage from '../pages/EmergencyDetails/EmergencyDetailsPage';
import ResourcesPage from '../pages/Resources/ResourcesPage';
import HistoryPage from '../pages/History/HistoryPage';
import NotFoundPage from '../pages/NotFound/NotFoundPage';

export function AppRoutes() {
  return (
    <Routes>
      {/* Public Authentication Route */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Hospital Operations Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="emergency/:requestId" element={<EmergencyDetailsPage />} />
        <Route path="emergencies/:requestId" element={<EmergencyDetailsPage />} />
        <Route path="resources" element={<ResourcesPage />} />
        <Route path="history" element={<HistoryPage />} />
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default AppRoutes;
