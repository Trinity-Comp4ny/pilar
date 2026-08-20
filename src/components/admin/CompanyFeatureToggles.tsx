import { useMemo, useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyFeatureToggle,
  FEATURES,
  type CompanyFeatures,
  type FeatureDefinition,
} from "@/lib/features";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type CompanyFeatureTogglesProps = {
  value: CompanyFeatures;
  onChange: (next: CompanyFeatures) => void;
  className?: string;
  /** Desabilita todos os toggles (ex.: enquanto uma alteração é salva). */
  disabled?: boolean;
};

/**
 * Toggle de acesso antecipado a módulo ainda não pronto pra todo mundo
 * (`universal: false` em features.ts: IA Hub, Capacidade, Templates,
 * Timesheet). Módulo maduro (Financeiro, Projetos, Obras...) não aparece mais
 * aqui: é universal, toda empresa já tem, sem toggle. Ver ADR 0026.
 */
export function CompanyFeatureToggles({
  value,
  onChange,
  className,
  disabled = false,
}: CompanyFeatureTogglesProps) {
  const [pendingDisable, setPendingDisable] = useState<FeatureDefinition | null>(null);

  const earlyAccessFeatures = useMemo(() => FEATURES.filter((f) => !f.universal), []);

  const applyToggle = (feature: FeatureDefinition, nextEnabled: boolean) => {
    onChange(applyFeatureToggle(value, feature.key, nextEnabled));
  };

  const handleToggle = (feature: FeatureDefinition, nextEnabled: boolean) => {
    // Desligar tira o módulo de todos na empresa: confirma antes.
    if (!nextEnabled && Boolean(value[feature.key])) {
      setPendingDisable(feature);
      return;
    }
    applyToggle(feature, nextEnabled);
  };

  const confirmDisable = () => {
    if (!pendingDisable) return;
    applyToggle(pendingDisable, false);
    setPendingDisable(null);
  };

  if (earlyAccessFeatures.length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <div>
        <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-black/40">
          <Sparkles size={12} strokeWidth={2} />
          Acesso antecipado
        </div>
        <p className="mb-2 px-1 text-xs text-black/50">
          Módulo ainda não pronto pra todo mundo. Ligar aqui dá acesso só a esta empresa, antes do lançamento geral.
        </p>
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
          {earlyAccessFeatures.map((feature, idx) => (
            <EarlyAccessRow
              key={feature.key}
              feature={feature}
              enabled={Boolean(value[feature.key])}
              onToggle={(next) => handleToggle(feature, next)}
              isLast={idx === earlyAccessFeatures.length - 1}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      <AlertDialog
        open={pendingDisable !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDisable(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle size={18} className="text-destructive" strokeWidth={1.5} />
              Desativar {pendingDisable?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todo mundo nesta empresa perde o acesso ao módulo na hora. Você pode reativar depois, sem perda de
              dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDisable}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type EarlyAccessRowProps = {
  feature: FeatureDefinition;
  enabled: boolean;
  onToggle: (next: boolean) => void;
  isLast: boolean;
  disabled?: boolean;
};

function EarlyAccessRow({ feature, enabled, onToggle, isLast, disabled = false }: EarlyAccessRowProps) {
  const Icon = feature.icon;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
        !isLast && "border-b border-black/5"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
            enabled ? "bg-brand/10" : "bg-black/5"
          )}
        >
          <Icon size={16} strokeWidth={1.5} className={enabled ? "text-ink" : "text-black/50"} />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-black/80">{feature.label}</span>
            {feature.addon && (
              <Badge
                variant="outline"
                className="h-5 rounded-full border-brand/30 bg-brand px-2 text-[10px] font-medium text-ink"
              >
                Add-on {feature.addonPriceLabel}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="h-5 rounded-full border-black/10 bg-black/5 px-2 text-[10px] font-medium text-black/50"
            >
              Em breve
            </Badge>
          </div>
          <p className="text-xs text-black/50">{feature.description}</p>
        </div>
      </div>

      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        disabled={disabled}
        aria-label={`Ativar ou desativar ${feature.label}`}
      />
    </div>
  );
}
