import { Navigate, Outlet } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import type { Feature, Action } from "@/lib/permissions";

type Props = {
  feature: Feature;
  minAction?: Action;
};

export function FeatureRoute({ feature, minAction = "view" }: Props) {
  const { can } = usePermissions();

  if (!can(feature, minAction)) {
    return <Navigate to={`/sem-acesso?recurso=${feature}`} replace />;
  }

  return <Outlet />;
}
