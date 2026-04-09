import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { api } from "../../services/api";
import { LANGUAGES } from "../../utils/formOptions";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const PAGE_SIZE = 10;
const DEMOGRAPHIC_COLUMNS = [
  { id: "gender", text: "Gender" },
  { id: "pronouns", text: "Pronouns" },
  { id: "primary_language", text: "Primary Language" },
  { id: "occupation_status", text: "Occupation / Status" },
  { id: "living_arrangement", text: "Living Arrangement" },
  { id: "highest_education_level", text: "Highest Education Level" },
  { id: "dependents", text: "Dependents" },
  { id: "marital_status", text: "Marital Status" },
  { id: "age", text: "Age" },
];
const DEMOGRAPHIC_COLUMN_IDS = new Set(DEMOGRAPHIC_COLUMNS.map((column) => column.id));
const META_COLUMN_IDS = new Set(["observed_at", "source_type", "source_submission_id"]);
const CHART_COLORS = ["#3b82f6", "#10b981", "#6366f1"];
const HIDDEN_SYSTEM_COLUMN_IDS = new Set(["source_submission_id", "group_value"]);
const TEXT_DEMOGRAPHIC_FIELDS = [
  { value: "gender", label: "Gender" },
  { value: "pronouns", label: "Pronouns" },
  { value: "primary_language", label: "Primary Language" },
  { value: "occupation_status", label: "Occupation" },
  { value: "living_arrangement", label: "Living Arrangement" },
  { value: "highest_education_level", label: "Education" },
  { value: "marital_status", label: "Marital Status" },
  { value: "status", label: "Status" },
];
const NUMERIC_DEMOGRAPHIC_FIELDS = [
  { value: "age", label: "Age" },
  { value: "dependents", label: "Dependents" },
];
const ALL_DEMOGRAPHIC_FIELDS = [...TEXT_DEMOGRAPHIC_FIELDS, ...NUMERIC_DEMOGRAPHIC_FIELDS];
const DEMOGRAPHIC_VALUE_OPTIONS = {
  gender: ["Male", "Female", "Other"],
  pronouns: ["He/Him", "She/Her", "They/Them", "Other"],
  primary_language: LANGUAGES,
  occupation_status: [
    "Student",
    "Full-time",
    "Part-time",
    "Less than 10 hrs/week",
    "Unemployed",
    "Don't work",
    "Retired",
    "Other",
  ],
  living_arrangement: [
    "Alone",
    "With Partner",
    "With Family",
    "With Friends",
    "Shared Housing",
    "Other",
  ],
  highest_education_level: [
    "High school",
    "Some college/university",
    "Trade/vocational",
    "Bachelor's degree",
    "Graduate degree",
    "Other",
  ],
  marital_status: [
    "Single",
    "Married",
    "Common-law",
    "Separated",
    "Divorced",
    "Widowed",
    "Other",
  ],
  status: ["Active", "Inactive"],
};

function isNumericDemographicField(field) {
  return NUMERIC_DEMOGRAPHIC_FIELDS.some((option) => option.value === field);
}

function getDemographicOperators(field) {
  if (field === "age") {
    return [
      { value: "eq", label: "=" },
      { value: "gt", label: ">" },
      { value: "gte", label: ">=" },
      { value: "lt", label: "<" },
      { value: "lte", label: "<=" },
      { value: "between", label: "Between" },
    ];
  }
  return [{ value: "eq", label: "=" }];
}

function needsDemographicOperator(field) {
  return field === "age";
}

function hasPredefinedDemographicOptions(field) {
  return Array.isArray(DEMOGRAPHIC_VALUE_OPTIONS[field]) && DEMOGRAPHIC_VALUE_OPTIONS[field].length > 0;
}

function getDemographicFieldLabel(field) {
  return ALL_DEMOGRAPHIC_FIELDS.find((option) => option.value === field)?.label || "Value";
}

function getParticipantMarker(participantNumber) {
  if (!participantNumber) return "Participant";
  return `Participant ${participantNumber}`;
}

function formatObservedAt(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function getGroupByLabel(groupBy) {
  if (!groupBy) return "Group";
  if (groupBy?.type === "element") return "Data Element";
  const labels = {
    gender: "Gender",
    pronouns: "Pronouns",
    primary_language: "Primary Language",
    occupation_status: "Occupation",
    living_arrangement: "Living Arrangement",
    highest_education_level: "Education",
    marital_status: "Marital Status",
    age_bucket: "Age Range",
  };
  return labels[groupBy?.field] || "Group";
}

function isCategoricalElement(element) {
  const datatype = String(element?.datatype || "").trim().toLowerCase();
  return ["text", "string", "boolean", "bool", "choice", "select", "option", "categorical"].includes(datatype);
}

function createDefaultFilters() {
  return {
    survey_id: "",
    group_ids: [],
    source_types: ["survey", "goal"],
    allow_null: true,
    mode: "aggregate",
    group_by: null,
    search: "",
    date_from: "",
    date_to: "",
    selected_element_ids: [],
    demographic_filters: [],
    element_filters: [],
    sort_by: null,
    sort_dir: "asc",
  };
}

function createElementFilterDraft() {
  return {
    element_id: "",
    operator: "gte",
    value: "",
    value_max: "",
  };
}

function createDemographicFilterDraft() {
  return {
    field: "gender",
    operator: "eq",
    value: "",
    value_max: "",
  };
}

function createDefaultExportConfig() {
  return {
    filename: `research_export_${new Date().toISOString().split("T")[0]}`,
    type: "csv",
  };
}

function normalizeElementFilters(filters) {
  const seen = new Set();
  return [...(filters || [])]
    .reverse()
    .filter((filter) => {
      const key = String(filter.element_id || "");
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .reverse();
}

function uniqueIds(values) {
  const seen = new Set();
  return (values || []).filter((value) => {
    const key = String(value || "");
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function ResearcherDashboard() {
  const { user } = useOutletContext() || {};

  const [draftFilters, setDraftFilters] = useState(createDefaultFilters);
  const [appliedFilters, setAppliedFilters] = useState(createDefaultFilters);
  const [queryData, setQueryData] = useState({ columns: DEMOGRAPHIC_COLUMNS, data: [] });
  const [pagination, setPagination] = useState({
    offset: 0,
    limit: PAGE_SIZE,
    returned_participants: 0,
    total_participants: 0,
    has_more: false,
    next_offset: 0,
  });
  const [availableSurveys, setAvailableSurveys] = useState([]);
  const [availableElements, setAvailableElements] = useState([]);
  const [allGroups, setAllGroups] = useState([]);
  const [allForms, setAllForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filterError, setFilterError] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportConfig, setExportConfig] = useState(createDefaultExportConfig);
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showElementMenu, setShowElementMenu] = useState(false);
  const [elementSearch, setElementSearch] = useState("");
  const [elementDraft, setElementDraft] = useState(createElementFilterDraft);
  const [editingElementId, setEditingElementId] = useState(null);
  const [demographicDraft, setDemographicDraft] = useState(createDemographicFilterDraft);
  const [editingDemographicField, setEditingDemographicField] = useState(null);
  const [viewMode, setViewMode] = useState("table");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: "asc" });

  const groupMenuRef = useRef(null);
  const elementMenuRef = useRef(null);
  const loadResultsRef = useRef(null);

  const numericElements = useMemo(
    () =>
      (availableElements || []).filter(
        (element) => String(element.datatype || "number").toLowerCase() === "number",
      ),
    [availableElements],
  );

  const participantMarkerMap = useMemo(() => {
    const markers = new Map();
    let nextNumber = 1;
    for (const row of queryData.data || []) {
      const participantId = row?._participant_id;
      if (!participantId || markers.has(participantId)) continue;
      markers.set(participantId, nextNumber);
      nextNumber += 1;
    }
    return markers;
  }, [queryData.data]);

  const surveyOptions = useMemo(() => {
    const sourceForms = allForms.length > 0 ? allForms : availableSurveys;
    const uniqueForms = [];
    const seen = new Set();

    sourceForms.forEach((form) => {
      const formId = String(form.form_id || form.id || "");
      const status = String(form.status || "").toUpperCase();
      if (!formId || seen.has(formId) || status === "DRAFT") return;
      seen.add(formId);
      uniqueForms.push(form);
    });

    return uniqueForms.sort((a, b) =>
      String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" }),
    );
  }, [allForms, availableSurveys]);

  const groupByOptions = useMemo(() => {
    const options = [
      { value: "demographic:gender", label: "Gender" },
      { value: "demographic:pronouns", label: "Pronouns" },
      { value: "demographic:primary_language", label: "Primary Language" },
      { value: "demographic:occupation_status", label: "Occupation" },
      { value: "demographic:living_arrangement", label: "Living Arrangement" },
      { value: "demographic:highest_education_level", label: "Education" },
      { value: "demographic:marital_status", label: "Marital Status" },
      { value: "demographic:age_bucket", label: "Age Range" },
    ];

    const seen = new Set(options.map((option) => option.value));
    (draftFilters.element_filters || []).forEach((filter) => {
      const elementId = String(filter.element_id || "");
      if (!elementId) return;
      const optionValue = `element:${elementId}`;
      if (seen.has(optionValue)) return;
      const element = (availableElements || []).find(
        (candidate) => String(candidate.element_id) === elementId,
      );
      if (!isCategoricalElement(element)) return;
      options.push({
        value: optionValue,
        label: element ? `${element.label}${element.unit ? ` (${element.unit})` : ""}` : "Data Element",
      });
      seen.add(optionValue);
    });

    return options;
  }, [draftFilters.element_filters, availableElements]);

  const appliedGroupByLabel = useMemo(
    () => {
      const currentValue =
        appliedFilters.group_by?.type === "demographic"
          ? `demographic:${appliedFilters.group_by.field}`
          : appliedFilters.group_by?.type === "element"
            ? `element:${appliedFilters.group_by.element_id}`
            : "";
      return groupByOptions.find((option) => option.value === currentValue)?.label || getGroupByLabel(appliedFilters.group_by);
    },
    [appliedFilters.group_by, groupByOptions],
  );

  const draftGroupByValue = useMemo(() => {
    if (!draftFilters.group_by) return "";
    if (draftFilters.group_by.type === "demographic") {
      return `demographic:${draftFilters.group_by.field}`;
    }
    if (draftFilters.group_by.type === "element") {
      return `element:${draftFilters.group_by.element_id}`;
    }
    return "";
  }, [draftFilters.group_by]);

  const prioritizedElementColumnIds = useMemo(
    () =>
      !appliedFilters.survey_id
        ? (appliedFilters.element_filters || [])
            .map((filter) => String(filter.element_id || ""))
            .filter(Boolean)
        : [],
    [appliedFilters.element_filters, appliedFilters.survey_id],
  );

  const selectedElementFilters = useMemo(
    () => (draftFilters.element_filters || []).filter((filter) => filter.element_id),
    [draftFilters.element_filters],
  );

  const showAllowNullToggle = useMemo(
    () =>
      !draftFilters.survey_id ||
      (draftFilters.element_filters || []).length > 0 ||
      (appliedFilters.element_filters || []).length > 0,
    [draftFilters.survey_id, draftFilters.element_filters, appliedFilters.element_filters],
  );

  const selectedGroups = useMemo(
    () =>
      (draftFilters.group_ids || [])
        .map((groupId) =>
          allGroups.find((group) => String(group.group_id || group.id) === String(groupId)),
        )
        .filter(Boolean),
    [draftFilters.group_ids, allGroups],
  );

  const availableElementChoices = useMemo(() => {
    const selectedIds = new Set(selectedElementFilters.map((filter) => String(filter.element_id)));
    const searchTerm = elementSearch.trim().toLowerCase();

    return numericElements.filter((element) => {
      if (selectedIds.has(String(element.element_id))) return false;
      if (!searchTerm) return true;
      const label = `${element.label || ""} ${element.unit || ""}`.toLowerCase();
      return label.includes(searchTerm);
    });
  }, [numericElements, selectedElementFilters, elementSearch]);

  const orderedColumns = useMemo(() => {
    const columns = [...(queryData.columns || [])].filter(
      (column) => !HIDDEN_SYSTEM_COLUMN_IDS.has(column.id),
    );
    if (prioritizedElementColumnIds.length === 0) return columns;

    const prioritySet = new Set(prioritizedElementColumnIds);
    const demographics = [];
    const remaining = [];
    const prioritized = [];

    columns.forEach((column) => {
      if (DEMOGRAPHIC_COLUMN_IDS.has(column.id)) demographics.push(column);
      else if (prioritySet.has(column.id)) prioritized.push(column);
      else remaining.push(column);
    });

    return [...demographics, ...remaining, ...prioritized];
  }, [queryData.columns, prioritizedElementColumnIds]);

  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => !hiddenColumns.includes(column.id)),
    [orderedColumns, hiddenColumns],
  );

  const loadedParticipantCount = useMemo(() => {
    if (appliedFilters.group_by) {
      return queryData.data.length;
    }
    return new Set(queryData.data.map((row) => row._participant_id).filter(Boolean)).size;
  }, [appliedFilters.group_by, queryData.data]);

  const stats = useMemo(() => {
    const selectedCount = draftFilters.group_ids.length;
    const selectedGroupName = selectedGroups[0]?.name || null;
    const totalGroupCount = allGroups.length;
    return {
      totalParticipants: pagination.total_participants,
      filteredResults: queryData.data.length,
      activeGroupsText:
        selectedGroupName
          ? selectedGroupName
          : totalGroupCount > 0
            ? `All (${totalGroupCount})`
            : "All participants",
      isGroupFiltered: selectedCount > 0,
    };
  }, [draftFilters.group_ids, selectedGroups, allGroups.length, pagination.total_participants, queryData.data.length]);

  const chartData = useMemo(() => {
    const genderCounts = { Male: 0, Female: 0 };
    const ageBuckets = { "Under 25": 0, "26-35": 0, "36-50": 0, "51+": 0 };

    queryData.data.forEach((row) => {
      const gender = row.gender || "";
      if (genderCounts[gender] !== undefined) genderCounts[gender] += 1;
      const age = row.age;
      if (typeof age === "number") {
        if (age <= 25) ageBuckets["Under 25"] += 1;
        else if (age <= 35) ageBuckets["26-35"] += 1;
        else if (age <= 50) ageBuckets["36-50"] += 1;
        else ageBuckets["51+"] += 1;
      }
    });

    return {
      gender: [
        { name: "Male", value: genderCounts.Male },
        { name: "Female", value: genderCounts.Female },
      ].filter((entry) => entry.value > 0),
      age: Object.keys(ageBuckets).map((name) => ({ name, count: ageBuckets[name] })),
    };
  }, [queryData.data]);

  const demographicFilterSummaries = useMemo(
    () =>
      (draftFilters.demographic_filters || []).map((filter, index) => {
        const label = getDemographicFieldLabel(filter.field);
        if (filter.operator === "between" && filter.value_max !== "") {
          return {
            key: `${filter.field}-${index}`,
            text: `${label}: ${filter.value} to ${filter.value_max}`,
          };
        }
        return {
          key: `${filter.field}-${index}`,
          text: `${label}: ${filter.value}`,
        };
      }),
    [draftFilters.demographic_filters],
  );

  const buildResearcherPayload = (filters, offset = 0, limit = PAGE_SIZE) => {
    const demographicFilters = (filters.demographic_filters || [])
      .filter((filter) => filter.field && filter.operator && filter.value !== "")
      .map((filter) => ({
        field: filter.field,
        operator: filter.operator,
        value: String(filter.value),
        ...(filter.operator === "between" && filter.value_max !== ""
          ? { value_max: String(filter.value_max) }
          : {}),
      }));

    const explicitSelectedElementIds = uniqueIds(filters.selected_element_ids || []);
    const selectedElements = uniqueIds([
      ...explicitSelectedElementIds,
      ...(filters.element_filters || []).map((filter) => filter.element_id).filter(Boolean),
    ]).map((elementId) => {
      const matchingFilter = (filters.element_filters || []).find(
        (filter) => String(filter.element_id) === String(elementId),
      );
      return {
        element_id: elementId,
        source_types:
          matchingFilter?.source_types && matchingFilter.source_types.length > 0
            ? matchingFilter.source_types
            : filters.source_types && filters.source_types.length > 0
              ? filters.source_types
              : ["survey", "goal"],
      };
    });
    const selectedElementIds = selectedElements.map((filter) => filter.element_id);

    const elementFilters = (filters.element_filters || [])
      .flatMap((filter) => {
        if (!filter.element_id || !filter.operator) return [];

        const sourceTypes =
          filter.source_types && filter.source_types.length > 0
            ? filter.source_types
            : ["survey", "goal"];

        if (["has_value", "is_empty"].includes(filter.operator)) {
          return [
            {
              element_id: filter.element_id,
              operator: filter.operator,
              source_types: sourceTypes,
            },
          ];
        }

        if (filter.value === "") {
          return [];
        }

        return [
          {
            element_id: filter.element_id,
            operator: filter.operator,
            value: Number(filter.value),
            ...(filter.operator === "between" && filter.value_max !== ""
              ? { value_max: Number(filter.value_max) }
              : {}),
            source_types: sourceTypes,
          },
        ];
      });

    const payload = {
      ...filters,
      group_ids: filters.group_ids || [],
      demographic_filters: demographicFilters,
      selected_elements: selectedElements,
      selected_element_ids: selectedElementIds,
      element_filters: elementFilters,
      search: String(filters.search || "").trim() || undefined,
      group_by: filters.group_by || undefined,
      sort_by: filters.sort_by || undefined,
      sort_dir: filters.sort_dir || "asc",
      offset,
      limit,
    };

    Object.keys(payload).forEach((key) => {
      if (payload[key] === "") delete payload[key];
    });

    return payload;
  };

  const loadResults = async ({ reset = false, filters = appliedFilters, offset = 0, limit = PAGE_SIZE, updateApplied = false } = {}) => {
    const payload = buildResearcherPayload(filters, offset, limit);

    if (reset) {
      setFiltering(true);
      setFilterError(false);
    } else {
      setLoadingMore(true);
    }

    try {
      const response = filters.group_by
        ? await api.getResearcherResultsGrouped(payload)
        : await api.getResearcherResults(payload);
      const columns = response.columns || DEMOGRAPHIC_COLUMNS;
      const rows = response.data || [];
      const responsePagination = response.pagination || {
        offset,
        limit,
        returned_participants: rows.length,
        total_participants: rows.length,
        has_more: false,
        next_offset: offset + rows.length,
      };

      if (updateApplied) setAppliedFilters(filters);
      setSortConfig({
        key: filters.sort_by || null,
        direction: filters.sort_dir || "asc",
      });
      setFilterError(false);
      setPagination(responsePagination);
      setQueryData((prev) => ({
        columns,
        data: reset ? rows : [...prev.data, ...rows],
      }));
    } catch (error) {
      console.error(reset ? "Filter Error:" : "Load More Error:", error);
      if (reset) {
        setFilterError(true);
        setPagination({
          offset: 0,
          limit: PAGE_SIZE,
          returned_participants: 0,
          total_participants: 0,
          has_more: false,
          next_offset: 0,
        });
        setQueryData({ columns: DEMOGRAPHIC_COLUMNS, data: [] });
      }
    } finally {
      if (reset) setFiltering(false);
      else setLoadingMore(false);
    }
  };

  loadResultsRef.current = loadResults;

  useEffect(() => {
    if (prioritizedElementColumnIds.length === 0) return;
    setHiddenColumns((prev) => prev.filter((columnId) => !prioritizedElementColumnIds.includes(columnId)));
  }, [prioritizedElementColumnIds]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (groupMenuRef.current && !groupMenuRef.current.contains(event.target)) {
        setShowGroupMenu(false);
      }
      if (elementMenuRef.current && !elementMenuRef.current.contains(event.target)) {
        setShowElementMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const loadMeta = async () => {
      setLoading(true);
      try {
        const [surveys, elements, groups, forms] = await Promise.all([
          api.getAvailableSurveys().catch(() => []),
          api.listElements().catch(() => []),
          api.listGroups().catch(() => []),
          api.listForms().catch(() => []),
        ]);

        setAvailableSurveys(surveys || []);
        setAvailableElements(elements || []);
        setAllGroups(groups || []);
        setAllForms(forms || []);
      } finally {
        setLoading(false);
      }
    };

    loadMeta().then(() => {
      loadResultsRef.current({
        reset: true,
        filters: createDefaultFilters(),
        updateApplied: true,
      });
    });
  }, []);

  const selectedSurvey = useMemo(
    () =>
      allForms.find((form) => String(form.form_id || form.id || "") === String(draftFilters.survey_id || "")) ||
      availableSurveys.find((form) => String(form.form_id || form.id || "") === String(draftFilters.survey_id || "")) ||
      null,
    [allForms, availableSurveys, draftFilters.survey_id],
  );

  const surveyGroupMismatch = useMemo(() => {
    if (!draftFilters.survey_id || draftFilters.group_ids.length === 0) return false;
    const deployedGroupIds = new Set((selectedSurvey?.deployed_group_ids || []).map(String));
    if (deployedGroupIds.size === 0) return false;
    return !draftFilters.group_ids.some((groupId) => deployedGroupIds.has(String(groupId)));
  }, [draftFilters.survey_id, draftFilters.group_ids, selectedSurvey]);

  const handleSort = (key) => {
    const nextSort =
      sortConfig.key !== key
        ? { key, direction: "asc" }
        : sortConfig.direction === "asc"
          ? { key, direction: "desc" }
          : { key: null, direction: "asc" };

    const nextFilters = {
      ...appliedFilters,
      sort_by: nextSort.key,
      sort_dir: nextSort.direction,
    };
    setDraftFilters(nextFilters);
    setQueryData((prev) => ({ ...prev, data: [] }));
    setPagination((prev) => ({ ...prev, offset: 0, next_offset: 0 }));
    loadResultsRef.current({
      reset: true,
      filters: nextFilters,
      updateApplied: true,
    });
  };

  const applyFilters = () => {
    loadResultsRef.current({
      reset: true,
      filters: draftFilters,
      updateApplied: true,
    });
  };

  const resetFilters = () => {
    const nextFilters = createDefaultFilters();
    setDraftFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setElementDraft(createElementFilterDraft());
    setDemographicDraft(createDemographicFilterDraft());
    setElementSearch("");
    setShowElementMenu(false);
    setHiddenColumns([]);
    loadResultsRef.current({
      reset: true,
      filters: nextFilters,
      updateApplied: true,
    });
  };

  const toggleColumn = (columnId) => {
    const baseElementId = String(columnId || "").split("__")[0];
    const isHealthDataElement = (availableElements || []).some(
      (element) => String(element.element_id) === baseElementId,
    );

    if (isHealthDataElement) {
      const scopedElementIds = uniqueIds(
        (orderedColumns || [])
          .map((column) => {
            const elementId = String(column.id || "").split("__")[0];
            return (availableElements || []).some(
              (element) => String(element.element_id) === elementId,
            )
              ? elementId
              : null;
          })
          .filter(Boolean),
      );

      let nextFilters = null;
      setDraftFilters((prev) => {
        const remainingElementFilters = prev.element_filters.filter(
          (filter) => String(filter.element_id) !== baseElementId,
        );
        const remainingExplicitIds = scopedElementIds.filter(
          (elementId) =>
            elementId !== baseElementId &&
            !remainingElementFilters.some(
              (filter) => String(filter.element_id) === String(elementId),
            ),
        );

        nextFilters = {
          ...prev,
          selected_element_ids: remainingExplicitIds,
          element_filters: remainingElementFilters,
        };
        return nextFilters;
      });

      setHiddenColumns((prev) =>
        prev.filter((id) => String(id || "").split("__")[0] !== baseElementId),
      );

      if (String(editingElementId || "") === baseElementId) {
        setElementDraft(createElementFilterDraft());
        setEditingElementId(null);
      }

      if (nextFilters) {
        loadResultsRef.current({
          reset: true,
          filters: nextFilters,
          updateApplied: true,
        });
      }
      return;
    }

    setHiddenColumns((prev) =>
      prev.includes(columnId) ? prev.filter((id) => id !== columnId) : [...prev, columnId],
    );
  };

  const addElementFilterById = (elementId) => {
    if (!elementId) return;
    const existing = (draftFilters.element_filters || []).find(
      (filter) => String(filter.element_id) === String(elementId),
    );
    if (existing) {
      setElementDraft({
        element_id: String(existing.element_id || ""),
        operator: existing.operator || "gte",
        value: existing.value ?? "",
        value_max: existing.value_max ?? "",
      });
      setEditingElementId(String(elementId));
    } else {
      setElementDraft((prev) => ({
        ...prev,
        element_id: elementId,
      }));
      setEditingElementId(null);
    }
    setElementSearch("");
    setShowElementMenu(false);
  };

  const removeElementFilterById = (elementId) => {
    let nextFilters = null;
    setDraftFilters((prev) => {
      nextFilters = {
        ...prev,
        element_filters: prev.element_filters.filter(
          (filter) => String(filter.element_id) !== String(elementId),
        ),
      };
      return nextFilters;
    });
    if (String(editingElementId || "") === String(elementId)) {
      setElementDraft(createElementFilterDraft());
      setEditingElementId(null);
    }
    if (nextFilters) {
      loadResultsRef.current({
        reset: true,
        filters: nextFilters,
        updateApplied: true,
      });
    }
  };

  const editElementFilterById = (elementId) => {
    const existing = (draftFilters.element_filters || []).find(
      (filter) => String(filter.element_id) === String(elementId),
    );
    if (!existing) return;
    setElementDraft({
      element_id: String(existing.element_id || ""),
      operator: existing.operator || "gte",
      value: existing.value ?? "",
      value_max: existing.value_max ?? "",
    });
    setEditingElementId(String(elementId));
    setShowElementMenu(false);
    setElementSearch("");
  };

  const updateElementDraft = (key, value) => {
    setElementDraft((prev) => {
      if (key === "operator") {
        const isPresenceOperator = ["has_value", "is_empty"].includes(value);
        return {
          ...prev,
          operator: value,
          value: isPresenceOperator ? "" : prev.value,
          value_max: value === "between" ? prev.value_max : "",
        };
      }
      return { ...prev, [key]: value };
    });
  };

  const addElementFilter = () => {
    if (!elementDraft.element_id) return;

    let nextFilters = null;
    setDraftFilters((prev) => {
      const nextFilter = {
        ...elementDraft,
        source_types:
          prev.source_types && prev.source_types.length > 0
            ? prev.source_types
            : ["survey", "goal"],
      };
      const existingIndex = prev.element_filters.findIndex(
        (filter) => String(filter.element_id) === String(nextFilter.element_id),
      );
      if (existingIndex >= 0) {
        nextFilters = {
          ...prev,
          element_filters: normalizeElementFilters(prev.element_filters.map((filter, index) =>
            index === existingIndex ? nextFilter : filter,
          )),
        };
        return nextFilters;
      }
      nextFilters = {
        ...prev,
        element_filters: normalizeElementFilters([...prev.element_filters, nextFilter]),
      };
      return nextFilters;
    });
    setElementDraft(createElementFilterDraft());
    setEditingElementId(null);
    setElementSearch("");
    if (nextFilters) {
      loadResultsRef.current({
        reset: true,
        filters: nextFilters,
        updateApplied: true,
      });
    }
  };

  const addDemographicFilter = () => {
    if (demographicDraft.value === "") return;
    let nextFilters = null;
    setDraftFilters((prev) => {
      const nextFilter = { ...demographicDraft };
      const existingIndex = prev.demographic_filters.findIndex(
        (filter) => String(filter.field) === String(nextFilter.field),
      );
      if (existingIndex >= 0) {
        nextFilters = {
          ...prev,
          demographic_filters: prev.demographic_filters.map((filter, index) =>
            index === existingIndex ? nextFilter : filter,
          ),
        };
        return nextFilters;
      }
      nextFilters = {
        ...prev,
        demographic_filters: [...prev.demographic_filters, nextFilter],
      };
      return nextFilters;
    });
    setDemographicDraft(createDemographicFilterDraft());
    setEditingDemographicField(null);
    if (nextFilters) {
      loadResultsRef.current({
        reset: true,
        filters: nextFilters,
        updateApplied: true,
      });
    }
  };

  const updateDemographicDraft = (key, value) => {
    setDemographicDraft((prev) => {
      if (key === "field") {
        return {
          field: value,
          operator: "eq",
          value: "",
          value_max: "",
        };
      }
      if (key === "operator") {
        return {
          ...prev,
          operator: value,
          value_max: value === "between" ? prev.value_max : "",
        };
      }
      return { ...prev, [key]: value };
    });
  };

  const removeDemographicFilter = (index) => {
    let nextFilters = null;
    setDraftFilters((prev) => {
      nextFilters = {
        ...prev,
        demographic_filters: prev.demographic_filters.filter((_, filterIndex) => filterIndex !== index),
      };
      return nextFilters;
    });
    const removedField = draftFilters.demographic_filters[index]?.field;
    if (removedField && String(editingDemographicField || "") === String(removedField)) {
      setDemographicDraft(createDemographicFilterDraft());
      setEditingDemographicField(null);
    }
    if (nextFilters) {
      loadResultsRef.current({
        reset: true,
        filters: nextFilters,
        updateApplied: true,
      });
    }
  };

  const editDemographicFilter = (index) => {
    const existing = (draftFilters.demographic_filters || [])[index];
    if (!existing) return;
    setDemographicDraft({
      field: existing.field || "gender",
      operator: existing.operator || "eq",
      value: existing.value ?? "",
      value_max: existing.value_max ?? "",
    });
    setEditingDemographicField(String(existing.field || ""));
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const payload = buildResearcherPayload(appliedFilters, 0, PAGE_SIZE);
      delete payload.limit;
      delete payload.offset;
      const trimmedName = (exportConfig.filename || "").trim() || createDefaultExportConfig().filename;
      const downloadName = `${trimmedName}.${exportConfig.type}`;
      if (appliedFilters.group_by) {
        if (exportConfig.type === "xlsx") {
          await api.downloadResearcherResultsGroupedExcel(payload, hiddenColumns, downloadName);
        } else {
          await api.downloadResearcherResultsGrouped(payload, hiddenColumns, downloadName);
        }
      } else {
        if (exportConfig.type === "xlsx") {
          await api.downloadResearcherResultsExcel(payload, hiddenColumns, downloadName);
        } else {
          await api.downloadResearcherResults(payload, hiddenColumns, downloadName);
        }
      }
      setShowExportModal(false);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome, {user?.first_name || "Researcher"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Review participant demographics and survey-linked health data in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <button
            type="button"
            onClick={() => {
              setExportConfig(createDefaultExportConfig());
              setShowExportModal(true);
            }}
            disabled={isExporting || filtering}
            className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              isExporting || filtering
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-blue-700 text-white hover:bg-blue-800"
            }`}
          >
            {isExporting ? "Exporting..." : "Export"}
          </button>
        </div>
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Export results</h2>
                <p className="mt-1 text-sm text-slate-500">Choose the file name and format for this download.</p>
              </div>
              <button
                type="button"
                onClick={() => !isExporting && setShowExportModal(false)}
                className="text-slate-400 transition hover:text-slate-600"
                aria-label="Close export dialog"
              >
                ×
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">File name</label>
                <input
                  type="text"
                  value={exportConfig.filename}
                  onChange={(event) =>
                    setExportConfig((prev) => ({ ...prev, filename: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
                  placeholder="research_export"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">File type</label>
                <select
                  value={exportConfig.type}
                  onChange={(event) =>
                    setExportConfig((prev) => ({ ...prev, type: event.target.value }))
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="csv">CSV</option>
                  <option value="xlsx">Excel (.xlsx)</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowExportModal(false)}
                disabled={isExporting}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting}
                className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                  isExporting
                    ? "cursor-not-allowed bg-slate-200 text-slate-500"
                    : "bg-blue-700 text-white hover:bg-blue-800"
                }`}
              >
                {isExporting ? "Exporting..." : "Download"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2a3 3 0 00-5.356-1.857M15 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total participants</p>
            <p className="text-2xl font-bold text-slate-900">{stats.totalParticipants}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v12a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Filtered results</p>
            <p className="text-2xl font-bold text-slate-900">{stats.filteredResults} Rows</p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className={`flex h-12 w-12 items-center justify-center rounded-full ${stats.isGroupFiltered ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Active groups</p>
            <p className="text-2xl font-bold text-slate-900">{stats.activeGroupsText}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
          <div className="rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${viewMode === "table" ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              📋 Raw Data Table
            </button>
            <button
              type="button"
              onClick={() => setViewMode("charts")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${viewMode === "charts" ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
            >
              📊 Analytics & Charts
            </button>
          </div>
        </div>

        {filterError && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <svg className="h-4 w-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>We couldn't apply the current filters. Please review the inputs and try again.</span>
          </div>
        )}

        <div className="border-b border-slate-100 bg-white px-6 py-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              {(queryData.columns || [])
                .filter((column) => !HIDDEN_SYSTEM_COLUMN_IDS.has(column.id))
                .map((column) => {
                  const hidden = hiddenColumns.includes(column.id);
                  return (
                    <button
                      key={column.id}
                      type="button"
                      onClick={() => toggleColumn(column.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        hidden
                          ? "border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-600"
                          : "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100"
                      }`}
                      title={hidden ? "Show column" : "Hide column"}
                    >
                      <span>{column.text || column.id}</span>
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] leading-none ${
                          hidden ? "bg-slate-100 text-slate-500" : "bg-white text-blue-700"
                        }`}
                      >
                        {hidden ? "+" : "x"}
                      </span>
                    </button>
                  );
                })}
            </div>

            {showAllowNullToggle && (
              <div className="lg:max-w-xs lg:pl-4">
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    checked={draftFilters.allow_null}
                    onChange={(event) => {
                      const nextFilters = { ...draftFilters, allow_null: event.target.checked };
                      setDraftFilters(nextFilters);
                      loadResultsRef.current({
                        reset: true,
                        filters: nextFilters,
                        updateApplied: true,
                      });
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <div>
                    <span className="text-sm font-medium text-slate-700">
                      Include missing element data
                    </span>
                    {draftFilters.survey_id ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Applies to the selected health-data elements and filters in this survey view.
                      </p>
                    ) : null}
                    {!draftFilters.allow_null && (
                      <p className="mt-1 text-xs text-slate-400">
                        {draftFilters.survey_id
                          ? "Only participants with a recorded value for every selected or filtered health-data element will appear in results."
                          : "Only participants with recorded values for the health-data columns in scope will appear in results."}
                      </p>
                    )}
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {viewMode === "table" ? (
          <div className={`relative overflow-x-auto transition-opacity duration-200 ${filtering ? "pointer-events-none opacity-60" : ""}`}>
            {filtering && queryData.data.length > 0 && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 backdrop-blur-[1px]">
                <div className="flex min-w-[220px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-lg">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                  <div>
                    <p className="font-semibold text-slate-700">Loading table</p>
                    <p className="text-xs text-slate-500">Fetching participant results...</p>
                  </div>
                </div>
              </div>
            )}

            <div className="inline-block min-w-full align-top">
            <table className="min-w-full border-collapse whitespace-nowrap text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">#</th>
                  <th
                    onClick={() => handleSort(appliedFilters.group_by ? "group_value" : "participant")}
                    className="cursor-pointer px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-1.5">
                      {appliedFilters.group_by ? appliedGroupByLabel : "Participant"}
                      <span className="text-slate-300">
                        {sortConfig.key === (appliedFilters.group_by ? "group_value" : "participant")
                          ? sortConfig.direction === "asc"
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </div>
                  </th>
                  {visibleColumns.map((column) => {
                    return (
                  <th
                        key={column.id}
                        onClick={() => handleSort(column.id)}
                        className="cursor-pointer px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500 transition hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-1.5">
                          {column.text || column.id}
                          <span className="text-slate-300">
                            {sortConfig.key === column.id
                              ? sortConfig.direction === "asc"
                                ? "↑"
                                : "↓"
                              : "↕"}
                          </span>
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queryData.data.map((row, index) => (
                  <tr key={`${row._participant_id || "row"}-${index}`} className="transition-colors hover:bg-blue-50/50">
                    <td className="px-6 py-4 text-xs font-bold text-slate-400">{index + 1}</td>
                    <td className="px-6 py-4 text-sm">
                      {appliedFilters.group_by ? (
                        <span className="font-semibold text-slate-700">{row.group_value || "Unknown"}</span>
                      ) : (
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-semibold text-slate-600">
                          {getParticipantMarker(participantMarkerMap.get(row._participant_id))}
                        </span>
                      )}
                    </td>
                    {visibleColumns.map((column) => {
                      const value = row[column.id];
                      const canDrillIntoSubmission =
                        column.id === "source_submission_id" &&
                        row.source_type === "survey" &&
                        row.source_submission_id &&
                        row._participant_id;
                      return (
                        <td key={column.id} className="px-6 py-4 text-sm font-bold text-slate-700">
                          {canDrillIntoSubmission ? (
                            <Link
                              to={`/researcher/submissions/${row._participant_id}/${row.source_submission_id}`}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              View submission
                            </Link>
                          ) : column.id === "observed_at" && value ? (
                            <span className="text-slate-600">{formatObservedAt(value)}</span>
                          ) : META_COLUMN_IDS.has(column.id) && value ? (
                            String(value)
                          ) : column.id.includes("id") && value ? (
                            <span className="rounded-lg bg-blue-50 px-2 py-1 font-mono text-xs text-blue-600">
                              {String(value).slice(0, 8)}...
                            </span>
                          ) : value !== null && value !== undefined && value !== "" ? (
                            String(value)
                          ) : (
                            <span className="italic text-slate-300">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {queryData.data.length === 0 && (loading || filtering) && (
              <div className="p-16 text-center text-slate-400">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
                <p className="text-sm font-semibold text-slate-600">Loading participant table...</p>
              </div>
            )}

            {queryData.data.length === 0 && !loading && !filtering && (
              <div className="p-16 text-center text-slate-400">
                <p className="text-sm font-semibold">No participants match the current filters.</p>
              </div>
            )}

            {queryData.data.length > 0 && (
              <div className="border-t border-slate-100 px-6 py-4 text-sm text-slate-500">
                <div className="flex min-w-full items-center gap-3">
                  <span className="whitespace-nowrap">
                    Loaded {loadedParticipantCount} of {pagination.total_participants} participants
                  </span>
                  <div className="sticky right-0 ml-auto bg-white pl-4 text-right">
                    {loadingMore ? (
                      <span className="whitespace-nowrap font-medium text-blue-600">Loading more...</span>
                    ) : pagination.has_more ? (
                      <button
                        type="button"
                        onClick={() =>
                          loadResultsRef.current({
                            reset: false,
                            filters: appliedFilters,
                            offset: pagination.next_offset,
                            limit: PAGE_SIZE,
                          })
                        }
                        className="whitespace-nowrap font-medium text-blue-600 hover:text-blue-800"
                      >
                        Load more
                      </button>
                    ) : (
                      <span className="whitespace-nowrap">All participants loaded</span>
                    )}
                  </div>
                </div>
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="grid gap-8 bg-slate-50/50 p-8 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-slate-700">
                Gender Distribution
              </h3>
              {chartData.gender.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-slate-400">No data to display</div>
              ) : (
                <>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData.gender} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {chartData.gender.map((entry, index) => (
                            <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} Participants`, "Count"]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-6 text-center text-sm font-bold uppercase tracking-widest text-slate-700">
                Age Demographics
              </h3>
              {chartData.age.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-slate-400">No data to display</div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.age} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 12, fontWeight: 600, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fontWeight: 600, fill: "#64748b" }} axisLine={false} tickLine={false} />
                      <Tooltip
                        cursor={{ fill: "#f1f5f9" }}
                        contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      />
                      <Bar dataKey="count" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>

      <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-6 xl:max-h-[calc(100vh-3rem)] xl:overflow-y-auto">
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <label className="block text-xs font-semibold text-slate-500">Survey</label>
              <span className="text-xs text-slate-400">(optional - adds health data columns)</span>
            </div>
            <select
              value={draftFilters.survey_id}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  survey_id: event.target.value,
                  mode: "aggregate",
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
            >
              <option value="">No survey selected</option>
              {surveyOptions.map((survey) => (
                <option key={survey.form_id || survey.id} value={survey.form_id || survey.id}>
                  {survey.title}
                  {survey.version ? ` (v${survey.version})` : ""}
                  {survey.status ? ` - ${String(survey.status).replaceAll("_", " ")}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="relative" ref={groupMenuRef}>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Group (optional)</label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGroupMenu((prev) => !prev)}
                className="flex flex-1 items-center justify-between rounded-lg border border-slate-200 bg-white p-2.5 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300"
              >
                <span className="truncate">
                  {draftFilters.group_ids.length === 0
                    ? "All participants"
                    : selectedGroups[0]?.name || "1 group selected"}
                </span>
                <span className="text-slate-400">▾</span>
              </button>
              {draftFilters.group_ids.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextFilters = { ...draftFilters, group_ids: [] };
                    setDraftFilters(nextFilters);
                    loadResultsRef.current({
                      reset: true,
                      filters: nextFilters,
                      updateApplied: true,
                    });
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  aria-label="Clear selected group"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {showGroupMenu && (
              <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    const nextFilters = { ...draftFilters, group_ids: [] };
                    setDraftFilters(nextFilters);
                    loadResultsRef.current({
                      reset: true,
                      filters: nextFilters,
                      updateApplied: true,
                    });
                  }}
                  className="mb-2 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-50"
                >
                  All participants
                </button>
                {allGroups.map((group) => {
                  const groupId = group.group_id || group.id;
                  const checked = draftFilters.group_ids.some(
                    (id) => String(id) === String(groupId),
                  );
                  return (
                    <label
                      key={groupId}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="radio"
                        name="researcher-group-filter"
                        checked={checked}
                        onChange={() => {
                          const nextFilters = {
                            ...draftFilters,
                            group_ids: checked
                              ? []
                              : [groupId],
                          };
                          setDraftFilters(nextFilters);
                          const deployedGroupIds = new Set((selectedSurvey?.deployed_group_ids || []).map(String));
                          const hasMismatch =
                            nextFilters.survey_id &&
                            nextFilters.group_ids.length > 0 &&
                            deployedGroupIds.size > 0 &&
                            !nextFilters.group_ids.some((id) => deployedGroupIds.has(String(id)));
                          if (!hasMismatch) {
                            loadResultsRef.current({
                              reset: true,
                              filters: nextFilters,
                              updateApplied: true,
                            });
                          }
                        }}
                        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>{group.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {surveyGroupMismatch ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              This group does not have this survey.
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Group by</label>
            <select
              value={draftGroupByValue}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  group_by: !event.target.value
                    ? null
                    : event.target.value.startsWith("demographic:")
                      ? { type: "demographic", field: event.target.value.split(":")[1] }
                      : { type: "element", element_id: event.target.value.split(":")[1] },
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
            >
              <option value="">None</option>
              {groupByOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Source data</label>
            <select
              value={draftFilters.source_types.join(",")}
              onChange={(event) =>
                setDraftFilters((prev) => ({
                  ...prev,
                  source_types:
                    event.target.value === "survey,goal" ? ["survey", "goal"] : [event.target.value],
                }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
            >
              <option value="survey">Survey</option>
              <option value="goal">Goal</option>
              <option value="survey,goal">Survey + Goal</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-400">
              {draftFilters.survey_id
                ? "Applies to elements linked to the selected survey only."
                : "Applies across all available survey and goal data."}
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Mode</label>
            <select
              value={draftFilters.mode}
              onChange={(event) =>
                setDraftFilters((prev) => ({ ...prev, mode: event.target.value }))
              }
              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
            >
              <option value="aggregate">Aggregate (mean/min/max)</option>
              <option value="longitudinal">Longitudinal</option>
            </select>
            <p className="mt-1.5 text-xs text-slate-400">
              {draftFilters.mode === "aggregate"
                ? draftFilters.survey_id
                  ? "One row per participant with each survey element summarized into mean, min, max, and observation count."
                  : "One row per participant with each visible element summarized into mean, min, max, and observation count."
                : draftFilters.survey_id
                  ? "One row per survey submission with Observed At shown for each row."
                  : "Keeps repeated observations as separate rows and shows Observed At for each one."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Date from</label>
              <input
                type="date"
                value={draftFilters.date_from}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, date_from: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Date to</label>
              <input
                type="date"
                value={draftFilters.date_to}
                onChange={(event) =>
                  setDraftFilters((prev) => ({ ...prev, date_to: event.target.value }))
                }
                className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
              />
            </div>
          </div>

        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition hover:text-blue-800"
          >
            <span>{showAdvancedFilters ? "Hide advanced filters" : "Advanced filters"}</span>
            <span className="text-slate-300">{showAdvancedFilters ? "−" : "+"}</span>
          </button>
        </div>

        {!draftFilters.survey_id && (
          <div className="mt-3 text-sm text-slate-500">
            Showing all participants across the selected data sources. Select a survey above to limit results to elements linked to that survey.
          </div>
        )}

        {showAdvancedFilters && (
          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
            <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col items-start gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Demographic filters</p>
                  <p className="text-xs text-slate-500">Add demographic conditions using the same builder pattern.</p>
                </div>
                {demographicFilterSummaries.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {demographicFilterSummaries.map((filter, index) => (
                      <div
                        key={filter.key}
                        className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                      >
                        <button
                          type="button"
                          onClick={() => editDemographicFilter(index)}
                          className="text-left transition hover:text-blue-900"
                        >
                          {filter.text}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeDemographicFilter(index)}
                          className="text-blue-500 transition hover:text-blue-700"
                          aria-label={`Remove ${filter.text}`}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-2">
                <select
                  value={demographicDraft.field}
                  onChange={(event) => updateDemographicDraft("field", event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
                >
                  {ALL_DEMOGRAPHIC_FIELDS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {needsDemographicOperator(demographicDraft.field) ? (
                  <select
                    value={demographicDraft.operator}
                    onChange={(event) => updateDemographicDraft("operator", event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
                  >
                    {getDemographicOperators(demographicDraft.field).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}
                {!isNumericDemographicField(demographicDraft.field) &&
                hasPredefinedDemographicOptions(demographicDraft.field) ? (
                  <select
                    value={demographicDraft.value}
                    onChange={(event) => updateDemographicDraft("value", event.target.value)}
                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
                  >
                    <option value="">{`Select ${getDemographicFieldLabel(demographicDraft.field).toLowerCase()}`}</option>
                    {DEMOGRAPHIC_VALUE_OPTIONS[demographicDraft.field].map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={isNumericDemographicField(demographicDraft.field) ? "number" : "text"}
                    value={demographicDraft.value}
                    onChange={(event) => updateDemographicDraft("value", event.target.value)}
                    placeholder={
                      isNumericDemographicField(demographicDraft.field)
                        ? `Enter ${getDemographicFieldLabel(demographicDraft.field).toLowerCase()}`
                        : `Select ${getDemographicFieldLabel(demographicDraft.field).toLowerCase()}`
                    }
                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
                  />
                )}
                {needsDemographicOperator(demographicDraft.field) &&
                demographicDraft.operator === "between" ? (
                  <input
                    type="number"
                    value={demographicDraft.value_max}
                    onChange={(event) => updateDemographicDraft("value_max", event.target.value)}
                    placeholder="Value max"
                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-sm text-slate-700 outline-none shadow-sm focus:border-blue-500"
                  />
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={addDemographicFilter}
                    disabled={!demographicDraft.value}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    Add filter
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Health data filters</p>
                  <p className="text-xs text-slate-500">Filter participants by health data element values.</p>
                </div>
                <div className="space-y-3" ref={elementMenuRef}>
                  {selectedElementFilters.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedElementFilters.map((filter) => {
                        const element = numericElements.find(
                          (candidate) => String(candidate.element_id) === String(filter.element_id),
                        );
                        const label = element
                          ? `${element.label}${element.unit ? ` (${element.unit})` : ""}`
                          : "Selected element";
                        return (
                          <div
                            key={String(filter.element_id)}
                            className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700"
                          >
                            <button
                              type="button"
                              onClick={() => editElementFilterById(filter.element_id)}
                              className="text-left transition hover:text-blue-900"
                            >
                              {label}
                            </button>
                            <button
                              type="button"
                              onClick={() => removeElementFilterById(filter.element_id)}
                              className="text-blue-500 transition hover:text-blue-700"
                              aria-label={`Remove ${label}`}
                            >
                              x
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowElementMenu((prev) => !prev)}
                      className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm text-slate-700 shadow-sm transition hover:border-slate-300"
                    >
                      <span>
                        {elementDraft.element_id
                          ? (() => {
                              const selected = numericElements.find(
                                (element) => String(element.element_id) === String(elementDraft.element_id),
                              );
                              return selected
                                ? `${selected.label}${selected.unit ? ` (${selected.unit})` : ""}`
                                : "Select health data element";
                            })()
                          : selectedElementFilters.length > 0
                            ? "Add another health data element"
                            : "Add health data element"}
                      </span>
                      <span className="text-slate-400">{showElementMenu ? "˄" : "˅"}</span>
                    </button>
                    {showElementMenu ? (
                      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                        <input
                          type="text"
                          value={elementSearch}
                          onChange={(event) => setElementSearch(event.target.value)}
                          placeholder="Search health data elements"
                          className="mb-3 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                        />
                        <div className="max-h-60 space-y-1 overflow-y-auto">
                          {availableElementChoices.length > 0 ? (
                            availableElementChoices.map((element) => (
                              <button
                                key={element.element_id}
                                type="button"
                                onClick={() => addElementFilterById(element.element_id)}
                                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                              >
                                <span>{element.label}{element.unit ? ` (${element.unit})` : ""}</span>
                                <span className="text-xs font-semibold text-blue-600">Add</span>
                              </button>
                            ))
                          ) : (
                            <p className="px-2 py-3 text-sm text-slate-500">No matching elements left to add.</p>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <select
                  value={elementDraft.operator}
                  onChange={(event) => updateElementDraft("operator", event.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                >
                  <option value="eq">=</option>
                  <option value="gt">&gt;</option>
                  <option value="gte">&ge;</option>
                  <option value="lt">&lt;</option>
                  <option value="lte">&le;</option>
                  <option value="between">Between</option>
                  <option value="has_value">Has any value</option>
                  <option value="is_empty">Is empty</option>
                </select>
                {["has_value", "is_empty"].includes(elementDraft.operator) ? (
                  <div className="hidden sm:block" />
                ) : (
                  <input
                    type="number"
                    value={elementDraft.value}
                    onChange={(event) => updateElementDraft("value", event.target.value)}
                    placeholder="Value"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
                  />
                )}
                {elementDraft.operator === "between" ? (
                  <input
                    type="number"
                    value={elementDraft.value_max}
                    onChange={(event) => updateElementDraft("value_max", event.target.value)}
                    placeholder="Value max"
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 sm:col-span-2"
                  />
                ) : null}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={addElementFilter}
                  disabled={!elementDraft.element_id}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  Add filter
                </button>
              </div>
            </div>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={applyFilters}
            disabled={surveyGroupMismatch}
            className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
              surveyGroupMismatch
                ? "cursor-not-allowed bg-slate-200 text-slate-500"
                : "bg-blue-700 text-white hover:bg-blue-800"
            }`}
          >
            Apply
          </button>
          <button
            type="button"
            onClick={resetFilters}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}
