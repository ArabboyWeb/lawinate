import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminAuthProvider } from './AdminAuthContext';
import { ToastProvider } from './components/ToastContext';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import AdminLayout from './components/AdminLayout';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminTestsPage from './pages/AdminTestsPage';
import AdminLibraryPage from './pages/AdminLibraryPage';
import AdminUsersPage from './pages/AdminUsersPage';
import AdminCommunityPage from './pages/AdminCommunityPage';
import AdminAiPage from './pages/AdminAiPage';
import AdminSettingsPage from './pages/AdminSettingsPage';

const AdminApp = () => {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/admin/login" element={<AdminLoginPage />} />

          <Route
            path="/admin"
            element={(
              <AdminProtectedRoute>
                <AdminLayout />
              </AdminProtectedRoute>
            )}
          >
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="tests" element={<AdminTestsPage />} />
            <Route path="library" element={<AdminLibraryPage />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="community" element={<AdminCommunityPage />} />
            <Route path="ai" element={<AdminAiPage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Routes>
      </ToastProvider>
    </AdminAuthProvider>
  );
};

export default AdminApp;
