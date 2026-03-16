// src/config/navigation.js

export const DASHBOARD_NAV = [
  /* =====================
     SHARED CORE
  ====================== */
  {
    label: "Dashboard",
    to: "/dashboard",
    roles: ["admin", "researcher", "caretaker"],
  },

  {
    label: "Groups / Cohorts",
    to: "/groups",
    roles: ["admin", "researcher"], //removed caretaker for now since they won't be managing groups
  },

  /* =====================
     ADMIN ONLY
  ====================== */
  {
    label: "Users & Roles",
    to: "/users",
    roles: ["admin"],
  },

  {
    label: "Surveys",
    to: "/surveys",
    roles: ["admin"],
  },

  {
    label: "System Settings",
    to: "/settings",
    roles: ["admin"],
  },

  {
    label: "Security & Audit Logs",
    to: "/audit-logs",
    roles: ["admin"],
  },

  /* =====================
     RESEARCHER
  ====================== */
  {
    label: "Survey Builder",
    to: "/survey-builder",
    roles: ["researcher"],
  },

  {
    label: "Analytics",
    to: "/analytics",
    roles: ["admin", "researcher"],
  },

  {
    label: "Reports",
    to: "/reports",
    roles: ["admin", "researcher"],
  },

  {
    label: "Exports",
    to: "/exports",
    roles: ["researcher"],
  },
  {
    label: "Data Elements",
    to: "/researcher/data-elements",
    roles: ["researcher"],
  },

  /* =====================
     CARETAKER
  ====================== */
  {
    label: "My Participants",
    to: "/caretaker/participants",
    roles: ["caretaker"],
  },

  {
    label: "Reports",
    to: "/caretaker/reports",
    roles: ["caretaker"],
  },

  //{
  //  label: "Notes & Feedback",
  //  to: "/notes-feedback",
  //  roles: ["caretaker"],
  //},
  

  /* =====================
     PROFILE (per-role path)
  ====================== */
  //{ label: "Profile", to: "/admin/profile", roles: ["admin"] },
  //{ label: "Profile", to: "/researcher/profile", roles: ["researcher"] },
  //{ label: "Profile", to: "/caretaker/profile", roles: ["caretaker"] },

  //{
  //  label: "Logout",
  //  to: "/logout",
  //  roles: ["admin", "researcher", "caretaker"],
  //},
];

export const PARTICIPANT_NAV = [
  {
    label: "Home",
    to: "/participant",
    roles: ["participant"],
  },
  {
    label: "Fill Survey",
    to: "/participant/survey",
    roles: ["participant"],
  },
  {
    label: "Health Goals",
    to: "/participant/healthgoals",
    roles: ["participant"],
  },
];
