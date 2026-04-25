import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlans } from "@/pages/planos/hooks/usePlans";
import { CycleToggle, type BillingCycle } from "@/pages/planos/components/CycleToggle";
import { useSubscriptionManage } from "../hooks/useSubscriptionManage";
import type { MySubscription } from "../hooks/useMySubscription";

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  current: MySubscription;
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ChangePlanDialog({ open, onOpenChange, current }: ChangePlanDialogProps) {
  const { data: plans } = usePlans();
  const manage = useSubscriptionManage();

  const initialCycle: BillingCycle = current.billing_cycle === "yearly" ? "yearly" : "monthly";
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const [selectedSlug, setSelectedSlug] = useState<string>(current.plan?.slug ?? "");

  const handleConfirm = () => {
    if (!selectedSlug) return;

    const noChange = selectedSlug === current.plan?.slug && cycle === current.billing_cycle;
    if (noChange) {
      toast.info("Nenhuma alteração selecionada");
      return;
    }

    manage.mutate(
      { action: "update_plan", new_plan_slug: selectedSlug, new_cycle: cycle },
      {
        onSuccess: () => {
          toast.success("Plano atualizado", {
            description: "Próximas cobranças já usam o novo valor.",
          });
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error("Erro ao trocar plano", {
            description: (err as Error).message,
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Mudar plano</DialogTitle>
          <DialogDescription>
            A troca é aplicada imediatamente. Cobranças pendentes são atualizadas com o novo valor.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <CycleToggle value={cycle} onChange={setCycle} />
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          {(plans ?? []).map((plan) => {
            const price = cycle === "yearly" ? (plan.preco_anual ?? plan.preco_mensal * 12) / 12 : plan.preco_mensal;
            const isSelected = plan.slug === selectedSlug;
            const isCurrent = plan.slug === current.plan?.slug && cycle === current.billing_cycle;

            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => setSelectedSlug(plan.slug)}
                className={cn(
                  "relative text-left p-4 rounded-xl border-2 transition-all",
                  isSelected ? "border-accent-orange bg-accent-orange/5" : "border-slate-200 hover:border-slate-300"
                )}
              >
                {isCurrent && (
                  <span className="absolute top-2 right-2 text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    Atual
                  </span>
                )}
                {isSelected && !isCurrent && (
                  <span className="absolute top-2 right-2">
                    <Check className="w-4 h-4 text-accent-orange" />
                  </span>
                )}
                <p className="text-sm font-medium text-slate-900">{plan.nome}</p>
                <p className="text-2xl font-semibold text-slate-900 mt-2">{formatBRL(price)}</p>
                <p className="text-xs text-slate-500">/mês</p>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={manage.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={manage.isPending || !selectedSlug}
            className="bg-accent-orange hover:bg-accent-orange/90 text-ink"
          >
            {manage.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Atualizando...
              </>
            ) : (
              "Confirmar mudança"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
