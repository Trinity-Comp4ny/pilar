import { Navigate, Outlet } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { moduleOfFeature, type FeatureKey } from "@/lib/features";
import type { Feature, Action } from "@/lib/permissions";

type Props = {
  feature: Feature;
  minAction?: Action;
};

export function FeatureRoute({ feature, minAction = "view" }: Props) {
  const { can, moduloVisivel } = usePermissions();

  // ADR 0066: módulo oculto para a empresa ou para o usuário volta para o Início (sempre visível).
  const modulo = moduleOfFeature(feature as FeatureKey);
  if (modulo && !moduloVisivel(modulo)) {
    return <Navigate to="/inicio" replace state={{ moduloOculto: modulo }} />;
  }

  if (!can(feature, minAction)) {
    return <Navigate to={`/sem-acesso?recurso=${feature}`} replace />;
  }

  return <Outlet />;
}
