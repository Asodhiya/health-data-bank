import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ResearcherRoute({ allowOnboarding = false }) {
  const { user, role, loading, maintenance } = useAuth();

  if (loading) return null;
  if (maintenance) return <Navigate to="/maintenance" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'researcher') return <Navigate to={`/${role}`} replace />;
  if (!allowOnboarding && user.onboarding_completed === false) return <Navigate to="/researcher/onboarding" replace />;

  return <Outlet />;
}
