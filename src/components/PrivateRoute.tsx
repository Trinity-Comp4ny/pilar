import { useEffect, useState } from "react";
import { Navigate, useLocation, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "./Layout";

export function PrivateRoute() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();
  const [redirectPath, setRedirectPath] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          // Check if there's a hash that might indicate an incoming auth redirect
          if (window.location.hash && window.location.hash.includes("access_token")) {
            // Let onAuthStateChange handle it
            return;
          }

          if (mounted) {
            setIsAuthenticated(false);
            setIsLoading(false);
          }
          return;
        }

        if (mounted) setIsAuthenticated(true);

        // Check onboarding status
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*, empresas(*)")
          .eq("id", session.user.id)
          .single();

        if (error) {
          if (mounted) setIsLoading(false);
          return;
        }

        if (profile && mounted) {
          const userProfile = profile;
          const isCompanySetup = location.pathname === "/company-setup";
          const isProfileSetup = location.pathname === "/profile-setup";

          const profileDone = userProfile.onboarding_completed === true;
          const companyDone = userProfile.empresas?.onboarding_completed === true;
          const isAdmin = userProfile.role === "admin";

          if (!profileDone) {
            if (!isProfileSetup) {
              setRedirectPath("/profile-setup");
            } else {
              setRedirectPath(null);
            }
          } else if (isAdmin && !companyDone) {
            if (!isCompanySetup && !isProfileSetup) {
              setRedirectPath("/company-setup");
            } else {
              setRedirectPath(null);
            }
          } else if (isCompanySetup || isProfileSetup) {
            setRedirectPath("/dashboard");
          } else {
            setRedirectPath(null);
          }
        }
      } catch {
        if (mounted) setIsAuthenticated(false);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setIsAuthenticated(!!session);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [location.pathname]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  // If on setup pages, render WITHOUT Layout (sidebar etc)
  if (location.pathname === "/company-setup" || location.pathname === "/profile-setup") {
    return <Outlet />;
  }

  return <Layout />;
}
