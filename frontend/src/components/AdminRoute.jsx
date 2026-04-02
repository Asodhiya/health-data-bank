import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute() {
  const { user, role, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'admin') return <Navigate to={`/${role}`} replace />;

  // Onboarding gate: redirect to onboarding if profile not completed.
  // Uses strict === false so existing admins with null (pre-migration) are not blocked.
  if (pathname !== '/admin/onboarding' && user.onboarding_completed === false) {
    return <Navigate to="/admin/onboarding" replace />;
  }

  return <Outlet />;
}
