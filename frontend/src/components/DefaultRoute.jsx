import { Navigate } from "react-router-dom";

export default function DefaultRoute({ userRole }) {
  return <Navigate to={`/${userRole.toLowerCase()}`} />;
}
