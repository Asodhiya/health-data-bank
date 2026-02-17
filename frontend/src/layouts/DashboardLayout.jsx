import { Outlet } from "react-router-dom";

export default function DashboardLayout({ role }) {
  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900">
      {/* Top header */}
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm z-10">
        {/* LEFT: App name  + hamburger menu for small screens*/}
        <div className="flex items-center gap-4">
          <button className="md:hidden">☰</button>
          <div className="font-bold text-xl">Health Data Bank</div>
        </div>

        {/* RIGHT: User avatar */}
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
          U
        </div>
      </header>

      {/*(sidebar + Main Content) */}
      <div className="flex-1 flex overflow-y-auto">
        <aside className="hidden bg-[#add5f7] text-white md:flex md:flex-col md:w-64">
          <nav className="flex-1 p-4">
            <p className="text-sm text-yellow-400 mb-4">Logged in as: {role}</p>
            <p className="text-sm text-slate-400 mb-2">Dashboard</p>

            {role.toLowerCase() === "admin" && (
              <p className="text-sm text-slate-400">System Settings</p>
            )}
          </nav>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-6">
          {/* This is the portal where specific pages will load */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
