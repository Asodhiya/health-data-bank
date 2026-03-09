import { useState, useEffect, useMemo } from "react"; // Added useMemo back for stats
import { useOutletContext } from "react-router-dom"; // Added this for User data
import api from "../../utils/axiosInstance";

export default function ResearcherDashboard() {
  const { user } = useOutletContext(); // Get the logged-in user (e.g., Robin)
  const [queryData, setQueryData] = useState({ columns: [], data: [] });
  const [loading, setLoading] = useState(true);
  const [hiddenColumns, setHiddenColumns] = useState([]);

  // FETCH REAL DATA From the Backend
  // useEffect(() => {
  //   api
  //     .get("/researcher/query/results")
  //     .then((res) => setQueryData(res.data))
  //     .catch((err) => console.error("API Error:", err))
  //     .finally(() => setLoading(false));
  // }, []);

  useEffect(() => {
    api
      .get("/researcher/query/results")
      .then((res) => {
        // 1. Get the real columns from Nayan
        const realColumns = res.data.columns;

        // 2. Add "Test" columns manually to see how they look in the UI
        const testColumns = [
          ...realColumns,
          { id: "q1", text: "Q1: Daily Mood" },
          { id: "q2", text: "Q2: Sleep Quality" },
          { id: "status", text: "Participation Status" },
          { id: "location", text: "Region" },
        ];

        setQueryData({
          columns: testColumns, // Use the expanded list
          data: res.data.data, // Use the real data (which has nulls for these new keys)
        });
      })
      .catch((err) => console.error("API Error:", err))
      .finally(() => setLoading(false));
  }, []);

  // RE-ADD STATS CALCULATION: Derive these from the API data
  const stats = useMemo(() => {
    const count = queryData.data.length;
    // Calculate mean if there is a 'score' column
    const scoredRows = queryData.data.filter(
      (r) => r.score !== null && r.score !== undefined,
    );
    const mean =
      scoredRows.length > 0
        ? (
            scoredRows.reduce((acc, row) => acc + Number(row.score), 0) /
            scoredRows.length
          ).toFixed(1)
        : "0.0";

    return {
      count,
      mean,
      scoredCount: scoredRows.length,
    };
  }, [queryData]);

  // RE-ADD RESET FUNCTION: For now, it just refreshes the data
  const resetFilters = () => {
    setLoading(true);
    api
      .get("/researcher/query/results")
      .then((res) => setQueryData(res.data))
      .finally(() => setLoading(false));
  };

  if (loading)
    return (
      <div className="p-10 text-slate-500 font-bold">
        Connecting to Research Vault...
      </div>
    );

  return (
    <div className="w-full space-y-6">
      {/* PAGE HEADER & EXPORT */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Welcome, {user?.first_name || "Researcher"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Analyzing {stats.count} participant responses in the database.
          </p>
        </div>

        <button className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2 w-fit shadow-sm text-sm">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export {stats.count} Rows (CSV)
        </button>
      </div>

      {/* SECTION A: THE ATTRIBUTE SELECTOR */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-5 pb-4 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
            Visible Attributes
          </h2>
          <button
            onClick={resetFilters}
            className="text-xs font-bold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest"
          >
            Refresh Schema
          </button>
        </div>

        <div className="flex flex-wrap gap-3">
          {queryData.columns.map((col) => (
            <label key={col.id} className="flex items-center gap-2 ...">
              <input
                type="checkbox"
                checked={!hiddenColumns.includes(col.id)} // It's checked if it's NOT in the hidden list
                onChange={() => {
                  if (hiddenColumns.includes(col.id)) {
                    setHiddenColumns(
                      hiddenColumns.filter((id) => id !== col.id),
                    ); // Remove from hidden
                  } else {
                    setHiddenColumns([...hiddenColumns, col.id]); // Add to hidden
                  }
                }}
                className="..."
              />
              <span>{col.text}</span>
            </label>
          ))}
        </div>
      </div>

      {/* MIDDLE SECTION: DYNAMIC SUMMARY CALCULATIONS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Filtered Results
            </p>
            <p className="text-xl font-extrabold text-slate-800">
              {stats.count} Rows
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Mean Score
            </p>
            <p className="text-xl font-extrabold text-slate-800">
              {stats.mean} Avg
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857"
              />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Valid Entries
            </p>
            <p className="text-xl font-extrabold text-slate-800">
              {stats.scoredCount} Scored
            </p>
          </div>
        </div>
      </div>

      {/* SECTION B: THE DYNAMIC DATA TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {queryData.columns
                  .filter((col) => !hiddenColumns.includes(col.id)) // 👈 This skips hidden columns
                  .map((col) => (
                    <th
                      key={col.id}
                      className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider"
                    >
                      {col.text}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {queryData.data.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="hover:bg-blue-50/50 transition-colors"
                >
                  {queryData.columns
                    .filter((col) => !hiddenColumns.includes(col.id)) // 👈 This matches the header filter
                    .map((col) => (
                      <td
                        key={col.id}
                        className="px-6 py-4 text-sm font-medium text-slate-700"
                      >
                        {col.id.includes("id") ? (
                          <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {row[col.id]?.substring(0, 8)}...
                          </span>
                        ) : (
                          row[col.id] || (
                            <span className="text-slate-300 italic">—</span>
                          )
                        )}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
          {queryData.data.length === 0 && (
            <div className="p-20 text-center text-slate-400 font-bold">
              No data found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
