import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FormSuccessProps {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Estado de sucesso de um form (confirmação após envio). */
export function FormSuccess({
  title = "Tudo certo!",
  description = "Registro salvo com sucesso.",
  actionLabel,
  onAction,
}: FormSuccessProps) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-12 text-center" role="status">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-success-soft">
        <CheckCircle2 className="h-8 w-8 text-positive-strong" aria-hidden />
      </div>
      <h3 className="mb-2 text-xl font-semibold text-ink">{title}</h3>
      <p className="mb-8 max-w-xs text-sm text-ink-soft">{description}</p>
      {onAction && actionLabel && (
        <Button variant="ghost" onClick={onAction} className="text-sm font-medium">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
