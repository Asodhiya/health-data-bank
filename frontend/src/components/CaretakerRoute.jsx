import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function CaretakerRoute() {
  const { user, role, loading } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'caretaker') return <Navigate to={`/${role}`} replace />;

  // Redirect to onboarding if not completed, unless already on the onboarding page
  if (pathname !== '/caretaker/onboarding' && user.onboarding_completed === false) {
    return <Navigate to="/caretaker/onboarding" replace />;
  }

  return <Outlet />;
}