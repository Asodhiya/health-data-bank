import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import NoSideDashboardLayout from "./layouts/NoSideDashboardLayout";
import ParticipantRoute from "./components/ParticipantRoute";
import AdminRoute from "./components/AdminRoute";
import CaretakerRoute from "./components/CaretakerRoute";
import ResearcherRoute from "./components/ResearcherRoute";
import DefaultRoute from "./components/DefaultRoute";
const ParticipantDashboard = lazy(() => import("./pages/participant/ParticipantDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const CaretakerDashboard = lazy(() => import("./pages/caretaker/CaretakerDashboard"));
const ResearcherDashboard = lazy(() => import("./pages/researcher/ResearcherDashboard"));

// ── Auth & Onboarding ──
import AuthLayout from "./layouts/AuthLayout";
import OnboardingLayout from "./layouts/OnboardingLayout";
const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("./pages/auth/RegisterPage"));
const ForgotPasswordPage = lazy(() => import("./pages/auth/ForgotPasswordPage"));
const BackgroundInfoPage = lazy(() => import("./pages/onboarding/BackgroundInfoPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const ConsentPage = lazy(() => import("./pages/onboarding/ConsentPage"));
const IntakePage = lazy(() => import("./pages/onboarding/IntakePage"));
const SendFeedbackPage = lazy(() => import("./pages/shared/SendFeedbackPage"));
const TermsPage = lazy(() => import("./pages/shared/TermsPage"));

// ── Shared pages ──
const ProfilePage = lazy(() => import("./pages/shared/ProfilePage"));
const SurveyBuilderPage = lazy(() => import("./pages/shared/SurveyBuilderPage"));
const MaintenancePage = lazy(() => import("./pages/shared/MaintenancePage"));

// ── Participant pages ──
const FormListPage = lazy(() => import("./pages/participant/FormListPage"));
const SurveyFillPage = lazy(() => import("./pages/participant/SurveyFillPage"));
const HealthGoals = lazy(() => import("./pages/participant/HealthGoals"));
const ParticipantFeedback = lazy(() => import("./pages/participant/ParticipantFeedback"));
const ParticipantHealthSummary = lazy(() => import("./pages/participant/ParticipantHealthSummary"));

// ── Admin pages ──
const UserManagementPage = lazy(() => import("./pages/admin/UserManagementPage"));
const UserDetailPage = lazy(() => import("./pages/admin/UserDetailPage"));
const AuditLogPage = lazy(() => import("./pages/admin/AuditLogPage"));
const BackupRestorePage = lazy(() => import("./pages/admin/BackupRestorePage"));
const SystemSettingsPage = lazy(() => import("./pages/admin/SystemSettingsPage"));
const AdminOnboardingPage = lazy(() => import("./pages/admin/AdminOnboardingPage"));
const AdminInsightsPage = lazy(() => import("./pages/admin/AdminInsightsPage"));
const AdminMessagesPage = lazy(() => import("./pages/admin/AdminMessagesPage"));
const OnboardingManagementPage = lazy(() => import("./pages/admin/OnboardingManagementPage"));

// --- Researcher pages ---
const ResearcherOnboardingPage = lazy(() => import("./pages/researcher/ResearcherOnboardingPage"));
const DataElementManager = lazy(() => import("./pages/researcher/DataElementManager"));
const Groups = lazy(() => import("./pages/researcher/Group_Chorts"));
const GoalTemplates = lazy(() => import("./pages/researcher/GoalTemplates"));
const ResearcherSubmissionDetailPage = lazy(() => import("./pages/researcher/ResearcherSubmissionDetailPage"));

// ── Caretaker pages ──
const CaretakerOnboardingPage = lazy(() => import("./pages/caretaker/CaretakerOnboardingPage"));
const MyParticipantsPage = lazy(() => import("./pages/caretaker/MyParticipantsPage"));
const ParticipantDetailPage = lazy(() => import("./pages/caretaker/ParticipantDetailPage"));
const ReportsPage = lazy(() => import("./pages/caretaker/ReportsPage"));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500 text-sm font-medium">
      Loading...
    </div>
  );
}

function App() {
  const { role } = useAuth();

  return (
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        {/* ── Auth routes (public) ── */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* ── Onboarding routes (participant only) ── */}
        <Route element={<ParticipantRoute />}>
          <Route element={<OnboardingLayout />}>
            <Route
              path="/onboarding/background"
              element={<BackgroundInfoPage />}
            />
            <Route path="/onboarding/consent" element={<ConsentPage />} />
            <Route path="/onboarding/intake" element={<IntakePage />} />
          </Route>
        </Route>

        <Route path="/" element={<DefaultRoute />} />
        <Route path="/dashboard" element={<DefaultRoute />} />
        <Route path="/logout" element={<Navigate to="/login" replace />} />
        <Route path="/maintenance" element={<MaintenancePage />} />
        <Route path="/feedback/send" element={<SendFeedbackPage />} />
        <Route path="/terms" element={<TermsPage />} />

        {/* ── Admin ── */}
        <Route element={<AdminRoute />}>
          <Route path="/admin/onboarding" element={<AdminOnboardingPage />} />
          <Route element={<DashboardLayout role={role} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route
              path="/admin/profile"
              element={<ProfilePage role="admin" />}
            />
            <Route path="/admin/insights" element={<AdminInsightsPage />} />
            <Route path="/admin/messages" element={<AdminMessagesPage />} />
            <Route path="/surveys" element={<SurveyBuilderPage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/admin/users/:id" element={<UserDetailPage />} />
            <Route path="/audit-logs" element={<AuditLogPage />} /> 
            <Route path="/onboarding-management" element={<OnboardingManagementPage />} />
            <Route path="/settings" element={<SystemSettingsPage />} />
            <Route path="/backup" element={<BackupRestorePage />} />
          </Route>
        </Route>

        {/* ── Participant ── */}
        <Route element={<ParticipantRoute />}>
          <Route element={<NoSideDashboardLayout role={role} />}>
            <Route path="/participant" element={<ParticipantDashboard />} />
            <Route
              path="/participant/profile"
              element={<ProfilePage role="participant" />}
            />
            <Route path="/participant/healthgoals" element={<HealthGoals />} />
            <Route path="/participant/feedback" element={<ParticipantFeedback />} />
            <Route path="/participant/health-summary" element={<ParticipantHealthSummary />} />
            <Route path="/participant/survey" element={<FormListPage />} />
            <Route
              path="/participant/surveys/:id"
              element={<SurveyFillPage />}
            />
          </Route>
        </Route>

        {/* ── Caretaker ── */}
        <Route element={<CaretakerRoute />}>
          {/* Onboarding — standalone page, no sidebar/dashboard layout */}
          <Route path="/caretaker/onboarding" element={<CaretakerOnboardingPage />} />
          <Route element={<DashboardLayout role={role} />}>
            <Route path="/caretaker" element={<CaretakerDashboard />} />
            <Route
              path="/caretaker/profile"
              element={<ProfilePage role="caretaker" />}
            />
            <Route
              path="/caretaker/participants"
              element={<MyParticipantsPage />}
            />
            <Route
              path="/caretaker/participants/:id"
              element={<ParticipantDetailPage />}
            />
            <Route path="/caretaker/reports" element={<ReportsPage />} />
          </Route>
        </Route>

        {/* ── Researcher onboarding (separate wrapper to avoid redirect loop) ── */}
        <Route element={<ResearcherRoute allowOnboarding />}>
          <Route path="/researcher/onboarding" element={<ResearcherOnboardingPage />} />
        </Route>

        {/* ── Researcher ── */}
        <Route element={<ResearcherRoute />}>
          <Route element={<DashboardLayout role={role} />}>
            <Route path="/researcher" element={<ResearcherDashboard />} />
            <Route
              path="/researcher/profile"
              element={<ProfilePage role="researcher" />}
            />
            <Route path="/survey-builder" element={<SurveyBuilderPage />} />
            <Route
              path="/researcher/data-elements"
              element={<DataElementManager />}
            />
            <Route
              path="/researcher/submissions/:participantId/:submissionId"
              element={<ResearcherSubmissionDetailPage />}
            />
            <Route path="/groups" element={<Groups />} />
            <Route path="/researcher/goals" element={<GoalTemplates />} />
          </Route>
        </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
