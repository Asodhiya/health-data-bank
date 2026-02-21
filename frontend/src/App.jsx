import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
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

// ── Participant pages ──
import FormListPage from "./pages/participant/FormListPage";

function App() {
  const [userRole, setUserRole] = useState("participant"); // 'admin' | 'participant' | 'caretaker' | 'researcher' | null

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
        <Route element={<ParticipantRoute userRole={userRole} />}>
          <Route element={<OnboardingLayout />}>
            <Route path="/onboarding/background" element={<BackgroundInfoPage />} />
            <Route path="/onboarding/consent" element={<ConsentPage />} />
            <Route path="/onboarding/intake" element={<IntakePage />} />
          </Route>
        </Route>

        
        <Route path="/" element={<DefaultRoute userRole={userRole} />} />
        <Route path="/dashboard" element={<DefaultRoute userRole={userRole} />} />
        <Route path="/logout" element={<Navigate to="/login" replace />} />

        <Route element={<AdminRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/profile" element={<ProfilePage role="admin" />} />
          </Route>
        </Route>

        <Route element={<ParticipantRoute userRole={userRole} />}>
          <Route element={<NoSideDashboardLayout role={userRole} />}>
            <Route path="/participant" element={<ParticipantDashboard />} />
            <Route path="/participant/profile" element={<ProfilePage role="participant" />} />
            <Route path="/participant/survey" element={<FormListPage />} />
          </Route>
        </Route>

        <Route element={<CaretakerRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route path="/caretaker" element={<CaretakerDashboard />} />
            <Route path="/caretaker/profile" element={<ProfilePage role="caretaker" />} />
          </Route>
        </Route>

        <Route element={<ResearcherRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route path="/researcher" element={<ResearcherDashboard />} />
            <Route path="/researcher/profile" element={<ProfilePage role="researcher" />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
