import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { FEATURES_BY_KEY, type FeatureKey, type UserFeatures } from "@/lib/features";
import type { PilarRole } from "@/lib/roles";
import { ShieldCheck, ShieldAlert } from "lucide-react";

export type AccessBadgesProps = {
  role: PilarRole;
  features?: UserFeatures;
  emptyLabel?: string;
  maxVisible?: number;
  className?: string;
};

export function AccessBadges({
  role,
  features = {},
  emptyLabel = "Sem acesso",
  maxVisible = 6,
  className,
}: AccessBadgesProps) {
  if (role === "ultra_admin") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "h-6 gap-1 rounded-full border-red-600/30 bg-red-600/10 px-2 text-[11px] font-medium text-red-700",
          className
        )}
      >
        <ShieldAlert size={12} strokeWidth={2} />
        Ultra admin
      </Badge>
    );
  }

  if (role === "admin") {
    return (
      <Badge
        variant="outline"
        className={cn(
          "h-6 gap-1 rounded-full border-accent-orange/30 bg-accent-orange/10 px-2 text-[11px] font-medium text-accent-orange",
          className
        )}
      >
        <ShieldCheck size={12} strokeWidth={2} />
        Admin da empresa
      </Badge>
    );
  }

  const entries = Object.entries(features).filter(([, level]) => level === "viewer" || level === "editor") as [
    FeatureKey,
    "viewer" | "editor",
  ][];

  if (entries.length === 0) {
    return <span className={cn("text-xs text-black/40", className)}>{emptyLabel}</span>;
  }

  const visible = entries.slice(0, maxVisible);
  const extra = entries.length - visible.length;

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {visible.map(([key, level]) => {
        const def = FEATURES_BY_KEY[key];
        if (!def) return null;
        const isEditor = level === "editor";
        return (
          <Badge
            key={key}
            variant="outline"
            className={cn(
              "h-6 rounded-full px-2 text-[11px] font-medium",
              isEditor
                ? "border-emerald-600/30 bg-emerald-600/10 text-emerald-700"
                : "border-black/15 bg-black/5 text-black/60"
            )}
            title={`${def.label}: ${isEditor ? "Editor" : "Viewer"}`}
          >
            {def.label}
            <span className={cn("ml-1 text-[10px] opacity-70")}>{isEditor ? "E" : "V"}</span>
          </Badge>
        );
      })}
      {extra > 0 && (
        <Badge
          variant="outline"
          className="h-6 rounded-full border-black/10 bg-white px-2 text-[11px] font-medium text-black/50"
        >
          +{extra}
        </Badge>
      )}
    </div>
  );
}
