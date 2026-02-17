import { Outlet, Link } from "react-router-dom";
import { useState } from "react";

export default function NoSideDashboardLayout({ role }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  return (
    <div className="min-h-screen bg-blue-50/50 font-sans text-slate-900 flex flex-col">
      {/* TOP NAVIGATION BAR */}
      <header className="h-20 bg-white border-b border-blue-100 flex items-center justify-between px-8 shadow-sm">
        {/* Logo Area */}
        <div className="flex items-center gap-2 font-bold text-xl">
          {/* Hamburger Menu (Hidden on desktop) */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden text-slate-500 hover:text-slate-700 p-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>

          {/* Plus Circle Logo */}
          <div className="text-blue-600">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </div>

          {/* App Name */}
          <span className="text-slate-800 whitespace-nowrap">
            Health Data Bank
          </span>
        </div>

        {/* Center Links */}
        <nav className="hidden md:flex gap-6 font-medium text-slate-500">
          <Link
            to="/participant"
            className="bg-blue-100 text-blue-600 px-4 py-2 rounded-md"
          >
            Home
          </Link>
          <Link
            to="/participant/aboutus"
            className="hover:text-slate-800 px-4 py-2"
          >
            About Us
          </Link>
          <Link
            to="/participant/health"
            className="hover:text-slate-800 px-4 py-2"
          >
            My Health
          </Link>
          <Link
            to="/participant/help"
            className="hover:text-slate-800 px-4 py-2"
          >
            Help
          </Link>
        </nav>

        {/* Right Side (Search, Notifications, Profile) */}
        <div className="flex items-center gap-4">
          {/* Search Bar with Icon inside */}
          <div className="relative flex items-center hidden sm:flex">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="absolute left-3 text-slate-400"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search..."
              className="bg-slate-100 border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-200 outline-none"
            />
          </div>

          {/* Notification Bell */}
          <button className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
          </button>

          {/* Profile Button */}
          <button className="flex items-center gap-2 bg-slate-100 px-4 py-2 rounded-full font-medium text-sm text-slate-700 hover:bg-slate-200">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-slate-500"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span className="hidden sm:block">Profile</span>
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          {/* 1. The Dark Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>

          {/* 2. The Slide-Out Drawer */}
          <div className="relative w-64 h-screen bg-white shadow-xl flex flex-col gap-4 p-8">
            <Link
              to="/participant"
              onClick={() => setIsMobileMenuOpen(false)}
              className="bg-blue-100 text-blue-600 px-4 py-2 rounded-md text-left"
            >
              Home
            </Link>
            <Link
              to="/participant/aboutus"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-500 hover:text-slate-800 px-4 py-2 text-left"
            >
              About Us
            </Link>
            <Link
              to="/participant/health"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-500 hover:text-slate-800 px-4 py-2 text-left"
            >
              My Health
            </Link>
            <Link
              to="/participant/help"
              onClick={() => setIsMobileMenuOpen(false)}
              className="text-slate-500 hover:text-slate-800 px-4 py-2 text-left"
            >
              Help
            </Link>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
