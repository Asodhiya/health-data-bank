function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function pointValue(point, unit) {
  if (point?.value_number != null) {
    const value = Number(point.value_number);
    const display = Number.isInteger(value) ? String(value) : value.toFixed(1);
    return unit ? `${display} ${unit}` : display;
  }
  return point?.value_text || "-";
}

export function generateGoalTrackingPdfReport({ goal, entries = [] }) {
  const sortedEntries = [...(entries || [])].sort((left, right) => {
    if (!left?.observed_at && !right?.observed_at) return 0;
    if (!left?.observed_at) return 1;
    if (!right?.observed_at) return -1;
    return new Date(right.observed_at) - new Date(left.observed_at);
  });

  const name = goal?.name || goal?.element?.label || "Health Goal";
  const unit = goal?.element?.unit || "";
  const target = goal?.target_value != null ? `${goal.target_value}${unit ? ` ${unit}` : ""}` : "Not set";
  const current = goal?.current_value != null
    ? `${goal.current_value}${unit ? ` ${unit}` : ""}`
    : "No entries yet";
  const windowType = goal?.window || goal?.completion_context?.window || "daily";
  const status = goal?.is_completed ? "Target met" : "In progress";

  const rows = sortedEntries.map((entry) => `
    <tr>
      <td>${escapeHtml(fmtDateTime(entry.observed_at))}</td>
      <td>${escapeHtml(pointValue(entry, unit))}</td>
      <td>${escapeHtml(String(entry?.source_type || "goal_tracking").replace(/_/g, " "))}</td>
      <td>${escapeHtml(entry?.notes || "")}</td>
    </tr>
  `).join("");

  const html = `<!doctype html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(name)} Tracking Report</title>
      <style>
        body { font-family: Georgia, "Times New Roman", serif; color: #0f172a; margin: 32px; }
        .header { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; margin-bottom: 24px; }
        .title { font-size: 28px; font-weight: 700; margin: 0; }
        .sub { color: #475569; font-size: 13px; margin-top: 6px; }
        .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin: 20px 0 28px; }
        .card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 14px; background: #f8fafc; }
        .card .label { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; }
        .card .value { margin-top: 6px; font-size: 18px; font-weight: 700; }
        .section { margin-top: 28px; }
        .section h2 { font-size: 16px; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #334155; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border-bottom: 1px solid #e2e8f0; padding: 10px 8px; text-align: left; font-size: 12px; vertical-align: top; }
        th { color: #475569; text-transform: uppercase; letter-spacing: 0.05em; font-size: 10px; }
        .note { color: #475569; font-size: 12px; line-height: 1.5; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px 14px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1 class="title">${escapeHtml(name)} Tracking Report</h1>
          <div class="sub">Generated ${escapeHtml(fmtDateTime(new Date().toISOString()))}</div>
        </div>
      </div>

      <div class="grid">
        <div class="card"><div class="label">Target</div><div class="value">${escapeHtml(target)}</div></div>
        <div class="card"><div class="label">Current</div><div class="value">${escapeHtml(current)}</div></div>
        <div class="card"><div class="label">Window</div><div class="value">${escapeHtml(windowType)}</div></div>
        <div class="card"><div class="label">Status</div><div class="value">${escapeHtml(status)}</div></div>
      </div>

      <div class="note">This report contains the participant's self-tracked goal entries for clinician review. Survey responses are not included in this goal-tracking report.</div>

      <div class="section">
        <h2>Tracking Entries</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Value</th>
              <th>Source</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4">No tracking entries recorded yet.</td></tr>'}
          </tbody>
        </table>
      </div>
    </body>
  </html>`;

  const reportWindow = window.open("", "_blank", "noopener,noreferrer,width=980,height=900");
  if (!reportWindow) return;
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}