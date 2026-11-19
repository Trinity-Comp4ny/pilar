import { Navigate, Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { MODULES, MODULE_ORDER, routeToModule } from "@/lib/modules";
import type { Feature, Action } from "@/lib/permissions";

type Props = {
  feature: Feature;
  minAction?: Action;
};

export function FeatureRoute({ feature, minAction = "view" }: Props) {
  const { can, moduloVisivel } = usePermissions();
  const { pathname } = useLocation();

  // ADR 0066: módulo oculto para a empresa ou para o usuário. Cai no primeiro visível.
  const modulo = routeToModule(pathname);
  if (modulo && !moduloVisivel(modulo)) {
    const destino = MODULE_ORDER.find((id) => moduloVisivel(id));
    return <Navigate to={destino ? MODULES[destino].homeRoute : "/inicio"} replace state={{ moduloOculto: modulo }} />;
  }

  if (!can(feature, minAction)) {
    return <Navigate to={`/sem-acesso?recurso=${feature}`} replace />;
  }

  return <Outlet />;
}
