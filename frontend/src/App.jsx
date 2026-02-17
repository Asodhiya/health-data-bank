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

function App() {
  const [userRole, setUserRole] = useState("participant");

  return (
    <BrowserRouter>
      <Routes>
        {/* We pass the state variable 'userRole' down using a prop we named 'role' */}
        <Route path="/" element={<DefaultRoute userRole={userRole} />} />

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

        <Route element={<ParticipantRoute userRole={userRole} />}>
          <Route element={<NoSideDashboardLayout role={userRole} />}>
            <Route
              path="/participant"
              element={<div>Welcome back, Josh! (Participant Dashboard)</div>}
            />
          </Route>
        </Route>

        <Route element={<CaretakerRoute userRole={userRole} />}>
          <Route element={<DashboardLayout role={userRole} />}>
            <Route
              path="/caretaker"
              element={<div>Caretaker Dashboard</div>}
            />
          </Route>
        </Route>

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