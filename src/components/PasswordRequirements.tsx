import { Check, Circle } from "lucide-react";
import { passwordChecks } from "@/lib/passwordPolicy";
import { cn } from "@/lib/utils";

/** Checklist dos requisitos da senha; cada item fica verde quando atendido. */
export function PasswordRequirements({ password }: { password: string }) {
  const checks = passwordChecks(password);
  return (
    <ul className="space-y-1 text-xs" aria-label="Requisitos da senha">
      {checks.map((c) => (
        <li key={c.label} className={cn("flex items-center gap-1.5", c.ok ? "text-positive-strong" : "text-ink-muted")}>
          {c.ok ? (
            <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="h-3.5 w-3.5 flex-shrink-0 text-ink/25" aria-hidden="true" />
          )}
          {c.label}
        </li>
      ))}
    </ul>
  );
}
