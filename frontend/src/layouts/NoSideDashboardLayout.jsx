import { Outlet, Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import api from "../utils/axiosInstance";
import { PARTICIPANT_NAV } from "../config/navigation";

export default function NoSidebarDashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const role = "Participant"; // Hardcoded since this layout is exclusive to them
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isNotificationMenuOpen, setIsNotificationMenuOpen] = useState(false);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 2. Make the API call
    api
      .get("/auth/me")
      .then((response) => {
        setUser({
          firstName: response.data.first_name,
          lastName: response.data.last_name,
        });
      })
      .catch((error) => {
        console.error("Error fetching user:", error);
      })
      .finally(() => {
        // 3. This ALWAYS runs, success or failure
        setLoading(false);
      });
  }, []);

  // 4. The "Safety Shield" - If loading, show a nice message instead of the app
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <p className="text-xl font-semibold animate-pulse text-blue-600">
          Loading Health Data Bank... 🩺
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
          {/* __ Logo is clickable that redirects to dashboard */}
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
          {/* 1. Notifications Dropdown Container */}
          <div className="relative">
            {/* The Bell Button */}
            <button
              onClick={() => {
                setIsNotificationMenuOpen(!isNotificationMenuOpen);
                setIsProfileMenuOpen(false); // Close profile if open
              }}
              className="relative w-8 h-8 rounded-full bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-blue-600 flex items-center justify-center transition-colors"
            >
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-rose-500 rounded-full border-2 border-white"></span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="w-5 h-5"
              >
                <path
                  fillRule="evenodd"
                  d="M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.244.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* The Notifications Dropdown Menu */}
            {isNotificationMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-slate-100 z-50 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800">Notifications</h3>
                  <span className="text-xs bg-rose-100 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                    2 New
                  </span>
                </div>

                {/* Notification List */}
                <div className="max-h-80 overflow-y-auto">
                  <div className="px-4 py-3 hover:bg-slate-50 border-b border-slate-50 cursor-pointer transition-colors">
                    <p className="text-sm text-slate-800 font-medium">
                      Time for your daily survey!
                    </p>
                    <p className="text-xs text-slate-500 mt-1">2 hours ago</p>
                  </div>
                  <div className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors">
                    <p className="text-sm text-slate-800 font-medium">
                      You hit your water goal! 💧
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Yesterday</p>
                  </div>
                </div>

                {/* Footer Link to Full Page */}
                <div className="border-t border-slate-100">
                  <Link
                    to="/participant/messages"
                    onClick={() => setIsNotificationMenuOpen(false)}
                    className="block text-center px-4 py-3 text-sm text-blue-600 hover:text-blue-700 font-bold hover:bg-slate-50 transition-colors"
                  >
                    View all notifications
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* 2. Profile Dropdown Container */}
          <div className="relative">
            {/* The Avatar Button */}
            <button
              onClick={() => {
                setIsProfileMenuOpen(!isProfileMenuOpen);
                setIsNotificationMenuOpen(false); // Close notifications if open
              }}
              className="w-8 h-8 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center font-bold transition-colors"
            >
              {user.firstName.charAt(0)}
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
                <Link
                  to="/logout"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="block px-4 py-2 text-sm text-rose-600 hover:bg-slate-50"
                >
                  Logout
                </Link>
              </div>
            )}
          </div>
        </div>
        {/* RIGHT: Profile Settings Menu */}
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
