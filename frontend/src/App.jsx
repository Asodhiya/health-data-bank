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
import ParticipantDashboard from "./pages/participant/ParticipantDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import CaretakerDashboard from "./pages/caretaker/CaretakerDashboard";
import ResearcherDashboard from "./pages/researcher/ResearcherDashboard";

function App() {
  const [userRole, setUserRole] = useState("admin");

  return (
    <BrowserRouter>
      <Routes>
        {/* We pass the state variable 'userRole' down using a prop we named 'role' */}
        <Route path="/" element={<DefaultRoute userRole={userRole} />} />

        <Route element={<AdminRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>

        <Route element={<ParticipantRoute userRole={userRole} />}>
          <Route element={<NoSideDashboardLayout role={userRole} />}>
            <Route path="/participant" element={<ParticipantDashboard />} />
          </Route>
        </Route>

        <Route element={<CaretakerRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route path="/caretaker" element={<CaretakerDashboard />} />
          </Route>
        </Route>

        <Route element={<ResearcherRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route path="/researcher" element={<ResearcherDashboard />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
