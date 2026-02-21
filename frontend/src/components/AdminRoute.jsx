import { Navigate, Outlet } from "react-router-dom";

export default function AdminRoute({ userRole }) {
  if (userRole.toLowerCase() !== "admin") {
    return <Navigate to={`/${userRole.toLowerCase()}`} />;
  }
  return <Outlet />;
}
