import { Navigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "./Layout";

export function PrivateRoute() {
  const { isAuthenticated, profile, loading, mfaChallengeRequired, hasVerifiedMfaFactor } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (mfaChallengeRequired && location.pathname !== "/mfa") {
    return <Navigate to="/mfa" replace />;
  }

  if (profile) {
    const isCompanySetup = location.pathname === "/company-setup";
    const isProfileSetup = location.pathname === "/profile-setup";
    const isMfaChallenge = location.pathname === "/mfa";
    const isMfaSetup = location.pathname === "/mfa/setup";
    const profileDone = profile.onboarding_completed === true;
    const companyDone = profile.empresas?.onboarding_completed === true;
    const isAdmin = profile.role === "admin";

    if (isMfaChallenge || isMfaSetup) {
      return <Outlet />;
    }

    if (!profileDone && !isProfileSetup) {
      return <Navigate to="/profile-setup" replace />;
    }

    if (profileDone && isAdmin && !companyDone && !isCompanySetup && !isProfileSetup) {
      return <Navigate to="/company-setup" replace />;
    }

    if ((isCompanySetup || isProfileSetup) && profileDone && (!isAdmin || companyDone)) {
      return <Navigate to="/dashboard" replace />;
    }

    if (isAdmin && profileDone && companyDone && !hasVerifiedMfaFactor && !isMfaSetup) {
      return <Navigate to="/mfa/setup" replace />;
    }
  }

  if (
    location.pathname === "/company-setup" ||
    location.pathname === "/profile-setup" ||
    location.pathname === "/mfa" ||
    location.pathname === "/mfa/setup"
  ) {
    return <Outlet />;
  }

  return <Layout />;
}
