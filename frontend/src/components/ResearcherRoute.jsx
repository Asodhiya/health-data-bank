import { Navigate, Outlet } from "react-router-dom";

export default function ResearcherRoute({ userRole }) {
  if (userRole.toLowerCase() !== "researcher") {
    return <Navigate to={`/${userRole.toLowerCase()}`} />;
  }
  return <Outlet />;
}