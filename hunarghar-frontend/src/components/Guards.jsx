import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, homeFor } from '../lib/auth.jsx';
import { Spinner } from './ui.jsx';

/** Client-side route guard (the server still checks the role on every request, SFR-06). */
export default function Protected({ roles, children }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}
