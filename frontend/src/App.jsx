import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import DashboardLayout from "./layouts/DashboardLayout";
import NoSideDashboardLayout from "./layouts/NoSideDashboardLayout";
import ParticipantRoute from "./components/ParticipantRoute";
import AdminRoute from "./components/AdminRoute";
import CaretakerRoute from "./components/CaretakerRoute";
import ResearcherRoute from "./components/ResearcherRoute";
import DefaultRoute from "./components/DefaultRoute";
import ParticipantDashboard from "./pages/participant/ParticipantDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CaretakerDashboard from "./pages/caretaker/CaretakerDashboard";
import ResearcherDashboard from "./pages/researcher/ResearcherDashboard";

// ── Auth & Onboarding ──
import AuthLayout from "./layouts/AuthLayout";
import OnboardingLayout from "./layouts/OnboardingLayout";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import BackgroundInfoPage from "./pages/onboarding/BackgroundInfoPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import ConsentPage from "./pages/onboarding/ConsentPage";
import IntakePage from "./pages/onboarding/IntakePage";

// ── Shared pages ──
import ProfilePage from "./pages/shared/ProfilePage";
import SurveyBuilderPage from "./pages/shared/SurveyBuilderPage";
import MaintenancePage from "./pages/shared/MaintenancePage";

// ── Participant pages ──
import FormListPage from "./pages/participant/FormListPage";
import SurveyFillPage from "./pages/participant/SurveyFillPage";
import HealthGoals from "./pages/participant/HealthGoals";
import Messages from "./pages/participant/Message";

// ── Admin pages ──
import UserManagementPage from "./pages/admin/UserManagementPage";
import UserDetailPage from "./pages/admin/UserDetailPage";
import AuditLogPage from "./pages/admin/AuditLogPage";
import BackupRestorePage from "./pages/admin/BackupRestorePage";
import SystemSettingsPage from "./pages/admin/SystemSettingsPage";
import AdminOnboardingPage from "./pages/admin/AdminOnboardingPage";
import AdminInsightsPage from "./pages/admin/AdminInsightsPage";
import AdminMessagesPage from "./pages/admin/AdminMessagesPage";

// --- Researcher pages ---
import ResearcherOnboardingPage from "./pages/researcher/ResearcherOnboardingPage";
import DataElementManager from "./pages/researcher/DataElementManager";
import Groups from "./pages/researcher/Group_Chorts";
import GoalTemplates from "./pages/researcher/GoalTemplates";

// ── Caretaker pages ──
import CaretakerOnboardingPage from "./pages/caretaker/CaretakerOnboardingPage";
import MyParticipantsPage from "./pages/caretaker/MyParticipantsPage";
import ParticipantDetailPage from "./pages/caretaker/ParticipantDetailPage";
import ReportsPage from "./pages/caretaker/ReportsPage";

function App() {
  const { role } = useAuth();

  return (
    <BrowserRouter>
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

        {/* ── Admin ── */}
        <Route element={<AdminRoute />}>
          <Route path="/admin/onboarding" element={<AdminOnboardingPage />} />
          <Route element={<DashboardLayout role={role} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route
              path="/admin/profile"
              element={<ProfilePage role="admin" />}
            />
            <Route path="/surveys" element={<SurveyBuilderPage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/admin/users/:id" element={<UserDetailPage />} />
            <Route path="/audit-logs" element={<AuditLogPage />} /> 
            <Route path="/settings" element={<SystemSettingsPage />} />
            <Route path="/admin/insights" element={<AdminInsightsPage />} />
            <Route path="/admin/messages" element={<AdminMessagesPage />} />
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
            <Route path="/participant/messages" element={<Messages />} />
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
            <Route path="/groups" element={<Groups />} />
            <Route path="/researcher/goals" element={<GoalTemplates />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
