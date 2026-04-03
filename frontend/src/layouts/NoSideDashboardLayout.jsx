import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "../services/api";
import { PARTICIPANT_NAV } from "../config/navigation";
import NotificationBell from "../components/NotificationBell";
import { useAuth } from "../contexts/AuthContext";

export default function NoSidebarDashboardLayout() {
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then((data) => {
        setUser({
          firstName: data.first_name,
          lastName: data.last_name,
        });
      })
      .catch((error) => {
        console.error("Error fetching user:", error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // BUG 12 fix: close profile dropdown on outside click
  useEffect(() => {
    if (!isProfileMenuOpen) return;

    function handleClickOutside(e) {
      if (!e.target.closest("#participant-profile-dropdown")) {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileMenuOpen]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-xl font-semibold animate-pulse text-blue-600">
          Loading Health Data Bank...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      {/* --- HEADER --- */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-20 relative">
        {/* LEFT: Logo & Mobile Toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-slate-500 hover:text-slate-800"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          {/* Logo is clickable that redirects to dashboard */}
          <Link
            to="/participant"
            className="font-bold text-xl text-blue-600 hover:text-blue-700 transition-colors"
          >
            Health Data Bank
          </Link>
        </div>

        {/* CENTER: Desktop Navigation (Hidden on Mobile) */}
        <nav className="hidden md:flex items-center gap-6">
          {PARTICIPANT_NAV.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        {/* RIGHT: Notifications & Profile Settings */}
        <div className="flex items-center gap-4 relative">
          <NotificationBell role="participant" />

          {/* Profile Dropdown Container */}
          <div className="relative" id="participant-profile-dropdown">
            {/* The Avatar Button */}
            <button
              onClick={() => {
                setIsProfileMenuOpen(!isProfileMenuOpen);
              }}
              className="w-8 h-8 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center font-bold transition-colors"
            >
              {user?.firstName?.charAt(0) ?? '?'}
            </button>

            {/* The Profile Dropdown Menu */}
            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 border border-slate-100 z-50">
                <Link
                  to="/participant/profile"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Profile
                </Link>
                <Link
                  to="/participant/profile"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Settings
                </Link>
                <div className="border-t border-slate-100 my-1"></div>
                <button
                  onClick={async () => {
                    setIsProfileMenuOpen(false);
                    await logout();
                    navigate("/login", { replace: true });
                  }}
                  className="block w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-slate-50"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* --- BODY --- */}
      <div className="flex-1 relative overflow-hidden">
        {/* Mobile Backdrop */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
        )}

        {/* Mobile Drawer Navigation */}
        <aside
          className={`${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          } fixed top-0 left-0 z-40 h-screen w-64 bg-white shadow-xl transition-transform duration-300 ease-in-out md:hidden pt-20`}
        >
          <nav className="flex flex-col p-6 gap-2">
            {PARTICIPANT_NAV.map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-md text-left font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="h-full overflow-y-auto p-6">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
