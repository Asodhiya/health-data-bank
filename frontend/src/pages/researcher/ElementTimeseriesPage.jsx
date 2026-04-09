import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../services/api";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function toggleArrayValue(items, value) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const LINE_COLORS = ["#1d4ed8", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2"];

export default function ElementTimeseriesPage() {
  const [elements, setElements] = useState([]);
  const [surveys, setSurveys] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [elementSearch, setElementSearch] = useState("");
  const [chartSeries, setChartSeries] = useState([]);
  const [showIndividualLines, setShowIndividualLines] = useState(false);
  const [filters, setFilters] = useState({
    element_ids: [],
    survey_id: "",
    group_ids: [],
    source_types: ["survey", "goal"],
    mode: "aggregate",
    date_from: "",
    date_to: "",
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.listElements().catch(() => []),
      api.getAvailableSurveys().catch(() => []),
      api.listGroups().catch(() => []),
    ])
      .then(([elementsRes, surveysRes, groupsRes]) => {
        setElements(elementsRes || []);
        setSurveys(surveysRes || []);
        setGroups(groupsRes || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredElements = useMemo(() => {
    const q = elementSearch.trim().toLowerCase();
    if (!q) return elements;
    return elements.filter((element) =>
      `${element.label || ""} ${element.code || ""} ${element.unit || ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [elementSearch, elements]);

  const tableColumns = useMemo(() => {
    const firstRow = rows[0];
    return firstRow ? Object.keys(firstRow) : [];
  }, [rows]);

  const buildPayload = (groupIdsOverride = filters.group_ids) => ({
    ...filters,
    group_ids: groupIdsOverride,
    survey_id: filters.survey_id || null,
    date_from: filters.date_from || null,
    date_to: filters.date_to || null,
  });

  const buildAggregateSeries = (seriesRows, label) => {
    const grouped = new Map();
    seriesRows.forEach((row) => {
      const key = row.element_name || row.element_id;
      const values = grouped.get(key) || [];
      if (row.value_mean !== null && row.value_mean !== undefined) {
        values.push(row.value_mean);
      }
      grouped.set(key, values);
    });

    return Array.from(grouped.entries()).map(([name, values]) => ({
      name,
      [label]: average(values),
    }));
  };

  const mergeSeries = (datasets) => {
    const byName = new Map();
    datasets.forEach(({ label, points }) => {
      points.forEach((point) => {
        const entry = byName.get(point.name) || { name: point.name };
        entry[label] = point[label];
        byName.set(point.name, entry);
      });
    });
    return Array.from(byName.values());
  };

  const buildRawSeries = (rawRows) => {
    if (showIndividualLines) {
      const grouped = new Map();
      rawRows.forEach((row) => {
        if (row.value_number === null || row.value_number === undefined || !row.observed_at) return;
        const key = row.participant_id;
        const bucket = grouped.get(key) || [];
        bucket.push({
          observed_at: new Date(row.observed_at).toLocaleDateString("en-CA"),
          [key]: row.value_number,
        });
        grouped.set(key, bucket);
      });

      const merged = new Map();
      grouped.forEach((points) => {
        points.forEach((point) => {
          const entry = merged.get(point.observed_at) || { observed_at: point.observed_at };
          Object.assign(entry, point);
          merged.set(point.observed_at, entry);
        });
      });
      return Array.from(merged.values());
    }

    const merged = new Map();
    rawRows.forEach((row) => {
      if (row.value_number === null || row.value_number === undefined || !row.observed_at) return;
      const observedAt = new Date(row.observed_at).toLocaleDateString("en-CA");
      const entry = merged.get(observedAt) || { observed_at: observedAt, cohort: [] };
      entry.cohort.push(row.value_number);
      merged.set(observedAt, entry);
    });
    return Array.from(merged.values()).map((entry) => ({
      observed_at: entry.observed_at,
      cohort: average(entry.cohort),
    }));
  };

  const runQuery = async () => {
    if (filters.element_ids.length === 0) {
      setError("Choose at least one data element.");
      setRows([]);
      return;
    }

    setRunning(true);
    setError("");
    try {
      const data = await api.getResearcherTimeseries(buildPayload());
      const nextRows = Array.isArray(data) ? data : [];
      setRows(nextRows);

      if (filters.mode === "aggregate") {
        if (filters.group_ids.length === 0) {
          setChartSeries(buildAggregateSeries(nextRows, "All participants"));
        } else {
          const groupResponses = await Promise.all(
            filters.group_ids.map(async (groupId) => {
              const group = groups.find((entry) => (entry.group_id || entry.id) === groupId);
              const groupRows = await api.getResearcherTimeseries(buildPayload([groupId]));
              return {
                label: group?.name || `Group ${String(groupId).slice(0, 8)}`,
                points: buildAggregateSeries(Array.isArray(groupRows) ? groupRows : [], group?.name || `Group ${String(groupId).slice(0, 8)}`),
              };
            }),
          );
          setChartSeries(mergeSeries(groupResponses));
        }
      } else {
        setChartSeries(buildRawSeries(nextRows));
      }
    } catch (err) {
      setRows([]);
      setChartSeries([]);
      setError(err.message || "Timeseries query failed.");
    } finally {
      setRunning(false);
    }
  };

  const selectedGroupText =
    filters.group_ids.length === 0
      ? "All participants"
      : `${filters.group_ids.length} group${filters.group_ids.length === 1 ? "" : "s"} selected`;

  const renderTooltip = (payload) => {
    if (!payload?.active || !payload?.payload?.length) return null;
    const point = payload.payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
        <p className="font-semibold text-slate-700 mb-1">{point.name || point.observed_at}</p>
        {payload.payload.map((entry) => (
          <p key={entry.dataKey} className="text-slate-600">
            {entry.name || entry.dataKey}: {entry.value ?? "—"}
          </p>
        ))}
        {point.survey_count !== undefined && (
          <p className="text-slate-500 mt-1">
            Survey / Goal: {point.survey_count ?? 0} / {point.goal_count ?? 0}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Element Timeseries</h1>
          <p className="text-sm text-slate-500 mt-1">
            Query raw and aggregate health observations across researcher cohorts.
          </p>
        </div>
        <Link
          to="/researcher"
          className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition"
        >
          Back to Dashboard
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-semibold text-slate-500 mb-2 block">
              Data elements
            </label>
            <input
              type="text"
              value={elementSearch}
              onChange={(e) => setElementSearch(e.target.value)}
              placeholder="Search elements..."
              className="w-full mb-3 p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
            />
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {loading ? (
                <div className="px-4 py-3 text-sm text-slate-400">Loading elements...</div>
              ) : filteredElements.length === 0 ? (
                <div className="px-4 py-3 text-sm text-slate-400">No data elements available.</div>
              ) : (
                filteredElements.map((element) => {
                  const elementId = element.element_id || element.id;
                  const selected = filters.element_ids.includes(elementId);
                  return (
                    <label
                      key={elementId}
                      className="flex items-start gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selected}
                        onChange={() =>
                          setFilters((prev) => ({
                            ...prev,
                            element_ids: toggleArrayValue(prev.element_ids, elementId),
                          }))
                        }
                      />
                      <span>
                        <span className="block font-medium text-slate-800">
                          {element.label || element.code || "Untitled element"}
                        </span>
                        <span className="block text-xs text-slate-400">
                          {element.unit || "No unit"}{element.datatype ? ` • ${element.datatype}` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Survey pin
              </label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.survey_id}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, survey_id: e.target.value }))
                }
              >
                <option value="">All surveys</option>
                {surveys.map((survey) => {
                  const surveyId = survey.form_id || survey.id;
                  return (
                    <option key={surveyId} value={surveyId}>
                      {survey.title || survey.name}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Mode
              </label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.mode}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, mode: e.target.value }))
                }
              >
                <option value="aggregate">Aggregate</option>
                <option value="raw">Raw</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Source data
              </label>
              <select
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.source_types.join(",")}
                onChange={(e) => {
                  const value = e.target.value;
                  setFilters((prev) => ({
                    ...prev,
                    source_types: value === "survey,goal" ? ["survey", "goal"] : [value],
                  }));
                }}
              >
                <option value="survey">Survey only</option>
                <option value="goal">Goal only</option>
                <option value="survey,goal">Survey + Goal</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Date from
              </label>
              <input
                type="date"
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, date_from: e.target.value }))
                }
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                Date to
              </label>
              <input
                type="date"
                className="w-full p-2.5 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-blue-500 bg-white shadow-sm"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, date_to: e.target.value }))
                }
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-slate-500 mb-2 block">
                Filter by group (optional)
              </label>
              <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
                {groups.map((group) => {
                  const groupId = group.group_id || group.id;
                  return (
                    <label
                      key={groupId}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.group_ids.includes(groupId)}
                        onChange={() =>
                          setFilters((prev) => ({
                            ...prev,
                            group_ids: toggleArrayValue(prev.group_ids, groupId),
                          }))
                        }
                      />
                      <span>{group.name}</span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-400">{selectedGroupText}</p>
            </div>
          </div>
        </div>

        {filters.mode === "raw" && (
          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={showIndividualLines}
              onChange={(e) => setShowIndividualLines(e.target.checked)}
            />
            Show individual participant lines
          </label>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={runQuery}
            disabled={running}
            className={`px-5 py-2.5 rounded-lg font-medium transition-colors text-sm ${
              running
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-blue-700 hover:bg-blue-800 text-white"
            }`}
          >
            {running ? "Running query..." : "Run timeseries query"}
          </button>
          <span className="text-xs text-slate-400">
            Empty group selection means all participants on the platform.
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Results</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {rows.length} row{rows.length === 1 ? "" : "s"} returned
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="px-6 py-10 text-sm text-slate-400">
            Run a query to load researcher timeseries data.
          </div>
        ) : (
          <div className="space-y-6 p-6">
            <div className="h-72 rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey={filters.mode === "aggregate" ? "name" : "observed_at"}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip content={renderTooltip} />
                  <Legend />
                  {chartSeries.length > 0 &&
                    Object.keys(chartSeries[0])
                      .filter((key) => !["name", "observed_at"].includes(key))
                      .map((key, index) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={LINE_COLORS[index % LINE_COLORS.length]}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    {tableColumns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-3 text-left font-semibold text-slate-600 whitespace-nowrap"
                      >
                        {column.replaceAll("_", " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => (
                    <tr key={`${row.participant_id || "row"}-${index}`} className="hover:bg-slate-50">
                      {tableColumns.map((column) => {
                        const canDrillIntoSubmission =
                          column === "source_submission_id" &&
                          row.source_type === "survey" &&
                          row.source_submission_id &&
                          row.participant_id;
                        return (
                          <td key={column} className="px-4 py-3 text-slate-700 whitespace-nowrap">
                            {canDrillIntoSubmission ? (
                              <Link
                                to={`/researcher/submissions/${row.participant_id}/${row.source_submission_id}`}
                                className="text-blue-600 hover:text-blue-800 font-semibold"
                              >
                                View submission
                              </Link>
                            ) : (
                              row[column] ?? "—"
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
