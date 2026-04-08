import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AuthLayout() {
  const { user, role, loading } = useAuth();
  if (loading) return null;
  if (user && role) return <Navigate to={`/${role}`} replace />;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Brand */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-blue-800 tracking-tight mb-6 text-center">
          Health Data Bank
        </h1>

        {/* Card */}
        <div className="w-full bg-white/80 backdrop-blur-sm rounded-2xl shadow-sm border border-slate-200/60 p-8 sm:p-10">
          <Outlet />
        </div>

        {/* Footer */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
          <a href="#" className="hover:text-slate-500 transition-colors">Terms &amp; Conditions</a>
          <span>|</span>
          <a href="#" className="hover:text-slate-500 transition-colors">About Us</a>
          <span>|</span>
          <a href="#" className="hover:text-slate-500 transition-colors">Copyright</a>
        </div>
      </div>
    </div>
  );
}
