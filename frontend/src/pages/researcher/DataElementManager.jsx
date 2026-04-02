import React, { useState, useEffect } from "react";
import { api } from "../../services/api";

const DataElementManager = () => {
  const [elements, setElements] = useState([]);
  const [forms, setForms] = useState([]);
  const [selectedFormFields, setSelectedFormFields] = useState([]);
  const [newElement, setNewElement] = useState({
    name: "",
    unit: "",
    code: "",
    datatype: "number",
    description: "",
  });

  // Search states for both sides
  const [librarySearch, setLibrarySearch] = useState("");
  const [surveySearch, setSurveySearch] = useState("");

  const [mappedStatus, setMappedStatus] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [elData, formData] = await Promise.all([
        api.listElements(),
        api.listForms(),
      ]);
      setElements(elData || []);
      setForms(formData || []);
    } catch (err) {
      console.error("Load error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkMappings = async (fields) => {
    const statusUpdate = {};
    for (const field of fields) {
      const fId = field.field_id;
      try {
        const mapping = await api.getFieldMapping(fId);
        let activeElementId = false;

        // Grab the most recent mapping
        if (Array.isArray(mapping) && mapping.length > 0) {
          activeElementId = mapping[mapping.length - 1].element_id;
        } else if (mapping && mapping.element_id) {
          activeElementId = mapping.element_id;
        }
        statusUpdate[fId] = activeElementId;
      } catch {
        statusUpdate[fId] = false;
      }
    }
    // ⚡ SAFELY MERGE: This prevents the app from accidentally wiping out your recent clicks!
    setMappedStatus((prev) => ({ ...prev, ...statusUpdate }));
  };

  const handleCreateElement = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        code: newElement.code.trim().toLowerCase(),
        label: newElement.name.trim(),
        unit: newElement.unit.trim() || null,
        datatype: newElement.datatype,
        description: newElement.description.trim(),
      };
      const response = await api.createDataElement(payload);
      setElements((prev) => [...prev, response]);
      setNewElement({
        name: "",
        unit: "",
        code: "",
        datatype: "number",
        description: "",
      });
      alert("Added to Library!");
    } catch (err) {
      alert(err.message || "Conflict: Code already exists.");
    }
  };

  const handleDeleteElement = async (id) => {
    if (!window.confirm("Permanently delete this metric?")) return;
    try {
      await api.deleteElement(id);
      setElements((prev) =>
        prev.filter((el) => (el.element_id || el.id) !== id),
      );
    } catch (err) {
      alert("Delete failed: " + err.message);
    }
  };

  const handleSelectForm = async (fId) => {
    if (!fId) {
      setSelectedFormFields([]);
      return;
    }
    try {
      const detail = await api.getFormDetail(fId);
      const fields = detail.fields || [];
      setSelectedFormFields(fields);
      checkMappings(fields);
    } catch (err) {
      console.error("Error loading fields:", err);
    }
  };

  const handleMapField = async (fId) => {
    const elId = document.getElementById(`select-${fId}`).value;
    const ruleString = document.getElementById(`rule-${fId}`)?.value || "";
    if (!elId) return alert("Please select a standard element first.");

    let transform_rule = null;
    if (ruleString.trim() !== "") {
      try {
        transform_rule = JSON.parse(ruleString);
      } catch {
        return alert(
          'Transform rule must be valid JSON format (e.g., {"multiply": 2})',
        );
      }
    }

    // ⚡ OPTIMISTIC UPDATE: Turn it green instantly!
    setMappedStatus((prev) => ({ ...prev, [fId]: elId }));

    try {
      await api.mapField(fId, { element_id: elId, transform_rule });
    } catch (err) {
      if (err.message.includes("409") || err.message.includes("already")) {
        // It was already mapped in the DB! Just sync silently.
        checkMappings(selectedFormFields);
      } else {
        // Real error: revert to white
        setMappedStatus((prev) => ({ ...prev, [fId]: false }));
        alert("Mapping failed: " + err.message);
      }
    }
  };

  const handleUnmapField = async (fId) => {
    const elId = mappedStatus[fId];
    if (!elId) return;

    // ⚡ OPTIMISTIC UPDATE: Turn the box white instantly so you can't double-click
    setMappedStatus((prev) => ({ ...prev, [fId]: false }));

    try {
      await api.unmapField(fId, elId);
    } catch (err) {
      // If it fails (and isn't just a 404 already-deleted error), revert it back to green
      if (!err.message.includes("404")) {
        setMappedStatus((prev) => ({ ...prev, [fId]: elId }));
        alert("Unmap failed: " + err.message);
      }
    }
  };

  // Filter Logic for Library
  const filteredElements = elements.filter((el) => {
    const search = librarySearch.toLowerCase();
    return (
      (el.label || el.name || "").toLowerCase().includes(search) ||
      (el.code || "").toLowerCase().includes(search)
    );
  });

  // Filter Logic for Surveys
  const filteredForms = forms.filter((f) =>
    (f.title || "").toLowerCase().includes(surveySearch.toLowerCase()),
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto font-sans bg-slate-50 min-h-screen">
      <header className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight italic">
            Standardization Hub
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">
            Research Data Management
          </p>
        </div>
        <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg shadow-blue-100">
          {elements.length} METRICS
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT COLUMN: LIBRARY */}
        <div className="space-y-6">
          <section className="bg-white p-6 rounded-3xl border border-slate-200">
            <h2 className="text-lg font-bold mb-4 text-slate-800">
              1. Create Elements
            </h2>
            <form onSubmit={handleCreateElement} className="space-y-3">
              <input
                placeholder="Code (e.g. sleep_hrs)"
                className="w-full p-2.5 border rounded-xl text-sm font-mono bg-slate-50 focus:bg-white focus:border-blue-400 outline-none transition-all"
                value={newElement.code}
                onChange={(e) =>
                  setNewElement({ ...newElement, code: e.target.value })
                }
                required
              />
              <input
                placeholder="Friendly Name"
                className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-blue-400 outline-none transition-all"
                value={newElement.name}
                onChange={(e) =>
                  setNewElement({ ...newElement, name: e.target.value })
                }
                required
              />
              <div className="flex gap-2">
                <select
                  className="flex-1 p-2.5 border rounded-xl text-sm bg-slate-50 outline-none"
                  value={newElement.datatype}
                  onChange={(e) =>
                    setNewElement({ ...newElement, datatype: e.target.value })
                  }
                >
                  <option value="number">Number</option>
                  <option value="string">Text</option>
                </select>
                <input
                  placeholder="Unit"
                  className="w-24 p-2.5 border rounded-xl text-sm bg-slate-50 outline-none"
                  value={newElement.unit}
                  onChange={(e) =>
                    setNewElement({ ...newElement, unit: e.target.value })
                  }
                />
              </div>
              {/* Added Description Textarea */}
              <textarea
                placeholder="Metric Description"
                className="w-full p-2.5 border rounded-xl text-sm bg-slate-50 focus:bg-white focus:border-blue-400 outline-none transition-all h-20 resize-none"
                value={newElement.description}
                onChange={(e) =>
                  setNewElement({ ...newElement, description: e.target.value })
                }
              />
              <button className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-blue-700 transition active:scale-95 shadow-md">
                Add to System
              </button>
            </form>
          </section>

          <section className="bg-white rounded-3xl border border-slate-200 h-[450px] flex flex-col overflow-hidden">
            <div className="p-4 bg-slate-50 border-b">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-2 ml-1">
                Library Search
              </p>
              <input
                placeholder="Find codes or names..."
                className="w-full p-2.5 border rounded-xl text-xs bg-white shadow-inner outline-none focus:border-blue-300"
                onChange={(e) => setLibrarySearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredElements.map((el) => (
                <div
                  key={el.element_id || el.id}
                  className="flex justify-between items-center p-4 hover:bg-slate-50 rounded-2xl group transition-colors"
                >
                  <div>
                    <p className="text-[10px] font-bold text-blue-500 font-mono uppercase">
                      {el.code}
                    </p>
                    <p className="text-sm font-semibold text-slate-700">
                      {el.label || el.name}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteElement(el.element_id || el.id)}
                    className="text-[10px] font-black text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition px-2 py-1"
                  >
                    DELETE
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN: MAPPING (WITH SEARCH) */}
        <section className="bg-white p-6 rounded-3xl border border-slate-200 min-h-[800px] flex flex-col">
          <h2 className="text-lg font-bold mb-4 text-slate-800">
            2. Mapping Questions
          </h2>

          <select
            className="w-full p-4 border-2 border-slate-100 rounded-2xl bg-white font-bold text-slate-800 outline-none hover:border-blue-200 transition-colors cursor-pointer"
            onChange={(e) => handleSelectForm(e.target.value)}
          >
            <option value="" className="text-slate-400 bg-white">
              {surveySearch
                ? `Results for "${surveySearch}"...`
                : "Choose a Survey..."}
            </option>

            {/* PUBLISHED GROUP */}
            {filteredForms.filter((f) => f.status === "PUBLISHED").length >
              0 && (
              <optgroup
                label="LIVE / PUBLISHED"
                className="text-slate-400 font-bold text-[10px] uppercase tracking-widest bg-white"
              >
                {filteredForms
                  .filter((f) => f.status === "PUBLISHED")
                  .map((f) => (
                    // Light transparent blue background for published
                    <option
                      key={f.form_id}
                      value={f.form_id}
                      className="bg-blue-50 text-blue-800 font-bold py-2"
                    >
                      {f.title}
                    </option>
                  ))}
              </optgroup>
            )}

            {/* DRAFT GROUP */}
            {filteredForms.filter((f) => f.status !== "PUBLISHED").length >
              0 && (
              <optgroup
                label="DRAFTS"
                className="text-slate-400 font-bold text-[10px] uppercase tracking-widest bg-white mt-2"
              >
                {filteredForms
                  .filter((f) => f.status !== "PUBLISHED")
                  .map((f) => (
                    // Light faded gray background for drafts
                    <option
                      key={f.form_id}
                      value={f.form_id}
                      className="bg-slate-50 text-slate-500 font-medium py-2"
                    >
                      {f.title}
                    </option>
                  ))}
              </optgroup>
            )}
          </select>

          <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
            {selectedFormFields.map((field) => {
              const fId = field.field_id;
              const currentElementId = mappedStatus[fId];
              const isMapped = !!currentElementId;

              return (
                <div
                  key={fId}
                  className={`p-5 border-2 rounded-2xl mb-4 transition-all ${isMapped ? "bg-[#ecfdf5] border-emerald-300" : "bg-white border-slate-200"}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {field.label}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono uppercase mt-1">
                        {field.field_type}
                      </p>
                    </div>
                    {isMapped && (
                      <button
                        onClick={() => handleUnmapField(fId)}
                        className="text-[10px] bg-white border border-red-200 text-red-500 px-3 py-1 rounded-lg font-bold hover:bg-red-50"
                      >
                        UNMAP
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <select
                      key={
                        isMapped
                          ? `mapped-${currentElementId}`
                          : `unmapped-${fId}`
                      }
                      id={`select-${fId}`}
                      className={`flex-1 text-xs border-2 rounded-2xl p-3.5 bg-white font-bold transition-all outline-none ${
                        isMapped
                          ? "border-emerald-400 text-emerald-700"
                          : "border-slate-100 text-slate-600 focus:border-blue-400"
                      }`}
                      defaultValue={isMapped ? currentElementId : ""}
                      disabled={isMapped}
                    >
                      <option value="" disabled>
                        {isMapped
                          ? "Linked Element"
                          : "Link to Standard Element..."}
                      </option>
                      {elements.map((el) => (
                        <option
                          key={el.element_id || el.id}
                          value={el.element_id || el.id}
                        >
                          {el.code.toUpperCase()} — {el.label || el.name}
                        </option>
                      ))}
                    </select>

                    {!isMapped && (
                      <div className="flex gap-2">
                        <input
                          id={`rule-${fId}`}
                          type="text"
                          placeholder='Optional Transform Rule (e.g., {"scale": 1.5})'
                          className="flex-1 text-xs border-2 rounded-xl p-3 bg-slate-50 font-mono outline-none focus:bg-white focus:border-blue-400"
                        />
                        <button
                          onClick={() => handleMapField(fId)}
                          className="bg-blue-600 text-white px-6 rounded-xl text-xs font-black hover:bg-blue-700 transition"
                        >
                          MAP
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {selectedFormFields.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center py-20 text-slate-200">
                <span className="text-6xl mb-4">📂</span>
                <p className="font-black text-xs uppercase tracking-widest">
                  Select a survey to map
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default DataElementManager;
