import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { api } from "../services/api";
import { DASHBOARD_NAV } from "../config/navigation";
import NotificationBell from "../components/NotificationBell";
import { useAuth } from "../contexts/AuthContext";

export default function DashboardLayout({ role }) {
  const { logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    api.me()
      .then((data) => setUser(data))
      .catch((error) => console.error("Not logged in:", error));
  }, []);

  useEffect(() => {
    if (!isProfileMenuOpen) return;

    function handleClickOutside(e) {
      if (!e.target.closest("#profile-dropdown")) {
        setIsProfileMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileMenuOpen]);

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
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
          <Link
            to={`/${role.toLowerCase()}`}
            className="font-bold text-xl text-blue-600 hover:text-blue-700 transition-colors"
          >
            Health Data Bank
          </Link>
        </div>

        {/* Bell + Avatar */}
        <div className="flex items-center gap-3">
          <NotificationBell role={role} />
          <div className="relative" id="profile-dropdown">
            <button
              onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
              className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold transition-colors"
            >
              {user?.first_name?.charAt(0).toUpperCase() ||
                role.charAt(0).toUpperCase()}
            </button>

            {isProfileMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-2 border border-slate-100 z-50">
                <Link
                  to={`/${role.toLowerCase()}/profile`}
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Profile
                </Link>
                <Link
                  to={`/${role.toLowerCase()}/profile#settings`}
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

      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          ></div>
        )}

        {/* Sidebar */}
        <aside
          className={`${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          } fixed top-0 left-0 z-50 h-screen w-64 shadow-xl transition-transform duration-300 ease-in-out md:translate-x-0 md:relative md:z-auto md:shadow-none bg-white border-r border-gray-200 md:flex md:flex-col md:w-64`}
        >
          <nav className="flex-1 p-6 flex flex-col gap-2">
            {/* USER PROFILE CARD */}
            <div className="mb-6 p-4 bg-slate-50 border border-slate-100 rounded-xl shadow-sm">
              <div className="flex flex-col">
                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1">
                  Logged in as
                </p>
                <p className="text-sm font-extrabold text-slate-800 truncate capitalize">
                  {user
                    ? `${user.first_name} ${user.last_name || ""}`
                    : "Loading Profile..."}
                </p>

                {/* Role Badge */}
                <div className="mt-3 inline-flex items-center w-fit px-2 py-0.5 rounded-md bg-white border border-slate-200 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">
                    {role}
                  </p>
                </div>
              </div>
            </div>

            {/* DYNAMIC NAVIGATION GENERATOR */}
            {DASHBOARD_NAV.filter((item) =>
              item.roles.includes(role.toLowerCase()),
            ).map((item) => {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`px-4 py-2 rounded-md text-left font-medium transition-colors ${
                    isActive
                      ? "bg-blue-100 text-blue-600"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-6">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
