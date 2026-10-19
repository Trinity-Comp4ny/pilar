import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  /** `brand`: círculo verde da marca com ícone preto (primeira ação, ex.: "+"). Padrão `muted`. */
  iconTone?: "muted" | "brand";
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "brand";
  };
  children?: ReactNode;
  className?: string;
  /** Uma linha de texto centralizada, para lista ou card vazio (sem ícone, título em destaque nem ação). */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon,
  iconTone = "muted",
  title,
  description,
  action,
  children,
  className = "",
  compact = false,
}: EmptyStateProps) {
  if (compact) {
    return (
      <p className={`py-6 text-center text-sm text-muted-foreground ${className}`} role="status">
        {title}
      </p>
    );
  }
  return (
    <div className={`flex flex-col items-center justify-center text-center py-12 px-6 ${className}`} role="status">
      {Icon && (
        <div className={iconTone === "brand" ? "mb-4 rounded-full bg-brand p-4" : "mb-4 rounded-full bg-muted p-4"}>
          <Icon
            className={iconTone === "brand" ? "h-8 w-8 text-ink" : "h-8 w-8 text-muted-foreground"}
            strokeWidth={iconTone === "brand" ? 2.2 : undefined}
            aria-hidden="true"
          />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-md mb-4">{description}</p>}
      {action && (
        <Button onClick={action.onClick} variant={action.variant ?? "default"} size="sm">
          {action.label}
        </Button>
      )}
      {children}
    </div>
  );
}
