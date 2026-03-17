import { useState, useEffect } from "react";
import { api } from "../../services/api";

export default function GoalTemplates() {
  const [templates, setTemplates] = useState([]);
  const [dataElements, setDataElements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null); // null = Create, template_id = Edit

  const [formData, setFormData] = useState({
    name: "",
    description: "", // Ensure this is an empty string, not null
    element_id: "",
    default_target: 0,
  });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [templatesData, elementsData] = await Promise.all([
        api.listGoalTemplates(),
        api.listElements(),
      ]);

      // 1. Set Templates
      setTemplates(templatesData || []);

      // 2. Set Data Elements (Metrics)
      // If elementsData is an array, use it.
      // If it's an object, look for the 'elements' key which is standard in your API.
      const metricsList = Array.isArray(elementsData)
        ? elementsData
        : elementsData.elements || [];

      setDataElements(metricsList);
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Keep this in sync with fetchAllData
  const fetchInitialData = async () => {
    try {
      const [goalRes, elementRes] = await Promise.all([
        api.listGoalTemplates(),
        api.listElements(),
      ]);
      setTemplates(goalRes || []);

      const metricsList = Array.isArray(elementRes)
        ? elementRes
        : elementRes.elements || [];

      setDataElements(metricsList);
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  // Open modal for Creating
  const openCreateModal = () => {
    setEditingId(null);
    setFormData({
      name: "",
      description: "",
      element_id: "",
      default_target: 0,
    });
    setShowModal(true);
  };

  // Open modal for Editing
  const openEditModal = (template) => {
    setEditingId(template.template_id);
    setFormData({
      name: template.name || "",
      description: template.description || "",
      // 🟢 We use template.element_id directly from the JSON root
      element_id: template.element_id || "",
      default_target: template.default_target || 0,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        // Double check: are we sending element_id in this object?
        console.log("Updating template with data:", formData);
        await api.updateGoalTemplate(editingId, formData);
      } else {
        await api.createGoalTemplate(formData);
      }
      setShowModal(false);
      fetchAllData(); // Refresh everything
    } catch (err) {
      alert("Update failed: " + err.message);
    }
  };

  const handleDelete = async (template_id) => {
    if (!window.confirm("Are you sure you want to delete this goal template?"))
      return;
    try {
      await api.deleteGoalTemplate(template_id);
      fetchAllData();
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  if (loading)
    return (
      <div className="p-10 font-bold text-slate-400 animate-pulse">
        Loading...
      </div>
    );

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 italic uppercase">
            Health Goal Templates
          </h1>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
            Define goals for participants to track
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition-all active:scale-95 text-sm"
        >
          + Create Template
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((t) => (
          <div
            key={t.template_id}
            className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow"
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase">
                  {t.is_active ? "Active" : "Inactive"}
                </span>
                <div className="flex gap-2">
                  {/* EDIT BUTTON */}
                  <button
                    onClick={() => openEditModal(t)}
                    className="text-slate-300 hover:text-blue-600 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  {/* DELETE BUTTON */}
                  <button
                    onClick={() => handleDelete(t.template_id)}
                    className="text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">
                {t.name}
              </h3>
              <p className="text-xs font-medium text-slate-500 line-clamp-2 mb-4 leading-relaxed">
                {t.description}
              </p>
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase text-slate-400">
                  Metric:{" "}
                  <span className="text-blue-600">
                    {dataElements.find((el) => el.element_id === t.element_id)
                      ?.label ||
                      t.element?.label ||
                      "Unknown"}
                  </span>
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-50 mt-auto">
              <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
                <span>Default Target:</span>
                <span className="text-blue-600 text-sm">
                  {t.default_target}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl">
            <h2 className="text-xl font-black text-slate-800 mb-6 uppercase italic">
              {editingId ? "Edit Goal Template" : "New Goal Template"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Goal Name
                </label>
                <input
                  required
                  type="text"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-bold text-sm"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Linked Data Element
                </label>
                <select
                  required
                  className="w-full p-3 bg-white border-2 border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-blue-400"
                  style={{ color: "#000000", backgroundColor: "#ffffff" }} // Force black text on white background
                  value={formData.element_id}
                  onChange={(e) =>
                    setFormData({ ...formData, element_id: e.target.value })
                  }
                >
                  <option value="" style={{ color: "#64748b" }}>
                    Select a Health Metric...
                  </option>
                  {dataElements.map((el) => (
                    <option
                      key={el.element_id}
                      value={el.element_id}
                      style={{ color: "#1e293b", backgroundColor: "#ffffff" }} // Slate-800 text
                    >
                      {String(el.label)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Default Target
                </label>
                <input
                  required
                  type="number"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-bold text-sm"
                  value={formData.default_target}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      default_target: parseInt(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase ml-1">
                  Description
                </label>
                <textarea
                  rows="3"
                  className="w-full p-3 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-blue-400 font-bold text-sm"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 p-3 text-sm font-bold text-slate-400 uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 p-3 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg uppercase"
                >
                  {editingId ? "Save Changes" : "Create Goal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
