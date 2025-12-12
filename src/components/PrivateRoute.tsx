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
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
          // Check if there's a hash that might indicate an incoming auth redirect
          if (window.location.hash && window.location.hash.includes('access_token')) {
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
          .from('profiles')
          .select('*, empresas(*)')
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error("Error fetching profile:", error);
          if (mounted) setIsLoading(false);
          return;
        }

        if (profile && mounted) {
          const userProfile = profile as any;
          const isCompanySetup = location.pathname === '/company-setup';
          const isProfileSetup = location.pathname === '/profile-setup';

          // Default "Minha Empresa" name check for admins
          const isNewCompany = userProfile.role === 'admin' && userProfile.empresas?.nome === 'Minha Empresa';
          // Name same as email check for invited users OR if they explicitly need setup
          // We also check if 'contato' is missing as a proxy for completed profile setup
          const isNewUser = !userProfile.contato || userProfile.nome === userProfile.email;

          // Priority: Profile -> Company -> Dashboard
          if (isNewUser) {
            if (!isProfileSetup) {
              setRedirectPath('/profile-setup');
            } else {
              setRedirectPath(null);
            }
          } else if (isNewCompany) {
            // Allow toggling between the two setup pages during onboarding
            if (!isCompanySetup && !isProfileSetup) {
              setRedirectPath('/company-setup');
            } else {
              setRedirectPath(null);
            }
          } else if (isCompanySetup || isProfileSetup) {
            // If they are done but trying to access setup pages
            setRedirectPath('/dashboard');
          } else {
            setRedirectPath(null);
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
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
  if (location.pathname === '/company-setup' || location.pathname === '/profile-setup') {
    return <Outlet />;
  }

  return <Layout />;
}
