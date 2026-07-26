import { Badge } from "@/components/ui/badge";
import { statusBadgeClasses, statusLabel, type StatusDomain } from "@/lib/status";
import { cn } from "@/lib/utils";

/**
 * Badge de status com cor resolvida pelo registry único (ADR 0008).
 * Uso: <StatusBadge domain="financeiro" status="Pago" />
 * Nunca passar cor por fora; se o status precisa de outro tom, muda no registry.
 */
interface StatusBadgeProps {
  domain: StatusDomain;
  status: string;
  className?: string;
}

export function StatusBadge({ domain, status, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn("border-transparent", statusBadgeClasses(domain, status), className)}>
      {statusLabel(domain, status)}
    </Badge>
  );
}
