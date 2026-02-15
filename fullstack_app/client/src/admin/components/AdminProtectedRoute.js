import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AdminAuthContext } from '../AdminAuthContext';

const AdminProtectedRoute = ({ children }) => {
  const { admin, loading } = useContext(AdminAuthContext);
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Yuklanmoqda...
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
};

export default AdminProtectedRoute;
