// Shared helpers for data-element datatype handling.
// Canonical types: "boolean" | "text" | "date" | "integer" | "float"

export const normalizeType = (dt = "") => {
  const d = dt.toLowerCase();
  if (d === "boolean" || d === "bool") return "boolean";
  if (d === "text" || d === "string") return "text";
  if (d === "date") return "date";
  if (d === "integer" || d === "int") return "integer";
  if (["number", "float", "double", "decimal", "numeric"].includes(d)) return "float";
  return "float";
};

export const supportsUnit = (dt = "") => ["integer", "float"].includes(normalizeType(dt));

export const typeLabel = (dt) => {
  const t = normalizeType(dt);
  if (t === "integer") return "Integer";
  if (t === "float") return "Float";
  return t.charAt(0).toUpperCase() + t.slice(1);
};
