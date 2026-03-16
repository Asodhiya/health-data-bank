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

// ── Participant pages ──
import FormListPage from "./pages/participant/FormListPage";
import SurveyFillPage from "./pages/participant/SurveyFillPage";
import HealthGoals from "./pages/participant/HealthGoals";
import Messages from "./pages/participant/Message";

// ── Admin pages ──
import UserManagementPage from "./pages/admin/UserManagementPage";

// --- Researcher pages ---
import DataElementManager from "./pages/researcher/DataElementMangaer";
import Groups from "./pages/researcher/Group_Chorts";
// ── Caretaker pages ──
import MyParticipantsPage from "./pages/caretaker/MyParticipantsPage";
import ParticipantDetailPage from "./pages/caretaker/ParticipantDetailPage";
import ReportsPage from "./pages/caretaker/ReportsPage";
import GoalTemplates from "./pages/researcher/GoalTemplates";

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

        {/* ── Admin ── */}
        <Route element={<AdminRoute />}>
          <Route element={<DashboardLayout role={role} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route
              path="/admin/profile"
              element={<ProfilePage role="admin" />}
            />
            <Route path="/surveys" element={<SurveyBuilderPage />} />
            <Route path="/users" element={<UserManagementPage />} />
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
