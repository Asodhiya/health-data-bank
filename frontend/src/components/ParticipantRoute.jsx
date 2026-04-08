import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ParticipantRoute() {
  const { user, role, loading, maintenance } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (maintenance) return <Navigate to="/maintenance" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'participant') return <Navigate to={`/${role}`} replace />;

  // Redirect to intake if not completed, unless already on an onboarding page
  if (!pathname.startsWith('/onboarding') && user.intake_completed === false) {
    return <Navigate to="/onboarding/background" replace />;
  }

  return <Outlet />;
}
