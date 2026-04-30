import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronRight, X, Rocket, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const DISMISS_KEY_PREFIX = "pilar_onboarding_dismissed_";
const COLLAPSE_KEY_PREFIX = "pilar_onboarding_collapsed_";

interface StepConfig {
  key: string;
  title: string;
  description: string;
  cta: string;
  ctaPath: string;
  count: number;
  required?: boolean;
}

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const empresaId = profile?.empresa_id ?? null;
  const userId = user?.id ?? null;

  const dismissKey = userId ? `${DISMISS_KEY_PREFIX}${userId}` : null;
  const collapseKey = userId ? `${COLLAPSE_KEY_PREFIX}${userId}` : null;

  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!dismissKey) return false;
    return localStorage.getItem(dismissKey) === "1";
  });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (!collapseKey) return false;
    return localStorage.getItem(collapseKey) === "1";
  });

  const { data: counts, isLoading } = useQuery({
    queryKey: ["onboarding-counts", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;

      const [pessoasRes, clientesRes, leadsRes, propostasRes, projetosRes, usuariosRes] = await Promise.all([
        supabase
          .from("pessoas")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .is("deleted_at", null),
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .is("deleted_at", null),
        supabase
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .is("deleted_at", null),
        supabase
          .from("propostas")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .is("deleted_at", null),
        supabase
          .from("projetos")
          .select("id", { count: "exact", head: true })
          .eq("empresa_id", empresaId)
          .is("deleted_at", null),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("empresa_id", empresaId),
      ]);

      return {
        pessoas: pessoasRes.count ?? 0,
        clientes: clientesRes.count ?? 0,
        leads: leadsRes.count ?? 0,
        propostas: propostasRes.count ?? 0,
        projetos: projetosRes.count ?? 0,
        usuarios: usuariosRes.count ?? 0,
      };
    },
    enabled: !!empresaId,
    staleTime: 1000 * 60 * 2,
  });

  const steps: StepConfig[] = useMemo(() => {
    const c = counts ?? { pessoas: 0, clientes: 0, leads: 0, propostas: 0, projetos: 0, usuarios: 0 };
    return [
      {
        key: "pessoa",
        title: "Cadastre sua primeira pessoa",
        description: "Equipe técnica que executa os projetos",
        cta: "Ir para Equipe",
        ctaPath: "/pessoas",
        count: c.pessoas,
      },
      {
        key: "cliente",
        title: "Cadastre seu primeiro cliente",
        description: "Quem contrata os serviços do escritório",
        cta: "Ir para Clientes",
        ctaPath: "/clientes",
        count: c.clientes,
      },
      {
        key: "lead",
        title: "Registre seu primeiro lead",
        description: "Oportunidade comercial em prospecção",
        cta: "Ir para Leads",
        ctaPath: "/leads",
        count: c.leads,
      },
      {
        key: "proposta",
        title: "Crie sua primeira proposta",
        description: "Orçamento comercial vinculado a um cliente ou lead",
        cta: "Ir para Propostas",
        ctaPath: "/documentos",
        count: c.propostas,
      },
      {
        key: "projeto",
        title: "Inicie seu primeiro projeto",
        description: "Projeto executado com disciplinas, escopo e cronograma",
        cta: "Ir para Projetos",
        ctaPath: "/projetos",
        count: c.projetos,
      },
      {
        key: "time",
        title: "Convide alguém do seu time",
        description: "Colaboração só funciona com mais de um usuário",
        cta: "Abrir Admin Portal",
        ctaPath: "/admin?tab=usuarios",
        count: c.usuarios > 1 ? 1 : 0,
        required: false,
      },
    ];
  }, [counts]);

  const completedSteps = steps.filter((s) => s.count > 0).length;
  const totalSteps = steps.length;
  const percent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
  const allDone = completedSteps === totalSteps;

  const handleDismiss = () => {
    if (dismissKey) localStorage.setItem(dismissKey, "1");
    setDismissed(true);
  };

  const handleToggleCollapse = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (collapseKey) localStorage.setItem(collapseKey, next ? "1" : "0");
  };

  // Reset dismissed se o user re-iniciar onboarding via botão de reset (não implementado aqui)
  useEffect(() => {
    if (!dismissKey) return;
    if (dismissed && localStorage.getItem(dismissKey) !== "1") {
      setDismissed(false);
    }
  }, [dismissKey, dismissed]);

  if (!empresaId || dismissed || isLoading || !counts) return null;

  // Oculta automaticamente quando tudo está completo — usuário pode dispensar manualmente também
  if (allDone) {
    return (
      <Card className="border-emerald-200/70 bg-emerald-50/30">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-900">Setup inicial concluído</p>
              <p className="text-xs text-emerald-700/80">Seu escritório está pronto para operar no Pilar.</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={handleDismiss}>
            Dispensar
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-accent-orange/30 bg-gradient-to-br from-accent-orange/5 to-transparent">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-accent-orange/15 flex items-center justify-center flex-shrink-0">
              <Rocket className="h-4.5 w-4.5 text-accent-orange" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-black">Primeiros passos no Pilar</p>
              <p className="text-xs text-black/60">
                {completedSteps} de {totalSteps} concluído{completedSteps === 1 ? "" : "s"} · {percent}%
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleToggleCollapse}>
              {collapsed ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleDismiss} title="Dispensar">
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <Progress value={percent} className="h-1.5" />

        {!collapsed && (
          <div className="space-y-1.5">
            {steps.map((step) => (
              <StepRow key={step.key} step={step} onClick={() => navigate(step.ctaPath)} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StepRow({ step, onClick }: { step: StepConfig; onClick: () => void }) {
  const done = step.count > 0;
  return (
    <button
      onClick={onClick}
      disabled={done}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left transition-colors",
        done
          ? "bg-emerald-50/50 cursor-default"
          : "bg-white hover:bg-accent-orange/5 border border-black/5 hover:border-accent-orange/30"
      )}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
      ) : (
        <Circle className="h-4 w-4 text-black/30 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-medium", done && "text-emerald-900 line-through decoration-emerald-300")}>
            {step.title}
          </span>
        </div>
        {!done && <p className="text-xs text-black/50 mt-0.5">{step.description}</p>}
      </div>
      {!done && (
        <div className="flex items-center gap-1 text-xs text-accent-orange font-medium flex-shrink-0">
          {step.cta}
          <ChevronRight className="h-3.5 w-3.5" />
        </div>
      )}
    </button>
  );
}
