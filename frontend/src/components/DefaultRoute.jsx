import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function DefaultRoute() {
  const { user, role, loading, maintenance } = useAuth();

  if (loading) return null;
  if (maintenance) return <Navigate to="/maintenance" replace />;
  if (!user) return <Navigate to="/login" replace />;
  if (!role) return <Navigate to="/login" replace />;

  return <Navigate to={`/${role}`} replace />;
}
