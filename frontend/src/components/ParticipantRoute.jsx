import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ParticipantRoute() {
  const { user, role, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (role !== 'participant') return <Navigate to={`/${role}`} replace />;

  return <Outlet />;
}