import { useState } from "react";
import { Check } from "lucide-react";
import { FormDialog } from "@/components/FormDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlans, capacidadeDoPlano } from "@/hooks/usePlans";
import { formatCurrency } from "@/lib/format";
import { useSubscriptionManage } from "../hooks/useSubscriptionManage";
import type { MySubscription } from "../hooks/useMySubscription";

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: MySubscription;
}

// A landing só vende ciclo mensal (a v3 registra anual como N/A): o seletor de ciclo saiu
// e o valor mostrado é sempre o mensal, igual ao de /planos. Quem já está num ciclo anual
// mantém o ciclo ao trocar só de plano.
export function ChangePlanDialog({ open, onOpenChange, current }: ChangePlanDialogProps) {
  const { data: plans } = usePlans();
  const manage = useSubscriptionManage();
  const cycle = current.billing_cycle === "yearly" ? "yearly" : "monthly";
  const [selectedSlug, setSelectedSlug] = useState<string>(current.plan?.slug ?? "");

  const handleConfirm = () => {
    if (!selectedSlug) return;
    if (selectedSlug === current.plan?.slug) {
      toast.info("Nenhuma alteração selecionada");
      return;
    }
    manage.mutate(
      { action: "update_plan", new_plan_slug: selectedSlug, new_cycle: cycle },
      {
        onSuccess: () => {
          toast.success("Plano atualizado", { description: "Próximas cobranças já usam o novo valor." });
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error("Erro ao trocar plano", { description: (err as Error).message });
        },
      }
    );
  };

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Mudar plano"
      description="A troca vale na hora e as cobranças pendentes passam a usar o novo valor. Todo plano tem a plataforma inteira: muda só a capacidade."
      size="lg"
      zClassName="z-70"
      onSubmit={handleConfirm}
      submitLabel="Confirmar mudança"
      isPending={manage.isPending}
      submitDisabled={!selectedSlug || selectedSlug === current.plan?.slug}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        {(plans ?? []).map((plan) => {
          const price =
            cycle === "yearly" ? (plan.preco_anual ?? plan.preco_mensal * 12) / 12 : plan.preco_mensal;
          const isSelected = plan.slug === selectedSlug;
          const isCurrent = plan.slug === current.plan?.slug;
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => setSelectedSlug(plan.slug)}
              aria-pressed={isSelected}
              className={cn(
                "relative rounded-xl border p-3.5 text-left transition-colors",
                isSelected ? "border-ink bg-muted/50" : "border-border hover:border-ink/40"
              )}
            >
              {isCurrent ? (
                <span className="absolute right-2.5 top-2.5 rounded-full bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                  Atual
                </span>
              ) : (
                isSelected && <Check className="absolute right-2.5 top-2.5 h-4 w-4 text-ink" aria-hidden />
              )}
              <p className="text-sm font-medium text-ink">{plan.nome}</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
                {formatCurrency(price)}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/mês</span>
              </p>
              <ul className="mt-2.5 space-y-1 border-t border-border pt-2.5">
                {capacidadeDoPlano(plan).map((linha) => (
                  <li key={linha} className="text-xs leading-snug text-muted-foreground">
                    {linha}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </FormDialog>
  );
}
