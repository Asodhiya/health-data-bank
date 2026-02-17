import { useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import DashboardLayout from "./layouts/DashboardLayout";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import NoSideDashboardLayout from "./layouts/NoSideDashboardLayout";
import ParticipantRoute from "./components/ParticipantRoute";
import AdminRoute from "./components/AdminRoute";
import CaretakerRoute from "./components/CaretakerRoute";
import ResearcherRoute from "./components/ResearcherRoute";
import DefaultRoute from "./components/DefaultRoute";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import DashboardPage from "./pages/DashboardPage";

function App() {
  const [userRole, setUserRole] = useState("participant");

  return (
    <BrowserRouter>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Role-based redirect */}
        <Route path="/" element={<DefaultRoute userRole={userRole} />} />

        {/* Participant routes — DashboardPage has its own layout */}
        <Route element={<ParticipantRoute userRole={userRole} />}>
          <Route path="/participant" element={<DashboardPage />} />
        </Route>

        {/* Admin routes */}
        <Route element={<AdminRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route
              path="/admin"
              element={
                <div>
                  <h1 className="text-2xl font-bold mb-4">
                    Welcome to Health Data Bank
                  </h1>
                  <p>Your current role is: {userRole}</p>
                </div>
              }
            />
          </Route>
        </Route>

        {/* Caretaker routes */}
        <Route element={<CaretakerRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route
              path="/caretaker"
              element={<div>Caretaker Dashboard</div>}
            />
          </Route>
        </Route>

        {/* Researcher routes */}
        <Route element={<ResearcherRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route
              path="/researcher"
              element={<div>Researcher Dashboard</div>}
            />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
