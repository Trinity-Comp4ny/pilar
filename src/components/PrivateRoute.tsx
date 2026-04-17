import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "./Layout";

export function PrivateRoute() {
  const { isAuthenticated, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (profile) {
    const isCompanySetup = location.pathname === "/company-setup";
    const isProfileSetup = location.pathname === "/profile-setup";
    const profileDone = profile.onboarding_completed === true;
    const companyDone = profile.empresas?.onboarding_completed === true;
    const isAdmin = profile.role === "admin";

    if (!profileDone && !isProfileSetup) {
      return <Navigate to="/profile-setup" replace />;
    }

    if (profileDone && isAdmin && !companyDone && !isCompanySetup && !isProfileSetup) {
      return <Navigate to="/company-setup" replace />;
    }

    if ((isCompanySetup || isProfileSetup) && profileDone && (!isAdmin || companyDone)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  if (location.pathname === "/company-setup" || location.pathname === "/profile-setup") {
    return <Outlet />;
  }

  return <Layout />;
}
