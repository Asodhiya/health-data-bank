import NotificationsPanel from "../../components/NotificationsPanel";

export default function Messages() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
          Notifications
        </h1>
        <p className="text-slate-500 mt-1">
          Manage your daily alerts, reminders, and messages.
        </p>
      </div>

      <NotificationsPanel role="participant" />
    </div>
  );
}
