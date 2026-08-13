import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

function useTrial(empresaId: string | null | undefined) {
  return useQuery({
    queryKey: ["trial-subscription", empresaId],
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      if (!empresaId) return null;
      const { data, error } = await supabase
        .from("pilar_subscriptions")
        .select("status, trial_ends_at")
        .eq("empresa_id", empresaId)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });
}

export function TrialBanner() {
  const { profile } = useAuth();
  const { openSettings } = useSettingsModal();
  const empresaId = profile?.empresa_id;
  const { data: subscription } = useTrial(empresaId);

  if (!subscription) return null;

  const { status, trial_ends_at } = subscription;

  if (status === "active") return null;

  // Bloqueio total — trial expirado
  if (status === "expired") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="mx-4 max-w-md w-full rounded-2xl bg-white p-8 shadow-2xl text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft">
            <AlertTriangle className="h-7 w-7 text-danger-mid" strokeWidth={1.5} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold tracking-tight text-ink">Seu trial expirou</h2>
            <p className="text-sm text-ink-muted leading-relaxed">
              O período gratuito da sua empresa chegou ao fim. Assine um plano para continuar acessando o Pilar.
            </p>
          </div>
          <Button className="w-full" size="lg" variant="brand" onClick={() => openSettings("pagamento")}>
            Assinar para continuar →
          </Button>
          <p className="text-xs text-ink-disabled">Precisa de ajuda? Entre em contato com o suporte.</p>
        </div>
      </div>
    );
  }

  if (status !== "trialing" || !trial_ends_at) return null;

  const daysLeft = differenceInDays(parseISO(trial_ends_at), new Date());

  if (daysLeft > 7) return null;

  const urgent = daysLeft <= 1;
  const label =
    daysLeft <= 0
      ? "Seu trial expira hoje."
      : daysLeft === 1
        ? "Seu trial expira amanhã."
        : `Seu trial expira em ${daysLeft} dias.`;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium ${
        urgent ? "bg-red-600 text-white" : "bg-amber-400 text-amber-950"
      }`}
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2} />
        <span>{label}</span>
      </div>
      <button
        type="button"
        onClick={() => openSettings("pagamento")}
        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
          urgent ? "bg-white text-red-600 hover:bg-red-50" : "bg-amber-950/10 text-amber-950 hover:bg-amber-950/20"
        }`}
      >
        Assinar agora →
      </button>
    </div>
  );
}
