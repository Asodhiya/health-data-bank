import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { PARTICIPANT_NAV } from "../config/navigation";

export default function NoSidebarDashboardLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const role = "Participant"; // Hardcoded since this layout is exclusive to them

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
          <div className="font-bold text-xl text-blue-600">
            Health Data Bank
          </div>
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

        {/* RIGHT: User Avatar */}
        <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold">
          P
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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
