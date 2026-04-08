/**
 * Health Summary Report — client-side export utilities
 *
 * generatePDFReport()  — opens a styled printable page; user clicks "Save as PDF"
 * generateCSVReport()  — triggers a .csv file download
 */

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(val, decimals = 1) {
  if (val == null || !Number.isFinite(Number(val))) return "—";
  return Number(val).toFixed(decimals);
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function trendLabel(vals) {
  if (!vals || vals.length < 2) return "—";
  const mid = Math.floor(vals.length / 2);
  const first = vals.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const second = vals.slice(mid).reduce((a, b) => a + b, 0) / (vals.length - mid);
  if (first === 0) return "Stable";
  const pct = ((second - first) / first) * 100;
  if (pct > 2) return `↑ ${Math.abs(pct).toFixed(1)}% up`;
  if (pct < -2) return `↓ ${Math.abs(pct).toFixed(1)}% down`;
  return "→ Stable";
}

function goalProgressLabel(goal) {
  const current = goal.current_value ?? 0;
  const target = goal.target_value ?? 1;
  const direction = goal.completion_context?.direction || goal.direction || "at_least";
  const pct = direction === "at_most"
    ? current > 0 ? Math.min(100, Math.round((target / current) * 100)) : 0
    : Math.min(100, Math.round((current / target) * 100));
  return `${pct}%`;
}

function goalWindow(goal) {
  const w = goal.completion_context?.window || goal.window || "daily";
  return { daily: "Daily", weekly: "Weekly", monthly: "Monthly" }[w] ?? w;
}

// ── PDF (print-based) ──────────────────────────────────────────────────────

export function generatePDFReport({ user, elements, timeseries, goals, vsGroup }) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Participant";
  const generatedAt = new Date().toLocaleString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  // Build timeseries map for trend calculation
  const tsMap = {};
  (timeseries || []).forEach((ts) => { tsMap[ts.element_id] = ts.points || []; });

  const goalsCompleted = (goals || []).filter((g) => g.is_completed).length;
  const totalReadings = (elements || []).reduce((s, e) => s + (e.count ?? 0), 0);

  // Earliest observed date across all timeseries
  const allDates = Object.values(tsMap)
    .flat()
    .map((p) => p.observed_at && new Date(p.observed_at))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const periodStart = allDates.length ? fmtDate(allDates[0]) : "—";
  const periodEnd = allDates.length ? fmtDate(allDates[allDates.length - 1]) : "—";

  // ── Metrics rows ─────────────────────────────────────────────────────────
  const metricsRows = (elements || [])
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .map((el) => {
      const pts = (tsMap[el.element_id] || [])
        .map((p) => p.value_number)
        .filter((v) => v != null && Number.isFinite(v));
      const trend = trendLabel(pts);
      const trendCls = trend.startsWith("↑") ? "trend-up" : trend.startsWith("↓") ? "trend-down" : "trend-flat";
      return `
        <tr>
          <td>${el.label}</td>
          <td class="center">${el.unit || "—"}</td>
          <td class="center num">${fmt(el.avg)}</td>
          <td class="center num">${fmt(el.min)}</td>
          <td class="center num">${fmt(el.max)}</td>
          <td class="center num">${el.count ?? "—"}</td>
          <td class="center"><span class="${trendCls}">${trend}</span></td>
        </tr>`;
    }).join("");

  // ── Goals rows ────────────────────────────────────────────────────────────
  const goalsRows = (goals || [])
    .slice()
    .sort((a, b) => {
      if (a.is_completed && !b.is_completed) return 1;
      if (!a.is_completed && b.is_completed) return -1;
      return (a.name ?? "").localeCompare(b.name ?? "");
    })
    .map((g) => {
      const name = g.name ?? g.element?.label ?? "—";
      const unit = g.element?.unit || "";
      const current = fmt(g.current_value ?? 0, 0);
      const target = fmt(g.target_value ?? 0, 0);
      const progress = goalProgressLabel(g);
      const window = goalWindow(g);
      const status = g.is_completed
        ? '<span class="badge-done">Completed</span>'
        : '<span class="badge-progress">In Progress</span>';
      const pctNum = parseInt(progress);
      return `
        <tr>
          <td>${name}</td>
          <td class="center">${unit || "—"}</td>
          <td class="center num">${current}</td>
          <td class="center num">${target}</td>
          <td class="center">
            <div class="progress-wrap">
              <div class="progress-bar" style="width:${Math.min(pctNum,100)}%"></div>
              <span class="progress-label">${progress}</span>
            </div>
          </td>
          <td class="center">${window}</td>
          <td class="center">${status}</td>
        </tr>`;
    }).join("");

  // ── Recent entries table ───────────────────────────────────────────────────
  const recentEntries = Object.entries(tsMap)
    .flatMap(([elId, pts]) => {
      const el = (elements || []).find((e) => e.element_id === elId);
      return pts.map((p) => ({ ...p, label: el?.label ?? elId, unit: el?.unit ?? "" }));
    })
    .filter((p) => p.value_number != null && p.observed_at)
    .sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))
    .slice(0, 30);

  const entriesRows = recentEntries.map((p) => `
    <tr>
      <td>${fmtDateTime(p.observed_at)}</td>
      <td>${p.label}</td>
      <td class="center num">${fmt(p.value_number)}</td>
      <td class="center">${p.unit || "—"}</td>
      <td>${p.notes || "—"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Health Summary — ${name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 11px;
      color: #1e293b;
      background: white;
      padding: 0;
    }

    /* ── Cover header ── */
    .cover {
      background: linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%);
      color: white;
      padding: 36px 48px 28px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .cover-left h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .cover-left .subtitle { font-size: 12px; opacity: 0.8; margin-top: 4px; }
    .cover-right { text-align: right; }
    .cover-right .participant-name { font-size: 16px; font-weight: 700; }
    .cover-right .meta { font-size: 10px; opacity: 0.75; margin-top: 3px; line-height: 1.6; }

    /* ── Summary bar ── */
    .summary-bar {
      display: flex;
      gap: 0;
      border-bottom: 1px solid #e2e8f0;
      background: #f8fafc;
    }
    .summary-tile {
      flex: 1;
      padding: 14px 20px;
      border-right: 1px solid #e2e8f0;
    }
    .summary-tile:last-child { border-right: none; }
    .summary-tile .tile-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; }
    .summary-tile .tile-value { font-size: 20px; font-weight: 800; color: #1e293b; margin-top: 2px; }
    .summary-tile .tile-sub { font-size: 9px; color: #94a3b8; margin-top: 1px; }

    /* ── Body ── */
    .body { padding: 28px 48px; }

    /* ── Section ── */
    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 10px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title::before {
      content: "";
      display: inline-block;
      width: 3px;
      height: 14px;
      background: #3b82f6;
      border-radius: 2px;
    }

    /* ── Tables ── */
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
    }
    thead tr { background: #f1f5f9; }
    thead th {
      padding: 7px 10px;
      text-align: left;
      font-weight: 700;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #475569;
      border-bottom: 1px solid #cbd5e1;
    }
    thead th.center { text-align: center; }
    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:last-child { border-bottom: none; }
    tbody tr:hover { background: #f8fafc; }
    td { padding: 7px 10px; color: #334155; vertical-align: middle; }
    td.center { text-align: center; }
    td.num { font-weight: 600; font-variant-numeric: tabular-nums; }

    /* ── Trend badges ── */
    .trend-up { color: #16a34a; font-weight: 700; }
    .trend-down { color: #d97706; font-weight: 700; }
    .trend-flat { color: #64748b; }

    /* ── Goal badges ── */
    .badge-done {
      display: inline-block;
      background: #dcfce7;
      color: #166534;
      font-weight: 700;
      font-size: 9px;
      padding: 2px 8px;
      border-radius: 999px;
    }
    .badge-progress {
      display: inline-block;
      background: #dbeafe;
      color: #1d4ed8;
      font-weight: 700;
      font-size: 9px;
      padding: 2px 8px;
      border-radius: 999px;
    }

    /* ── Progress bar ── */
    .progress-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 90px;
    }
    .progress-bar-bg {
      flex: 1;
      height: 5px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
    }
    .progress-bar {
      height: 5px;
      background: #3b82f6;
      border-radius: 3px;
    }
    .progress-label { font-size: 9px; font-weight: 700; color: #475569; white-space: nowrap; }

    /* ── Footer ── */
    .footer {
      margin-top: 36px;
      padding: 16px 48px;
      border-top: 1px solid #e2e8f0;
      background: #f8fafc;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9px;
      color: #94a3b8;
    }
    .footer strong { color: #64748b; }

    /* ── Print ── */
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cover { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .section { page-break-inside: avoid; }
    }

    /* ── Print button (hidden on print) ── */
    .print-bar {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 48px;
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
    }
    .print-btn {
      background: #1d4ed8;
      color: white;
      border: none;
      padding: 8px 20px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    .print-btn:hover { background: #1e40af; }
    .close-btn {
      background: white;
      color: #475569;
      border: 1px solid #cbd5e1;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
  </style>
</head>
<body>

  <!-- Action bar -->
  <div class="print-bar no-print">
    <button class="close-btn" onclick="window.close()">✕ Close</button>
    <button class="print-btn" onclick="window.print()">⬇ Save as PDF / Print</button>
  </div>

  <!-- Cover header -->
  <div class="cover">
    <div class="cover-left">
      <h1>Health Summary Report</h1>
      <div class="subtitle">Personal health data overview · Health Data Bank</div>
    </div>
    <div class="cover-right">
      <div class="participant-name">${name}</div>
      <div class="meta">
        Generated: ${generatedAt}<br/>
        Period: ${periodStart} — ${periodEnd}
      </div>
    </div>
  </div>

  <!-- Summary tiles -->
  <div class="summary-bar">
    <div class="summary-tile">
      <div class="tile-label">Metrics Tracked</div>
      <div class="tile-value">${(elements || []).length}</div>
      <div class="tile-sub">health data elements</div>
    </div>
    <div class="summary-tile">
      <div class="tile-label">Total Readings</div>
      <div class="tile-value">${totalReadings.toLocaleString()}</div>
      <div class="tile-sub">data points recorded</div>
    </div>
    <div class="summary-tile">
      <div class="tile-label">Goals</div>
      <div class="tile-value">${goalsCompleted} / ${(goals || []).length}</div>
      <div class="tile-sub">completed</div>
    </div>
    <div class="summary-tile">
      <div class="tile-label">Report Period</div>
      <div class="tile-value" style="font-size:13px">${periodStart}</div>
      <div class="tile-sub">to ${periodEnd}</div>
    </div>
  </div>

  <div class="body">

    <!-- Health Metrics -->
    ${(elements || []).length > 0 ? `
    <div class="section">
      <div class="section-title">Health Metrics</div>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th class="center">Unit</th>
            <th class="center">Average</th>
            <th class="center">Lowest</th>
            <th class="center">Highest</th>
            <th class="center">Readings</th>
            <th class="center">Trend</th>
          </tr>
        </thead>
        <tbody>${metricsRows}</tbody>
      </table>
    </div>` : ""}

    <!-- Goals -->
    ${(goals || []).length > 0 ? `
    <div class="section">
      <div class="section-title">Health Goals</div>
      <table>
        <thead>
          <tr>
            <th>Goal</th>
            <th class="center">Unit</th>
            <th class="center">Current</th>
            <th class="center">Target</th>
            <th class="center">Progress</th>
            <th class="center">Window</th>
            <th class="center">Status</th>
          </tr>
        </thead>
        <tbody>${goalsRows}</tbody>
      </table>
    </div>` : ""}

    <!-- Recent Readings -->
    ${recentEntries.length > 0 ? `
    <div class="section">
      <div class="section-title">Recent Readings <span style="font-weight:400;text-transform:none;letter-spacing:0;color:#94a3b8;font-size:9px">(last 30 entries)</span></div>
      <table>
        <thead>
          <tr>
            <th>Date &amp; Time</th>
            <th>Metric</th>
            <th class="center">Value</th>
            <th class="center">Unit</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>${entriesRows}</tbody>
      </table>
    </div>` : ""}

  </div>

  <!-- Footer -->
  <div class="footer">
    <span><strong>Health Data Bank</strong> · Confidential health report for ${name}</span>
    <span>Generated ${generatedAt}</span>
  </div>

</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) {
    alert("Pop-up blocked. Please allow pop-ups for this site and try again.");
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ── CSV ────────────────────────────────────────────────────────────────────

export function generateCSVReport({ user, elements, timeseries, goals }) {
  const name = [user?.first_name, user?.last_name].filter(Boolean).join(" ") || user?.username || "Participant";
  const generatedAt = new Date().toISOString();

  const tsMap = {};
  (timeseries || []).forEach((ts) => { tsMap[ts.element_id] = ts.points || []; });

  const lines = [];

  // Header info
  lines.push(["Health Summary Report"]);
  lines.push(["Participant", name]);
  lines.push(["Email", user?.email || "—"]);
  lines.push(["Generated", generatedAt]);
  lines.push([]);

  // Metrics section
  lines.push(["HEALTH METRICS"]);
  lines.push(["Metric", "Unit", "Average", "Lowest", "Highest", "Readings", "Trend"]);
  (elements || [])
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label))
    .forEach((el) => {
      const pts = (tsMap[el.element_id] || [])
        .map((p) => p.value_number)
        .filter((v) => v != null && Number.isFinite(v));
      lines.push([
        el.label,
        el.unit || "",
        fmt(el.avg),
        fmt(el.min),
        fmt(el.max),
        el.count ?? "",
        trendLabel(pts),
      ]);
    });
  lines.push([]);

  // Goals section
  if ((goals || []).length > 0) {
    lines.push(["HEALTH GOALS"]);
    lines.push(["Goal", "Unit", "Current", "Target", "Progress", "Window", "Status"]);
    goals
      .slice()
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""))
      .forEach((g) => {
        lines.push([
          g.name ?? g.element?.label ?? "",
          g.element?.unit || "",
          fmt(g.current_value ?? 0, 0),
          fmt(g.target_value ?? 0, 0),
          goalProgressLabel(g),
          goalWindow(g),
          g.is_completed ? "Completed" : "In Progress",
        ]);
      });
    lines.push([]);
  }

  // Readings section
  const entries = Object.entries(tsMap)
    .flatMap(([elId, pts]) => {
      const el = (elements || []).find((e) => e.element_id === elId);
      return pts.map((p) => ({ ...p, label: el?.label ?? elId, unit: el?.unit ?? "" }));
    })
    .filter((p) => p.value_number != null && p.observed_at)
    .sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at));

  if (entries.length > 0) {
    lines.push(["ALL READINGS"]);
    lines.push(["Date & Time", "Metric", "Value", "Unit", "Notes"]);
    entries.forEach((p) => {
      lines.push([
        fmtDateTime(p.observed_at),
        p.label,
        fmt(p.value_number),
        p.unit,
        p.notes || "",
      ]);
    });
  }

  // Escape CSV cells
  const csv = lines
    .map((row) =>
      row.map((cell) => {
        const s = String(cell ?? "");
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      }).join(",")
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `health-summary-${name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
