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
    roles: ["researcher"], //removed caretaker and admin for now since they won't be managing groups
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
    label: "Onboarding",
    to: "/onboarding-management",
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

  {
    label: "Backup & Restore",
    to: "/backup",
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
    label: "Data Elements",
    to: "/researcher/data-elements",
    roles: ["researcher"],
  },

  { label: "Create Goals", to: "/researcher/goals", roles: ["researcher"] },

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
    label: "My Goals",
    to: "/participant/healthgoals",
    roles: ["participant"],
  },
  {
    label: "Messages",
    to: "/participant/messages",
    roles: ["participant"],
  },
];
