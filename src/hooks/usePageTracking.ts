import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { monitoring } from "@/lib/monitoring";
import { analytics } from "@/lib/analytics";
import { routeToModule } from "@/lib/modules";

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Troca id de registro por `:id`: agrupa /projetos/<uuid> numa rota só e não manda id de cliente ao PostHog. */
export function rotaSemIds(pathname: string): string {
  return pathname.replace(UUID, ":id");
}

/**
 * Registra breadcrumb Sentry + pageview PostHog a cada mudança de rota.
 * Deve ser montado dentro de <BrowserRouter>.
 */
export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    monitoring.addBreadcrumb("navigation", { path: location.pathname });
    analytics.track("$pageview", { path: rotaSemIds(location.pathname), modulo: routeToModule(location.pathname) });
  }, [location.pathname]);
}
