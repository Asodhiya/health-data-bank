import { Navigate, Outlet } from "react-router-dom";

export default function ParticipantRoute({ userRole }) {
  if (userRole.toLowerCase() !== "participant") {
    return <Navigate to={`/${userRole.toLowerCase()}`} />;
  }

  return <Outlet />;
}
