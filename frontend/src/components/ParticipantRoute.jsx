import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ParticipantRoute() {
  const { user, role, loading, maintenance } = useAuth();
  const { pathname } = useLocation();

  if (loading) return null;
  if (maintenance) return <Navigate to="/maintenance" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'participant') return <Navigate to={`/${role}`} replace />;

  // Redirect to the appropriate onboarding step if intake not completed
  if (!pathname.startsWith('/onboarding') && user.intake_completed === false) {
    const dest =
      user.onboarding_status === 'CONSENT_GIVEN' ? '/onboarding/intake'
      : user.onboarding_status === 'BACKGROUND_READ' ? '/onboarding/consent'
      : '/onboarding/background';
    return <Navigate to={dest} replace />;
  }

  return <Outlet />;
}
