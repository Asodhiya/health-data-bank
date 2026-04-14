export default function FlagBadge({ text }) {
  const isCritical = text.toLowerCase().includes("high");
  const isWarning = text.toLowerCase().includes("inactive") || text.toLowerCase().includes("no ");
  const colors = isCritical
    ? "bg-rose-50 text-rose-700 border-rose-100"
    : isWarning
      ? "bg-amber-50 text-amber-700 border-amber-100"
      : "bg-slate-50 text-slate-600 border-slate-100";
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${colors}`}>{text}</span>;
}
