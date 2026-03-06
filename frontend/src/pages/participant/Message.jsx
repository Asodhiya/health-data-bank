export default function Messages() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Notifications
          </h1>
          <p className="text-slate-500 mt-1">
            Manage your daily alerts, reminders, and messages.
          </p>
        </div>
        <button className="text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors">
          Mark all as read
        </button>
      </div>

      {/* Notifications List Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Unread Notification (Notice the blue background and red dot) */}
        <div className="p-5 border-b border-slate-100 bg-blue-50/50 hover:bg-blue-50 transition-colors flex gap-4 items-start cursor-pointer">
          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1.5 flex-shrink-0"></div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-800">
              Time for your daily survey!
            </h3>
            <p className="text-slate-600 text-sm mt-1">
              Please take 2 minutes to log your morning mood and sleep metrics.
            </p>
            <span className="text-xs font-medium text-blue-500 mt-2 block">
              2 hours ago
            </span>
          </div>
        </div>

        {/* Read Notification (White background, no dot) */}
        <div className="p-5 border-b border-slate-100 hover:bg-slate-50 transition-colors flex gap-4 items-start cursor-pointer">
          <div className="w-2.5 h-2.5 rounded-full bg-transparent mt-1.5 flex-shrink-0"></div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-700">
              You hit your water goal! 💧
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              Great job staying hydrated today. Keep up the 12-day streak!
            </p>
            <span className="text-xs font-medium text-slate-400 mt-2 block">
              Yesterday at 4:30 PM
            </span>
          </div>
        </div>

        {/* Read Notification - System Alert */}
        <div className="p-5 hover:bg-slate-50 transition-colors flex gap-4 items-start cursor-pointer">
          <div className="w-2.5 h-2.5 rounded-full bg-transparent mt-1.5 flex-shrink-0"></div>
          <div className="flex-1">
            <h3 className="font-medium text-slate-700">
              New Caretaker Assigned
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              Dr. Smith has been added as a caretaker to your account and can
              now review your check-ins.
            </p>
            <span className="text-xs font-medium text-slate-400 mt-2 block">
              Monday at 9:00 AM
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
