import { useState, useEffect } from "react";
import { api } from "../../services/api";

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const data = await api.listGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load groups:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (id) => {
    navigator.clipboard.writeText(id);
    alert("Group ID copied! You can now paste this into the Dashboard filter.");
  };

  const filteredGroups = groups.filter(
    (g) =>
      g.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      g.group_id?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading)
    return (
      <div className="p-10 text-slate-500 font-bold italic animate-pulse">
        Scanning Cohorts...
      </div>
    );

  return (
    <div className="w-full space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 italic uppercase tracking-tight">
            Cohorts & Groups
          </h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
            Manage and track participant segments
          </p>
        </div>
        <button
          onClick={() =>
            alert("Backend Create endpoint pending - Contact Nayan")
          }
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-md active:scale-95 text-sm flex items-center gap-2"
        >
          <span className="text-lg">+</span> Create New Cohort
        </button>
      </div>

      {/* SEARCH & STATS */}
      <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <input
          type="text"
          placeholder="Search groups by name or ID..."
          className="w-full md:w-96 p-2.5 border-2 border-slate-50 rounded-xl bg-slate-50 text-sm font-bold text-slate-700 focus:border-blue-200 outline-none transition-all"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
          Total Cohorts:{" "}
          <span className="text-blue-600 text-sm ml-1">{groups.length}</span>
        </div>
      </div>

      {/* GROUPS LIST */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredGroups.map((group) => (
          <div
            key={group.group_id}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between group"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl font-bold">
                  👥
                </div>
                <button
                  onClick={() => copyToClipboard(group.group_id)}
                  className="text-[10px] font-bold text-slate-400 hover:text-blue-600 bg-slate-50 px-2 py-1 rounded-lg uppercase tracking-widest transition-colors"
                >
                  Copy ID
                </button>
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">
                {group.name || "Unnamed Group"}
              </h3>
              <p className="text-xs font-medium text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                {group.description ||
                  "No description provided for this cohort."}
              </p>
            </div>

            <div className="pt-4 border-t border-slate-50 mt-4 flex justify-between items-center">
              <div className="text-[10px] font-black text-slate-400 uppercase">
                ID:{" "}
                <span className="font-mono text-slate-600">
                  {group.group_id?.substring(0, 8)}...
                </span>
              </div>
              <button className="text-blue-600 text-xs font-black uppercase hover:underline">
                View Members →
              </button>
            </div>
          </div>
        ))}

        {filteredGroups.length === 0 && (
          <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
            <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
              No Cohorts Found
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
