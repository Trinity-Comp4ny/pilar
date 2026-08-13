import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2,
  Circle,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import {
  useOnboardingProgress,
  type OnboardingSectionView,
  type OnboardingStepView,
} from "@/hooks/useOnboardingProgress";
import { useOnboardingState } from "@/hooks/useOnboardingState";
import type { OnboardingPilar } from "@/lib/onboarding/steps";

/**
 * Painel flutuante de primeiros passos (canto inferior direito). Três seções por
 * pilar (Gestão / Projetos / Obras), progresso derivado de dados reais. Só para
 * admin/owner. Minimiza para uma pílula (estado local) e dispensa de vez (banco).
 */
export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const { hasEmpresa, loading, sections, doneSteps, totalSteps, percent, allDone } =
    useOnboardingProgress();
  const { state, dismiss, setCompleted } = useOnboardingState();

  const [open, setOpen] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<OnboardingPilar>>(new Set());

  useEffect(() => {
    if (allDone && !state.completed_at) void setCompleted();
  }, [allDone, state.completed_at, setCompleted]);

  if (!isAdmin || !hasEmpresa || loading || state.dismissed || sections.length === 0) {
    return null;
  }

  const toggleSection = (pilar: OnboardingPilar) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(pilar)) next.delete(pilar);
      else next.add(pilar);
      return next;
    });
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-ink shadow-elegant transition-transform hover:scale-[1.02]"
      >
        <Rocket className="h-4 w-4" />
        <span className="text-sm font-medium">Primeiros passos</span>
        <span className="text-xs font-semibold tabular-nums">
          {doneSteps}/{totalSteps}
        </span>
      </button>
    );
  }

  if (allDone) {
    return (
      <div className="fixed bottom-4 right-4 z-40 w-[340px] max-w-[calc(100vw-2rem)]">
        <Card className="border-success-soft-border bg-success-soft">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-brand">
                <CheckCircle2 className="h-5 w-5 text-ink" />
              </div>
              <div>
                <p className="text-sm font-medium text-ink">Setup concluído</p>
                <p className="text-xs text-ink/60">Seu escritório está pronto para operar.</p>
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void dismiss()}>
              Ok
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)]">
      <Card className="border-brand/30 shadow-elegant">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-brand/15">
                <Rocket className="h-4 w-4 text-ink" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">Primeiros passos</p>
                <p className="text-xs text-ink/60">
                  {doneSteps} de {totalSteps} concluído{doneSteps === 1 ? "" : "s"} · {percent}%
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => setOpen(false)}
                aria-label="Minimizar"
                title="Minimizar"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => void dismiss()}
                aria-label="Dispensar"
                title="Dispensar (reative em Configurações)"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <Progress value={percent} className="h-1.5" />

          <div className="space-y-2">
            {sections.map((section) => (
              <SectionBlock
                key={section.pilar}
                section={section}
                collapsed={collapsed.has(section.pilar)}
                onToggle={() => toggleSection(section.pilar)}
                onStep={(rota) => navigate(rota)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SectionBlock({
  section,
  collapsed,
  onToggle,
  onStep,
}: {
  section: OnboardingSectionView;
  collapsed: boolean;
  onToggle: () => void;
  onStep: (rota: string) => void;
}) {
  const done = section.done === section.total;
  return (
    <div className="rounded-lg border border-border-subtle">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 px-3 py-2"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-ink">
          {section.label}
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
              done ? "bg-success-soft text-positive-strong" : "bg-surface-muted text-ink/60",
            )}
          >
            {section.done}/{section.total}
          </span>
        </span>
        {collapsed ? (
          <ChevronDown className="h-4 w-4 text-ink/40" />
        ) : (
          <ChevronUp className="h-4 w-4 text-ink/40" />
        )}
      </button>

      {!collapsed && (
        <div className="space-y-1 px-2 pb-2">
          {section.steps.map((step) => (
            <StepRow key={step.key} step={step} onClick={() => onStep(step.rota)} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepRow({ step, onClick }: { step: OnboardingStepView; onClick: () => void }) {
  const { done } = step;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={done}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors",
        done ? "cursor-default bg-success-soft/50" : "hover:bg-brand/5",
      )}
    >
      {done ? (
        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-positive-strong" />
      ) : (
        <Circle className="h-4 w-4 flex-shrink-0 text-ink/25" />
      )}
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-[13px] font-medium",
            done ? "text-positive-strong line-through" : "text-ink",
          )}
        >
          {step.titulo}
          {step.opcional && !done && (
            <span className="ml-1.5 text-[11px] font-normal text-ink/40">opcional</span>
          )}
        </span>
        {!done && (
          <span className="mt-0.5 block text-[11px] leading-snug text-ink/50">{step.descricao}</span>
        )}
      </span>
      {!done && <ChevronRight className="h-4 w-4 flex-shrink-0 text-ink/30" />}
    </button>
  );
}
