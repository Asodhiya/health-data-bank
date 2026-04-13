import { useState, useEffect, useRef, useCallback } from "react";
import { usePolling } from "../../hooks/usePolling";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { generatePDFReport, generateCSVReport } from "../../utils/healthReportExport";
import GuideTooltip from "../../components/GuideTooltip";

// ── Helpers ────────────────────────────────────────────────────────────────

function isCaretakerMessageElement(item) {
  const haystack = [item?.code, item?.label, item?.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!haystack.includes("caretaker")) return false;
  return ["note", "notes", "message", "messages"].some((token) => haystack.includes(token));
}



// ── SVG icons ──────────────────────────────────────────────────────────────

const Icon = ({ d, size = 16, sw = 1.8 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={sw}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {typeof d === "string" ? <path d={d} /> : d}
  </svg>
);

const IcoOverview = () => (
  <Icon
    size={15}
    d={
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    }
  />
);

const IcoCompare = () => (
  <Icon
    size={15}
    d={
      <>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </>
    }
  />
);

// ── Skeleton ───────────────────────────────────────────────────────────────

const Skeleton = ({ className = "" }) => (
  <div className={`bg-slate-100 rounded-2xl animate-pulse ${className}`} />
);

// ── Tabs config ────────────────────────────────────────────────────────────

const PILLS_INITIAL = 10;

function TabButton({ id, activeTab, onClick, icon, label, badge }) {
  const active = activeTab === id;
  return (
    <button
      onClick={() => onClick(id)}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
        active
          ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-200"
          : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-700 hover:shadow-sm"
      }`}
    >
      {icon}
      {label}
      {badge != null && (
        <span
          className={`ml-0.5 text-xs font-bold ${active ? "text-blue-200" : "text-slate-400"}`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function ParticipantHealthSummary() {
  const { user } = useAuth();
  const [tab, setTab] = useState("overview");
  const [elements, setElements] = useState([]);
  const [timeseries, setTimeseries] = useState([]);
  const [goals, setGoals] = useState([]);
  const [vsGroup, setVsGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [selectedExportElementIds, setSelectedExportElementIds] = useState([]);

  const exportArgs = {
    user,
    elements,
    timeseries,
    goals,
    vsGroup,
    selectedElementIds: selectedExportElementIds,
  };

  const handlePDF = () => {
    generatePDFReport(exportArgs);
    setExportOpen(false);
  };

  const handleCSV = () => {
    generateCSVReport(exportArgs);
    setExportOpen(false);
  };

  useEffect(() => {
    setSelectedExportElementIds((prev) => {
      const availableIds = (elements || []).map((element) => String(element.element_id));
      if (availableIds.length === 0) return [];
      const prevSet = new Set((prev || []).map(String));
      const kept = availableIds.filter((id) => prevSet.has(id));
      return kept.length > 0 ? kept : availableIds;
    });
  }, [elements]);

  const load = useCallback(async ({ background = false } = {}) => {
    try {
      if (!background) setLoading(true);
      const [elementsData, goalsData, vsGroupData, timeseriesData] = await Promise.all([
        api.getMyElementsData(),
        api.listParticipantGoals().catch(() => []),
        api.getMyVsGroupStats().catch(() => null),
        api.getMyHealthTimeseries().catch(() => []),
      ]);
      const filteredElements = (elementsData || []).filter((element) => !isCaretakerMessageElement(element));
      const filteredTimeseries = (timeseriesData || []).filter((series) => !isCaretakerMessageElement(series));
      const filteredVsGroup = vsGroupData
        ? {
            ...vsGroupData,
            elements: Array.isArray(vsGroupData.elements)
              ? vsGroupData.elements.filter((element) => !isCaretakerMessageElement(element))
              : [],
          }
        : vsGroupData;

      setElements(filteredElements);
      setGoals(Array.isArray(goalsData) ? goalsData : []);
      setVsGroup(filteredVsGroup);
      setTimeseries(filteredTimeseries);
      if (filteredVsGroup?.elements?.length) {
        setSelectedElement(filteredVsGroup.elements[0].element_id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(load, 60_000);

  const totalDataPoints = elements.reduce((s, e) => s + (e.count ?? 0), 0);
  const vsElements = vsGroup?.elements ?? [];
  const activeSelected = vsElements.find(
    (e) => e.element_id === selectedElement,
  );
  const exportSelectionCount = selectedExportElementIds.length;
  const allExportSelected = elements.length > 0 && exportSelectionCount === elements.length;

  const summaryLine = () => {
    const parts = [];
    if (totalDataPoints > 0)
      parts.push(
        `${totalDataPoints} data point${totalDataPoints !== 1 ? "s" : ""} recorded`,
      );
    return parts.length
      ? parts.join(" · ")
      : "Complete a survey to see your health data here.";
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
            Health Summary
          </h1>
          {loading ? (
            <Skeleton className="h-4 w-56 mt-2" />
          ) : (
            <p className="text-base text-slate-500 mt-2">{summaryLine()}</p>
          )}
        </div>

        {/* ── Export dropdown ── */}
        {!loading && elements.length > 0 && (
          <div className="relative shrink-0">
            <button
              onClick={() => setExportOpen((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 shadow-sm text-sm font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700 hover:shadow transition-all"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Export
            </button>

            {exportOpen && (
              <>
                {/* backdrop */}
                <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden">
                <div className="max-h-[26rem] overflow-y-auto">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Download report</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Choose which metrics to include in your report.
                    </p>
                  </div>
                  <div className="px-4 py-3 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedExportElementIds(
                          allExportSelected ? [] : elements.map((element) => String(element.element_id)),
                        )
                      }
                      className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-semibold text-slate-600 hover:border-blue-200 hover:text-blue-700"
                    >
                      <span>{allExportSelected ? "Clear all metrics" : "Select all metrics"}</span>
                      <span>{exportSelectionCount}/{elements.length}</span>
                    </button>
                    <div className="mt-3 max-h-40 space-y-2 overflow-y-auto pr-1">
                      {elements.map((element) => {
                        const checked = selectedExportElementIds.some(
                          (id) => String(id) === String(element.element_id),
                        );
                        return (
                          <label
                            key={element.element_id}
                            className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-100 px-3 py-2 hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedExportElementIds((prev) => {
                                  const current = new Set((prev || []).map(String));
                                  const id = String(element.element_id);
                                  if (current.has(id)) current.delete(id);
                                  else current.add(id);
                                  return elements
                                    .map((item) => String(item.element_id))
                                    .filter((idValue) => current.has(idValue));
                                });
                              }}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-700">{element.label}</p>
                              <p className="text-[10px] text-slate-400">
                                {element.unit || "No unit"} · {element.count ?? 0} reading{element.count === 1 ? "" : "s"}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                  <button
                    onClick={handlePDF}
                    disabled={exportSelectionCount === 0}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                  >
                    <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 text-base">📄</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Save as PDF</p>
                      <p className="text-[10px] text-slate-400">Full formatted report</p>
                    </div>
                  </button>
                  <button
                    onClick={handleCSV}
                    disabled={exportSelectionCount === 0}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors text-left border-t border-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 text-base">📊</span>
                    <div>
                      <p className="text-sm font-semibold text-slate-700">Download CSV</p>
                      <p className="text-[10px] text-slate-400">Raw data spreadsheet</p>
                    </div>
                  </button>
                </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-2xl px-5 py-4 text-sm">
          Could not load your health data. Please try again later.
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex gap-2">
        <GuideTooltip tip="See all your tracked health metrics as individual charts — one graph per metric over time." position="bottom">
          <TabButton
            id="overview"
            activeTab={tab}
            onClick={setTab}
            icon={<IcoOverview />}
            label="Overview"
            badge={elements.length > 0 ? elements.length : null}
          />
        </GuideTooltip>
        <GuideTooltip tip="Pick two health metrics and see them side by side on the same chart to spot patterns or relationships." position="bottom">
          <TabButton
            id="compare"
            activeTab={tab}
            onClick={setTab}
            icon={<IcoCompare />}
            label="Compare"
            badge={null}
          />
        </GuideTooltip>
      </div>

      {/* ── Tab panels ── */}
      {tab === "overview" && (
        <OverviewTab elements={elements} timeseries={timeseries} loading={loading} />
      )}
      {tab === "compare" && (
        <CompareTab
          vsElements={vsElements}
          activeSelected={activeSelected}
          selectedElement={selectedElement}
          setSelectedElement={setSelectedElement}
          timeseries={timeseries}
          loading={loading}
        />
      )}
    </div>
  );
}

// ── LineChart (Wealthsimple-style) ─────────────────────────────────────────

function LineChart({ points, color = "#3b82f6", unit = "" }) {
  const [hovered, setHovered] = useState(null);
  const svgRef = useRef(null);

  const filtered = (points || [])
    .filter((p) => p.value_number != null && p.observed_at)
    .sort((a, b) => new Date(a.observed_at) - new Date(b.observed_at));

  if (filtered.length < 2) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-xs text-slate-300">Not enough data to display</span>
      </div>
    );
  }

  const W = 600, H = 210;
  const PL = 46, PR = 16, PT = 28, PB = 34;
  const CW = W - PL - PR, CH = H - PT - PB;

  const vals = filtered.map((p) => p.value_number);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const pad = range * 0.08;

  const yScale = (v) => PT + (1 - (v - (minV - pad)) / (range + pad * 2)) * CH;
  const xScale = (i) => PL + (i / (filtered.length - 1)) * CW;

  const pts = filtered.map((p, i) => ({
    x: xScale(i),
    y: yScale(p.value_number),
    val: p.value_number,
    date: new Date(p.observed_at),
  }));

  // Smooth cubic bezier path
  const linePath = pts.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return d + ` C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
  }, "");

  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x},${PT + CH} L ${pts[0].x},${PT + CH} Z`;

  // Min / max indices
  const maxIdx = vals.indexOf(Math.max(...vals));
  const minIdx = vals.indexOf(Math.min(...vals));

  // Y-axis gridlines — labels show real data range (maxV → minV), not padded domain
  const gridVals = [0, 0.33, 0.67, 1].map((pct) => ({
    y: PT + pct * CH,
    v: maxV - pct * range,
  }));

  // X-axis date labels (max 5 evenly spaced)
  const xCount = Math.min(filtered.length, 5);
  const xIdxs = Array.from({ length: xCount }, (_, i) =>
    Math.round((i / (xCount - 1)) * (filtered.length - 1))
  );

  const fmtDate = (d) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtVal = (v) =>
    `${Number(v).toFixed(range < 10 ? 1 : 0)}${unit ? " " + unit : ""}`;

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    let closest = null,
      minDist = Infinity;
    pts.forEach((p) => {
      const dist = Math.abs(p.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    });
    setHovered(minDist < (CW / filtered.length) * 1.2 ? closest : null);
  };

  const gradId = `lc-grad-${color.replace("#", "")}`;

  // Keep tooltip inside SVG bounds
  const tipX = (x) => Math.max(PL + 44, Math.min(x, W - PR - 44));

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ cursor: "crosshair" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.14" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y labels */}
        {gridVals.map(({ y, v }, i) => (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="system-ui,sans-serif">
              {Number(v).toFixed(range < 10 ? 1 : 0)}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradId})`} />

        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Max marker */}
        {maxIdx !== minIdx && (() => {
          const mx = pts[maxIdx].x;
          const my = pts[maxIdx].y;
          // If too close to top, show label below; otherwise above
          const labelY = my < PT + 16 ? my + 17 : my - 9;
          const anchor = mx < PL + 30 ? "start" : mx > W - PR - 30 ? "end" : "middle";
          return (
            <>
              <circle cx={mx} cy={my} r="4.5" fill="white" stroke={color} strokeWidth="2" />
              <text x={mx} y={labelY} textAnchor={anchor} fontSize="9" fill={color} fontWeight="700" fontFamily="system-ui,sans-serif">
                ↑ {fmtVal(vals[maxIdx])}
              </text>
            </>
          );
        })()}

        {/* Min marker */}
        {maxIdx !== minIdx && (() => {
          const mx = pts[minIdx].x;
          const my = pts[minIdx].y;
          // If too close to bottom (would overlap x-axis), show label above; otherwise below
          const labelY = my + 17 > PT + CH - 2 ? my - 9 : my + 17;
          const anchor = mx < PL + 30 ? "start" : mx > W - PR - 30 ? "end" : "middle";
          return (
            <>
              <circle cx={mx} cy={my} r="4.5" fill="white" stroke="#f59e0b" strokeWidth="2" />
              <text x={mx} y={labelY} textAnchor={anchor} fontSize="9" fill="#f59e0b" fontWeight="700" fontFamily="system-ui,sans-serif">
                ↓ {fmtVal(vals[minIdx])}
              </text>
            </>
          );
        })()}

        {/* Latest dot */}
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="5" fill={color} />
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="9" fill={color} fillOpacity="0.15" />

        {/* X-axis labels */}
        {xIdxs.map((i, pos) => (
          <text
            key={i}
            x={pts[i].x}
            y={H - 4}
            textAnchor={pos === 0 ? "start" : pos === xCount - 1 ? "end" : "middle"}
            fontSize="9"
            fontWeight="600"
            fill="#475569"
            fontFamily="system-ui,sans-serif"
          >
            {fmtDate(pts[i].date)}
          </text>
        ))}

        {/* Hover crosshair */}
        {hovered && (
          <>
            <line
              x1={hovered.x} y1={PT}
              x2={hovered.x} y2={PT + CH}
              stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.45"
            />
            <circle cx={hovered.x} cy={hovered.y} r="5.5" fill="white" stroke={color} strokeWidth="2.5" />
            {/* Tooltip box */}
            <rect
              x={tipX(hovered.x) - 44} y={hovered.y - 42}
              width="88" height="32"
              rx="7" fill="#1e293b"
            />
            <text
              x={tipX(hovered.x)} y={hovered.y - 27}
              textAnchor="middle" fontSize="10.5" fill="white" fontWeight="700"
              fontFamily="system-ui,sans-serif"
            >
              {fmtVal(hovered.val)}
            </text>
            <text
              x={tipX(hovered.x)} y={hovered.y - 15}
              textAnchor="middle" fontSize="8.5" fill="#94a3b8"
              fontFamily="system-ui,sans-serif"
            >
              {fmtDate(hovered.date)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

// ── CategoryChart ──────────────────────────────────────────────────────────

function CategoryChart({ points, color = "#3b82f6" }) {
  const textPoints = (points || []).filter((p) => p.value_text != null && p.observed_at);
  if (textPoints.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <span className="text-xs text-slate-300">Not enough data to display</span>
      </div>
    );
  }

  // Count frequency of each label
  const freq = {};
  textPoints.forEach((p) => {
    freq[p.value_text] = (freq[p.value_text] || 0) + 1;
  });
  const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  const maxCount = entries[0][1];

  return (
    <div className="w-full h-full flex flex-col justify-center gap-2 py-1 overflow-y-auto">
      {entries.map(([label, count]) => {
        const pct = (count / maxCount) * 100;
        return (
          <div key={label} className="flex items-center gap-2 min-w-0">
            <span className="text-[11px] font-semibold text-slate-500 w-24 shrink-0 truncate text-right">{label}</span>
            <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color + "cc" }}
              />
            </div>
            <span className="text-[11px] font-bold text-slate-600 w-6 shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Overview tab ───────────────────────────────────────────────────────────

const RANGES = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 14 days", days: 14 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 60 days", days: 60 },
  { label: "Last 90 days", days: 90 },
  { label: "All time", days: 36500 },
];

function filterPointsByDays(points, days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return points.filter((p) => p.observed_at && new Date(p.observed_at) >= cutoff);
}

function calcTrend(vals) {
  if (vals.length < 2) return { direction: "flat", pct: null };
  const mid = Math.floor(vals.length / 2);
  const firstAvg = vals.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
  const secondAvg = vals.slice(mid).reduce((a, b) => a + b, 0) / (vals.length - mid);
  if (firstAvg === 0) return { direction: "flat", pct: null };
  const pct = ((secondAvg - firstAvg) / firstAvg) * 100;
  const direction = pct > 1 ? "up" : pct < -1 ? "down" : "flat";
  return { direction, pct: Math.abs(pct).toFixed(1) };
}

const METRIC_INITIAL = 8;

function OverviewTab({ elements, timeseries, loading }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [selectedId, setSelectedId] = useState(null);
  const [metricSearch, setMetricSearch] = useState("");
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  // Auto-select first element once loaded
  const resolvedId = selectedId || (elements[0]?.element_id ?? null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
        </div>
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  if (elements.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center space-y-2">
        <div className="w-14 h-14 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto">
          <IcoOverview />
        </div>
        <p className="text-slate-700 font-semibold mt-3">No metrics yet</p>
        <p className="text-sm text-slate-500 mt-1">Complete a survey and your health data will appear here.</p>
      </div>
    );
  }

  const tsMap = {};
  timeseries.forEach((ts) => { tsMap[ts.element_id] = ts.points || []; });

  const filteredElements = elements.filter((el) =>
    el.label.toLowerCase().includes(metricSearch.toLowerCase())
  );
  const visibleElements = showAllMetrics || metricSearch ? filteredElements : filteredElements.slice(0, METRIC_INITIAL);
  const hiddenCount = filteredElements.length - METRIC_INITIAL;

  const activeEl = elements.find((e) => e.element_id === resolvedId) || elements[0];
  const allPoints = tsMap[activeEl.element_id] || [];
  const points = filterPointsByDays(allPoints, rangeDays);
  const vals = points.map((p) => p.value_number).filter((v) => v != null && Number.isFinite(v));
  const textPoints = points.filter((p) => p.value_text != null && p.observed_at);
  const isCategorical = vals.length === 0 && textPoints.length > 0;
  const readingCount = isCategorical ? textPoints.length : vals.length;

  const latest = vals.length ? vals[vals.length - 1] : null;
  const latestText = isCategorical
    ? [...textPoints].sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))[0]?.value_text
    : null;
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : activeEl.avg;
  const min = vals.length ? Math.min(...vals) : activeEl.min;
  const max = vals.length ? Math.max(...vals) : activeEl.max;
  const { direction, pct } = calcTrend(vals);

  const trendColor = direction === "up" ? "#22c55e" : direction === "down" ? "#f59e0b" : "#3b82f6";
  const trendBg = direction === "up" ? "bg-emerald-50 text-emerald-600" : direction === "down" ? "bg-amber-50 text-amber-600" : "bg-blue-50 text-blue-600";
  const trendLabel = direction === "up" ? `↑ ${pct}%` : direction === "down" ? `↓ ${pct}%` : "→ Stable";

  return (
    <div className="space-y-4">

      {/* Metric selector */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-3">
        {/* Search bar — only shown when there are enough elements */}
        {elements.length > METRIC_INITIAL && (
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search metrics..."
              value={metricSearch}
              onChange={(e) => { setMetricSearch(e.target.value); setShowAllMetrics(true); }}
              className="w-full pl-8 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {/* Pills */}
        <div className="flex flex-wrap gap-2">
          {visibleElements.map((el) => (
            <button
              key={el.element_id}
              onClick={() => setSelectedId(el.element_id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                el.element_id === resolvedId
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm"
              }`}
            >
              {el.label}
            </button>
          ))}

          {!metricSearch && hiddenCount > 0 && !showAllMetrics && (
            <button
              onClick={() => setShowAllMetrics(true)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-slate-300 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all"
            >
              +{hiddenCount} more
            </button>
          )}
          {!metricSearch && showAllMetrics && filteredElements.length > METRIC_INITIAL && (
            <button
              onClick={() => setShowAllMetrics(false)}
              className="px-3 py-1.5 rounded-full text-xs font-bold border border-dashed border-slate-300 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition-all"
            >
              Show less
            </button>
          )}
        </div>
      </div>

      {/* Main chart card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-lg overflow-hidden">
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(to right, ${trendColor}, ${trendColor}33)` }} />

        <div className="p-5 pb-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{activeEl.label}</p>
              <div className="flex items-end gap-2.5">
                <p className="text-4xl font-black text-slate-800 leading-none tracking-tight">
                  {isCategorical
                    ? (latestText || "—")
                    : latest != null ? Number(latest).toFixed(1) : avg != null ? Number(avg).toFixed(1) : "—"}
                </p>
                {!isCategorical && <p className="text-sm font-semibold text-slate-400 mb-0.5">{activeEl.unit || ""}</p>}
                {!isCategorical && pct != null && (
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full mb-0.5 ${trendBg}`}>
                    {trendLabel}
                  </span>
                )}
              </div>
            </div>

            {/* Day range dropdown */}
            <select
              value={rangeDays}
              onChange={(e) => setRangeDays(Number(e.target.value))}
              className="shrink-0 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
            >
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Chart */}
          <div className="w-full h-52">
            {isCategorical
              ? <CategoryChart points={points} color={trendColor} />
              : <LineChart points={points} color={trendColor} unit={activeEl.unit || ""} />}
          </div>

          {/* Stats row */}
          {!isCategorical && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-4 gap-2">
              {[
                { label: "Latest", val: latest, color: "text-blue-600" },
                { label: "Average", val: avg, color: "text-slate-700" },
                { label: "Low", val: min, color: "text-amber-500" },
                { label: "High", val: max, color: "text-emerald-600" },
              ].map(({ label, val, color }) => (
                <div key={label} className="flex flex-col items-center gap-0.5 py-2.5 rounded-xl bg-slate-50 border border-slate-100 shadow-sm">
                  <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{label}</span>
                  <span className={`text-sm font-black ${color}`}>
                    {val != null ? Number(val).toFixed(1) : "—"}
                  </span>
                  {activeEl.unit && <span className="text-[9px] text-slate-400">{activeEl.unit}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Entry count */}
          <p className="text-[11px] text-slate-400 text-center mt-3">
            {readingCount} {readingCount === 1 ? "reading" : "readings"} in the selected period
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Compare tab ────────────────────────────────────────────────────────────

function CompareTab({
  vsElements,
  activeSelected,
  selectedElement,
  setSelectedElement,
  timeseries,
  loading,
}) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Build timeseries map: element_id → points
  const tsMap = {};
  (timeseries || []).forEach((ts) => { tsMap[ts.element_id] = ts.points || []; });

  const filtered = vsElements.filter((el) =>
    el.label.toLowerCase().includes(search.toLowerCase()),
  );
  const visible = search
    ? filtered
    : showAll
      ? filtered
      : filtered.slice(0, PILLS_INITIAL);
  const hiddenCount = filtered.length - PILLS_INITIAL;

  if (loading) return <Skeleton className="h-64" />;

  if (vsElements.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm shadow-slate-100 p-12 text-center space-y-2">
        <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <IcoCompare />
        </div>
        <p className="text-slate-700 font-semibold mt-3">No group data yet</p>
        <p className="text-sm text-slate-400">
          Comparison data will appear once your group has enough submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <input
        type="text"
        placeholder="Search metrics…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setShowAll(false);
        }}
        className="w-full text-sm px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-50 placeholder:text-slate-300 bg-white shadow-sm"
      />

      {/* Pills */}
      <div className="flex flex-wrap gap-2">
        {visible.length === 0 ? (
          <p className="text-sm text-slate-400 py-1">
            No metrics match "{search}"
          </p>
        ) : (
          visible.map((el) => (
            <button
              key={el.element_id}
              onClick={() => setSelectedElement(el.element_id)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                selectedElement === el.element_id
                  ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-100"
                  : "bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:text-blue-600 hover:shadow-sm"
              }`}
            >
              {el.label}
            </button>
          ))
        )}

        {!search && hiddenCount > 0 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="px-3 py-1.5 rounded-full text-sm font-semibold border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-all"
          >
            {showAll ? "Show less" : `+${hiddenCount} more`}
          </button>
        )}
      </div>

      {activeSelected && (
        <ComparisonVisual
          key={activeSelected.element_id}
          el={activeSelected}
          tsPoints={tsMap[activeSelected.element_id] || []}
        />
      )}
    </div>
  );
}

// ── Comparison bars (fallback) ─────────────────────────────────────────────

function ComparisonBars({ el, mounted, diff }) {
  const meAvg = el.subject?.avg;
  const groupAvg = el.comparison?.avg;
  const groupMin = el.comparison?.min;
  const groupMax = el.comparison?.max;

  const barCeiling = Math.max(meAvg ?? 0, groupAvg ?? 0, groupMax ?? 0, 1);
  const mePct = meAvg != null ? Math.min((meAvg / barCeiling) * 100, 100) : 0;
  const groupPct = groupAvg != null ? Math.min((groupAvg / barCeiling) * 100, 100) : 0;
  const groupMinPct = groupMin != null ? Math.min((groupMin / barCeiling) * 100, 100) : 0;
  const groupMaxPct = groupMax != null ? Math.min((groupMax / barCeiling) * 100, 100) : 0;
  const hasRangeBar = groupMin != null && groupMax != null && groupMax !== groupMin;

  const st = (() => {
    if (diff == null) return { color: "text-slate-400" };
    if (Math.abs(diff) < 0.5) return { color: "text-slate-600" };
    if (diff > 0) return { color: "text-emerald-600" };
    return { color: "text-amber-600" };
  })();

  const BAR_H = 140;

  return (
    <div className="flex items-end gap-4" style={{ height: `${BAR_H + 48}px` }}>
      {/* YOU */}
      <div className="flex flex-col items-center gap-2 flex-1">
        <span className={`text-sm font-black tabular-nums ${st.color}`}>
          {meAvg != null ? `${Number(meAvg).toFixed(1)} ${el.unit || ""}` : "—"}
        </span>
        <div className="relative w-full flex items-end rounded-t-2xl overflow-hidden bg-blue-50" style={{ height: `${BAR_H}px` }}>
          <div
            className="w-full rounded-t-2xl bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-700"
            style={{
              height: mounted && meAvg != null ? `${mePct}%` : "0%",
              transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
            }}
          />
        </div>
        <span className="text-xs font-black text-blue-600 uppercase tracking-widest">You</span>
      </div>

      {/* GROUP */}
      <div className="flex flex-col items-center gap-2 flex-1">
        <span className="text-sm font-black tabular-nums text-emerald-600">
          {groupAvg != null ? `${Number(groupAvg).toFixed(1)} ${el.unit || ""}` : "—"}
        </span>
        <div className="relative w-full flex items-end rounded-t-2xl overflow-hidden bg-emerald-50" style={{ height: `${BAR_H}px` }}>
          {hasRangeBar && (
            <div
              className="absolute w-full bg-emerald-200/50"
              style={{ bottom: `${groupMinPct}%`, height: `${groupMaxPct - groupMinPct}%` }}
            />
          )}
          <div
            className="w-full rounded-t-2xl bg-gradient-to-t from-emerald-600 to-emerald-400 relative z-10 transition-all duration-700"
            style={{
              height: mounted && groupAvg != null ? `${groupPct}%` : "0%",
              transitionTimingFunction: "cubic-bezier(0.34,1.56,0.64,1)",
            }}
          />
        </div>
        <span className="text-xs font-black text-emerald-600 uppercase tracking-widest">Group avg</span>
      </div>
    </div>
  );
}

// ── Comparison visual ──────────────────────────────────────────────────────

function ComparisonVisual({ el, tsPoints }) {
  const [mounted, setMounted] = useState(false);
  const svgRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 60);
    return () => clearTimeout(t);
  }, []);

  const meAvg = el.subject?.avg;
  const groupAvg = el.comparison?.avg;
  const groupMin = el.comparison?.min;
  const groupMax = el.comparison?.max;
  const diff = meAvg != null && groupAvg != null ? meAvg - groupAvg : null;
  const hasRange = groupMin != null && groupMax != null && groupMax !== groupMin;
  const isNumeric = meAvg != null || groupAvg != null;
  const unit = el.unit || "";

  const st = (() => {
    if (diff == null) return { color: "text-slate-400", label: "No data yet", badge: "bg-slate-100 text-slate-500" };
    if (Math.abs(diff) < 0.5) return { color: "text-slate-600", label: "Right on track", badge: "bg-blue-100 text-blue-600" };
    if (diff > 0) return { color: "text-emerald-600", label: "Above average", badge: "bg-emerald-100 text-emerald-600" };
    return { color: "text-amber-600", label: "Below average", badge: "bg-amber-100 text-amber-600" };
  })();

  const fmtDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtVal = (v) => `${Number(v).toFixed(1)}${unit ? " " + unit : ""}`;

  // Categorical (non-numeric) fallback
  if (!isNumeric) {
    return (
      <div className="rounded-2xl border border-slate-200 shadow-sm bg-white overflow-hidden">
        <div className="p-6 text-center space-y-3">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{el.label}</p>
          <p className="text-sm text-slate-500">This metric contains text responses and cannot be compared numerically.</p>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-blue-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Your answer</p>
              <p className="text-sm font-bold text-blue-700">{el.subject?.mode ?? "—"}</p>
            </div>
            <div className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Most common</p>
              <p className="text-sm font-bold text-slate-600">{el.comparison?.mode ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter and sort timeseries points
  const filteredPts = (tsPoints || [])
    .filter((p) => p.value_number != null && p.observed_at)
    .sort((a, b) => new Date(a.observed_at) - new Date(b.observed_at));

  const hasPts = filteredPts.length >= 2;

  // Chart dimensions
  const W = 560, H = 180;
  const PL = 44, PR = 16, PT = 20, PB = 30;
  const CW = W - PL - PR, CH = H - PT - PB;

  let svgContent = null;
  if (hasPts) {
    const vals = filteredPts.map((p) => p.value_number);
    const allVals = [...vals];
    if (groupAvg != null) allVals.push(groupAvg);
    if (groupMin != null) allVals.push(groupMin);
    if (groupMax != null) allVals.push(groupMax);
    const minV = Math.min(...allVals);
    const maxV = Math.max(...allVals);
    const range = maxV - minV || 1;

    const yScale = (v) => PT + (1 - (v - minV) / range) * CH;
    const xScale = (i) => PL + (i / (filteredPts.length - 1)) * CW;

    const pts2 = filteredPts.map((p, i) => ({
      x: xScale(i),
      y: yScale(p.value_number),
      val: p.value_number,
      date: new Date(p.observed_at),
    }));

    const linePath = pts2.reduce((d, p, i) => {
      if (i === 0) return `M ${p.x},${p.y}`;
      const prev = pts2[i - 1];
      const cpx = (prev.x + p.x) / 2;
      return d + ` C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`;
    }, "");

    const areaPath =
      linePath + ` L ${pts2[pts2.length - 1].x},${PT + CH} L ${pts2[0].x},${PT + CH} Z`;

    const groupAvgY = groupAvg != null ? yScale(groupAvg) : null;
    const groupMinY = groupMin != null ? yScale(groupMin) : null;
    const groupMaxY = groupMax != null ? yScale(groupMax) : null;

    const gridVals = [0, 0.33, 0.67, 1].map((pct) => ({
      y: PT + pct * CH,
      v: maxV - pct * range,
    }));

    const xCount = Math.min(filteredPts.length, 5);
    const xIdxs = Array.from({ length: xCount }, (_, i) =>
      Math.round((i / (xCount - 1)) * (filteredPts.length - 1))
    );

    const tipX = (x) => Math.max(PL + 44, Math.min(x, W - PR - 44));

    const handleMouseMove = (e) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      let closest = null, minDist = Infinity;
      pts2.forEach((p) => {
        const dist = Math.abs(p.x - svgX);
        if (dist < minDist) { minDist = dist; closest = p; }
      });
      setHovered(minDist < (CW / filteredPts.length) * 1.2 ? closest : null);
    };

    svgContent = (
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: "180px", cursor: "crosshair" }}
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id="cv-you-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gridlines + Y labels */}
        {gridVals.map(({ y, v }, i) => (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#f1f5f9" strokeWidth="1" />
            <text x={PL - 6} y={y + 4} textAnchor="end" fontSize="9" fill="#64748b" fontFamily="system-ui,sans-serif">
              {Number(v).toFixed(range < 10 ? 1 : 0)}
            </text>
          </g>
        ))}

        {/* Group range band */}
        {hasRange && groupMinY != null && groupMaxY != null && (
          <rect
            x={PL} y={groupMaxY}
            width={CW} height={groupMinY - groupMaxY}
            fill="#10b981" fillOpacity="0.08"
          />
        )}

        {/* Group avg dashed line */}
        {groupAvgY != null && (
          <line
            x1={PL} y1={groupAvgY}
            x2={W - PR} y2={groupAvgY}
            stroke="#10b981" strokeWidth="2" strokeDasharray="6 4"
            opacity="0.9"
          />
        )}

        {/* Area fill */}
        <path d={areaPath} fill="url(#cv-you-grad)" />

        {/* You line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Latest dot */}
        <circle cx={pts2[pts2.length - 1].x} cy={pts2[pts2.length - 1].y} r="5" fill="#3b82f6" />
        <circle cx={pts2[pts2.length - 1].x} cy={pts2[pts2.length - 1].y} r="9" fill="#3b82f6" fillOpacity="0.15" />

        {/* X labels */}
        {xIdxs.map((i, pos) => (
          <text
            key={i}
            x={pts2[i].x}
            y={H - 4}
            textAnchor={pos === 0 ? "start" : pos === xCount - 1 ? "end" : "middle"}
            fontSize="9" fontWeight="600" fill="#475569"
            fontFamily="system-ui,sans-serif"
          >
            {fmtDate(pts2[i].date)}
          </text>
        ))}

        {/* Hover crosshair */}
        {hovered && (
          <>
            <line x1={hovered.x} y1={PT} x2={hovered.x} y2={PT + CH} stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
            <circle cx={hovered.x} cy={hovered.y} r="5.5" fill="white" stroke="#3b82f6" strokeWidth="2.5" />
            <rect x={tipX(hovered.x) - 44} y={hovered.y - 42} width="88" height="32" rx="7" fill="#1e293b" />
            <text x={tipX(hovered.x)} y={hovered.y - 27} textAnchor="middle" fontSize="10.5" fill="white" fontWeight="700" fontFamily="system-ui,sans-serif">
              {fmtVal(hovered.val)}
            </text>
            <text x={tipX(hovered.x)} y={hovered.y - 15} textAnchor="middle" fontSize="8.5" fill="#94a3b8" fontFamily="system-ui,sans-serif">
              {fmtDate(hovered.date)}
            </text>
          </>
        )}
      </svg>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 shadow-md bg-white overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1">{el.label}</p>
            <div className="flex items-end gap-2">
              <p className="text-3xl font-black text-slate-800 leading-none">
                {meAvg != null ? Number(meAvg).toFixed(1) : "—"}
              </p>
              {unit && <p className="text-sm font-semibold text-slate-400 mb-0.5">{unit}</p>}
            </div>
          </div>
          <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 ${st.badge}`}>{st.label}</span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-blue-500 rounded-full" />
            <span className="text-[10px] font-bold text-slate-500">You</span>
          </div>
          <div className="flex items-center gap-1.5">
            <svg width="24" height="4" viewBox="0 0 24 4">
              <line x1="0" y1="2" x2="24" y2="2" stroke="#10b981" strokeWidth="2" strokeDasharray="4 3" />
            </svg>
            <span className="text-[10px] font-bold text-slate-500">Group avg</span>
          </div>
          {hasRange && (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-3 bg-emerald-100 rounded-sm" />
              <span className="text-[10px] font-bold text-slate-500">Group range</span>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 space-y-5">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Where you stand</p>

        {hasPts ? svgContent : (
          <ComparisonBars el={el} mounted={mounted} diff={diff} />
        )}

        {/* Plain-English diff */}
        {diff != null ? (
          <p className="text-sm text-slate-500 leading-relaxed text-center bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            {Math.abs(diff) < 0.5
              ? "You're right in line with the group average. Great consistency!"
              : (
                <>You're{" "}
                  <span className={`font-bold ${diff > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                    {Number(Math.abs(diff)).toFixed(1)}{unit ? ` ${unit}` : ""} {diff > 0 ? "above" : "below"}
                  </span>
                  {" "}the group average.</>
              )
            }
          </p>
        ) : (
          <p className="text-sm text-slate-400 text-center bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
            Not enough data to compare yet.
          </p>
        )}
      </div>
    </div>
  );
}
