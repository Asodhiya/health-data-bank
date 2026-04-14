// Shared date formatting helpers used across participant pages.
// Keep formats stable — changes affect feedback, goals, and health summary displays.

export function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

// "Mar 5, 2026, 02:30 PM" — full timestamp for feedback list items + researcher value cells.
// Returns null for nullish input and the raw string for unparsable values.
export const formatDateTime = (iso) => {
  if (iso == null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// "Mar 5" — compact month+day, used in charts and entry stamps
export const fmtShortDate = (d) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

// "Mon" — 3-letter weekday, used as chart axis labels
export const fmtShortDay = (d) =>
  d.toLocaleDateString("en-US", { weekday: "short" });

// "2:30 PM" — time of day only
export const fmtTime = (d) =>
  d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

// Today → "2:30 PM"; other days → "Mar 5 2:30 PM"
export function fmtEntryStamp(isoStr) {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (isSameDay(d, new Date())) return fmtTime(d);
  return `${fmtShortDate(d)} ${fmtTime(d)}`;
}

// Array of the last N Date objects, oldest first, including today.
export function getLastNDays(n) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i));
    return d;
  });
}

// "Jan 5, 2026" — short date for tables and lists (null-safe).
export function fmt(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

// "Today" / "Yesterday" / "3d ago" — relative time label (null-safe).
export function daysSince(d) {
  if (!d) return null;
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return `${diff}d ago`;
}

// Age in years from date-of-birth string (null-safe).
export function getAge(dob) {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

// Percentage helper — returns 0 when total is 0.
export function pct(val, total) {
  return total > 0 ? (val / total) * 100 : 0;
}

// "3d left" / "Expired" / "Today" / "Tomorrow" — countdown label (null-safe).
export function daysUntil(d) {
  if (!d) return "";
  const diff = Math.floor((new Date(d).getTime() - Date.now()) / 86400000);
  if (diff < 0) return "Expired";
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  return `${diff}d left`;
}
