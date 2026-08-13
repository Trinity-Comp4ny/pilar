import { useMemo, useState } from "react";
import { Sparkles, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEATURE_GROUP_LABEL,
  FEATURE_GROUP_ORDER,
  FEATURES,
  type CompanyFeatures,
  type FeatureDefinition,
  type FeatureGroup,
  type FeatureKey,
  type SubscriptionPlanSlug,
} from "@/lib/features";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const PLAN_LABEL: Record<SubscriptionPlanSlug, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

export type CompanyFeatureTogglesProps = {
  value: CompanyFeatures;
  onChange: (next: CompanyFeatures) => void;
  currentPlan: SubscriptionPlanSlug;
  usersByFeature?: Partial<Record<FeatureKey, number>>;
  onChangePlan?: () => void;
  className?: string;
  /** Desabilita todos os toggles (ex.: enquanto uma alteração é salva). */
  disabled?: boolean;
};

export function CompanyFeatureToggles({
  value,
  onChange,
  currentPlan,
  usersByFeature,
  onChangePlan,
  className,
  disabled = false,
}: CompanyFeatureTogglesProps) {
  const [pendingDisable, setPendingDisable] = useState<FeatureDefinition | null>(null);
  const [pendingEnable, setPendingEnable] = useState<FeatureDefinition | null>(null);

  const grouped = useMemo(() => {
    const map = FEATURE_GROUP_ORDER.reduce(
      (acc, g) => {
        acc[g] = [];
        return acc;
      },
      {} as Record<FeatureGroup, FeatureDefinition[]>
    );
    for (const f of FEATURES) {
      if (f.core) continue;
      map[f.group].push(f);
    }
    return map;
  }, []);

  const totals = useMemo(() => {
    const active = FEATURES.filter((f) => f.core || value[f.key]).length;
    const addonsOn = FEATURES.filter((f) => f.addon && value[f.key]).length;
    return { active, total: FEATURES.length, addonsOn };
  }, [value]);

  const applyToggle = (feature: FeatureDefinition, nextEnabled: boolean) => {
    const next: CompanyFeatures = { ...value };
    if (nextEnabled) {
      next[feature.key] = true;
    } else {
      delete next[feature.key];
    }
    onChange(next);
  };

  const isPaidAddon = (feature: FeatureDefinition) =>
    feature.addon && !feature.includedInPlans.includes(currentPlan);

  const handleToggle = (feature: FeatureDefinition, nextEnabled: boolean) => {
    const usersAffected = usersByFeature?.[feature.key] ?? 0;
    if (!nextEnabled && usersAffected > 0) {
      setPendingDisable(feature);
      return;
    }
    if (nextEnabled && isPaidAddon(feature)) {
      setPendingEnable(feature);
      return;
    }
    applyToggle(feature, nextEnabled);
  };

  const confirmDisable = () => {
    if (!pendingDisable) return;
    applyToggle(pendingDisable, false);
    setPendingDisable(null);
  };

  const confirmEnable = () => {
    if (!pendingEnable) return;
    applyToggle(pendingEnable, true);
    setPendingEnable(null);
  };

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-col gap-4 rounded-lg border border-black/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
            <Sparkles size={18} className="text-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <div className="text-sm font-medium text-black/80">
              Plano atual: <span className="text-foreground">{PLAN_LABEL[currentPlan]}</span>
            </div>
            <p className="text-xs text-black/50">
              {totals.active} de {totals.total} features ativas
              {totals.addonsOn > 0 && (
                <>
                  {" · "}
                  <span className="font-medium text-foreground">
                    {totals.addonsOn} add-on{totals.addonsOn > 1 ? "s" : ""}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>
        {onChangePlan && (
          <Button type="button" variant="outline" size="sm" onClick={onChangePlan}>
            Alterar plano
          </Button>
        )}
      </div>

      <div className="space-y-5">
        {FEATURE_GROUP_ORDER.map((group) => {
          const features = grouped[group];
          if (features.length === 0) return null;
          return (
            <div key={group}>
              <div className="mb-2 px-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-black/40">
                {FEATURE_GROUP_LABEL[group]}
              </div>
              <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
                {features.map((feature, idx) => (
                  <FeatureToggleRow
                    key={feature.key}
                    feature={feature}
                    enabled={Boolean(value[feature.key])}
                    includedInPlan={feature.includedInPlans.includes(currentPlan)}
                    usersAffected={usersByFeature?.[feature.key] ?? 0}
                    onChange={(next) => handleToggle(feature, next)}
                    isLast={idx === features.length - 1}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          );
        })}
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
              {pendingDisable && (
                <>
                  <strong>{usersByFeature?.[pendingDisable.key] ?? 0}</strong> usuário(s) têm acesso a essa feature
                  hoje. Ao desativar, perdem o acesso imediatamente. Você pode reativar depois sem perda de dados.
                </>
              )}
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

      <AlertDialog
        open={pendingEnable !== null}
        onOpenChange={(open) => {
          if (!open) setPendingEnable(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles size={18} className="text-foreground" strokeWidth={1.5} />
              Ativar {pendingEnable?.label}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingEnable && (
                <>
                  Esse add-on <strong>não está incluso</strong> no plano {PLAN_LABEL[currentPlan]}.
                  {pendingEnable.addonPriceLabel && (
                    <>
                      {" "}
                      Custo adicional: <strong>{pendingEnable.addonPriceLabel}</strong>.
                    </>
                  )}{" "}
                  Ele passa a ser cobrado desta empresa a partir da ativação.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-brand text-ink hover:bg-brand/90" onClick={confirmEnable}>
              Ativar add-on
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type FeatureToggleRowProps = {
  feature: FeatureDefinition;
  enabled: boolean;
  includedInPlan: boolean;
  usersAffected: number;
  onChange: (next: boolean) => void;
  isLast: boolean;
  disabled?: boolean;
};

function FeatureToggleRow({
  feature,
  enabled,
  includedInPlan,
  usersAffected,
  onChange,
  isLast,
  disabled = false,
}: FeatureToggleRowProps) {
  const Icon = feature.icon;
  // Feature ainda não lançada ("Em breve"): permite desligar, mas nunca ligar.
  const lockedOn = feature.dormant && !enabled;
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
            {includedInPlan ? (
              <Badge
                variant="outline"
                className="h-5 rounded-full border-success/20 bg-success/10 px-2 text-[10px] font-medium text-success-strong"
              >
                <Check size={10} className="mr-1" strokeWidth={2.5} />
                Incluso no plano
              </Badge>
            ) : feature.addon ? (
              <Badge
                variant="outline"
                className="h-5 rounded-full border-brand/30 bg-brand px-2 text-[10px] font-medium text-ink"
              >
                Add-on {feature.addonPriceLabel}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="h-5 rounded-full border-black/10 bg-black/5 px-2 text-[10px] font-medium text-black/50"
              >
                Fora do plano
              </Badge>
            )}
            {feature.dormant && (
              <Badge
                variant="outline"
                className="h-5 rounded-full border-black/10 bg-black/5 px-2 text-[10px] font-medium text-black/50"
              >
                Em breve
              </Badge>
            )}
          </div>
          <p className="text-xs text-black/50">{feature.description}</p>
          {enabled && usersAffected > 0 && (
            <p className="mt-1 text-[11px] text-black/40">{usersAffected} usuário(s) com acesso</p>
          )}
        </div>
      </div>

      <Switch
        checked={enabled}
        onCheckedChange={onChange}
        disabled={disabled || lockedOn}
        aria-label={
          lockedOn ? `${feature.label} (em breve, indisponível)` : `Ativar ou desativar ${feature.label}`
        }
        title={lockedOn ? "Feature ainda não lançada" : undefined}
      />
    </div>
  );
}
