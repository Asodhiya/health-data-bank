export function normalizeAvailableSurveys(surveys = []) {
  const uniqueForms = [];
  const seen = new Set();

  (surveys || []).forEach((form) => {
    const formId = String(form?.form_id || form?.id || "");
    const status = String(form?.status || "").toUpperCase();
    if (!formId || seen.has(formId) || status === "DRAFT") return;
    seen.add(formId);
    uniqueForms.push(form);
  });

  return uniqueForms.sort((a, b) =>
    String(a?.title || "").localeCompare(String(b?.title || ""), undefined, {
      sensitivity: "base",
    }),
  );
}
