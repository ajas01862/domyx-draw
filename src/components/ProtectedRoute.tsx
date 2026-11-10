import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="route-loading"><span className="spinner" /> Checking session</div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
export function AdminRoute() {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="route-loading"><span className="spinner" /> Checking permissions</div>;
  if (!user) return <Navigate to="/login" replace />;
  return profile?.is_admin ? <Outlet /> : <Navigate to="/dashboard" replace />;
}
