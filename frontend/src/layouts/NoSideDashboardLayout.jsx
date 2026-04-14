import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { PARTICIPANT_NAV } from "../config/navigation";
import NotificationBell from "../components/NotificationBell";
import HDBLogo from "../components/HDBLogo";
import { GuideToggle } from "../components/GuideTooltip";
import { useAuth } from "../contexts/AuthContext";

export default function NoSidebarDashboardLayout() {
  const { user, roles, loading, logout, switchRole } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const canSwitchRoles =
    import.meta.env.DEV &&
    roles.length > 1 &&
    user?.email === "dev.allroles@healthdatabank.local";

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
          <HDBLogo to="/participant" size="md" />
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
          <GuideToggle />
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
              {user?.first_name?.charAt(0) ?? "?"}
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
                {canSwitchRoles && (
                  <>
                    <div className="border-t border-slate-100 my-1"></div>
                    <div className="px-4 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Dev Role Switch
                      </p>
                      <div className="flex flex-col gap-1">
                        {roles.map((availableRole) => {
                          const active = availableRole === "participant";
                          return (
                            <button
                              key={availableRole}
                              onClick={() => {
                                switchRole(availableRole);
                                setIsProfileMenuOpen(false);
                                navigate(`/${availableRole}`, { replace: true });
                              }}
                              className={`rounded-md px-2.5 py-1.5 text-left text-sm font-medium capitalize transition-colors ${
                                active
                                  ? "bg-blue-50 text-blue-700"
                                  : "text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              {availableRole}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
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
      <div className="flex-1 min-h-0 relative overflow-hidden">
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

        {/* Main Content Area + Footer */}
        <div className="h-full min-h-0 flex flex-col">
          <main className="flex-1 min-h-0 overflow-y-auto p-6">
            <Outlet context={{ user }} />
          </main>
          <footer className="shrink-0 border-t border-slate-200 bg-white px-6 py-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
            <Link to="/feedback/send" className="hover:text-slate-600 transition-colors">Send feedback</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-slate-600 transition-colors">Terms and conditions</Link>
            <span>·</span>
            <span>© 2026 University of Prince Edward Island</span>
          </footer>
        </div>
      </div>
    </div>
  );
}
