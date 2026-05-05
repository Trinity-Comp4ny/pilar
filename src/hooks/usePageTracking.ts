import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { monitoring } from "@/lib/monitoring";
import { analytics } from "@/lib/analytics";

/**
 * Registra breadcrumb Sentry + pageview PostHog a cada mudança de rota.
 * Deve ser montado dentro de <BrowserRouter>.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    monitoring.addBreadcrumb("navigation", { path: location.pathname });
    analytics.track("$pageview", { path: location.pathname });
  }, [location.pathname]);
}
