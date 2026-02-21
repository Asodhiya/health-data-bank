import { Navigate, Outlet } from "react-router-dom";

export default function CaretakerRoute({ userRole }) {
  if (userRole.toLowerCase() !== "caretaker") {
    return <Navigate to={`/${userRole.toLowerCase()}`} />;
  }
  return <Outlet />;
}