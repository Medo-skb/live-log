import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { clearAuthSession, hasValidAuthSession, markSessionExpired } from '../../utils/authStorage';

function ProtectedRoute() {
  const location = useLocation();

  if (!hasValidAuthSession()) {
    clearAuthSession();
    markSessionExpired();

    return (
      <Navigate
        replace
        state={{ from: location.pathname, sessionExpired: true }}
        to="/"
      />
    );
  }

  return <Outlet />;
}

export default ProtectedRoute;
