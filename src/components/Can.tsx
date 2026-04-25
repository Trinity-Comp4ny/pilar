import type { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import type { Action, Feature } from "@/lib/permissions";

type CanProps = {
  feature: Feature;
  action?: Action;
  fallback?: ReactNode;
  children: ReactNode;
};

export function Can({ feature, action = "view", fallback = null, children }: CanProps) {
  const { can } = usePermissions();
  return <>{can(feature, action) ? children : fallback}</>;
}

type CannotProps = {
  feature: Feature;
  action?: Action;
  children: ReactNode;
};

export function Cannot({ feature, action = "view", children }: CannotProps) {
  const { cannot } = usePermissions();
  return <>{cannot(feature, action) ? children : null}</>;
}
