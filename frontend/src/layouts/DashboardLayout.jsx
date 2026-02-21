import { Outlet, Link, useLocation } from "react-router-dom";
import { useState } from "react";
import { DASHBOARD_NAV } from "../config/navigation"; // Make sure this path is correct!

export default function DashboardLayout({ role }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation(); // Hooks into the current URL

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top Header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
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
          <div className="font-bold text-xl text-blue-600">
            Health Data Bank
          </div>
        </div>

        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
          {role.charAt(0).toUpperCase()}
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
            isSidebarOpen
              ? "fixed top-0 left-0 z-50 h-screen shadow-xl"
              : "hidden"
          } bg-white border-r border-gray-200 md:flex md:flex-col md:w-64`}
        >
          <nav className="flex-1 p-6 flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-400 mb-4 border-b pb-4 uppercase tracking-wider">
              Role: {role}
            </p>

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
          <Outlet />
        </main>
      </div>
    </div>
  );
}
