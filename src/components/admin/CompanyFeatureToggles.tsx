import { useMemo, useState } from "react";
import { Sparkles, Check, AlertCircle, ChevronRight, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  applyFeatureToggle,
  FEATURES,
  isFeatureEnabledForCompany,
  moduleOfFeature,
  subFeaturesOf,
  type CompanyFeatures,
  type FeatureDefinition,
  type FeatureKey,
  type SubscriptionPlanSlug,
} from "@/lib/features";
import { MODULES, MODULE_ORDER } from "@/lib/modules";
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
import type { LucideIcon } from "lucide-react";

const PLAN_LABEL: Record<SubscriptionPlanSlug, string> = {
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

type Section = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Features-raiz do grupo (core e sub-features não entram aqui). */
  features: FeatureDefinition[];
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

  // Seções: os 3 módulos (Gestão/Projetos/Obras) na ordem do switcher + uma
  // seção "Plataforma" para as features transversais (moduleOfFeature === null).
  // Core e sub-features não viram linha-raiz: core é sempre ligada; sub aparece
  // dentro do disclosure do pai. Ver spec 035 / ADR 0019.
  const sections = useMemo<Section[]>(() => {
    const rootFor = (predicate: (f: FeatureDefinition) => boolean) =>
      FEATURES.filter((f) => !f.core && !f.parent && predicate(f));
    const moduleSections: Section[] = MODULE_ORDER.map((id) => ({
      id,
      label: MODULES[id].label,
      icon: MODULES[id].icon,
      features: rootFor((f) => moduleOfFeature(f.key) === id),
    }));
    const plataforma: Section = {
      id: "plataforma",
      label: "Plataforma",
      icon: LayoutGrid,
      features: rootFor((f) => moduleOfFeature(f.key) === null),
    };
    return [...moduleSections, plataforma].filter((s) => s.features.length > 0);
  }, []);

  const totals = useMemo(() => {
    const active = FEATURES.filter((f) => isFeatureEnabledForCompany(value, f.key)).length;
    const addonsOn = FEATURES.filter((f) => f.addon && value[f.key]).length;
    return { active, total: FEATURES.length, addonsOn };
  }, [value]);

  // Semântica de herança centralizada em applyFeatureToggle (ADR 0019): ligar a
  // raiz limpa os `false` das subs; sub liga=herda / desliga=false explícito.
  const applyRootToggle = (feature: FeatureDefinition, nextEnabled: boolean) => {
    onChange(applyFeatureToggle(value, feature.key, nextEnabled));
  };

  const applySubToggle = (subKey: FeatureKey, nextEnabled: boolean) => {
    onChange(applyFeatureToggle(value, subKey, nextEnabled));
  };

  const isPaidAddon = (feature: FeatureDefinition) =>
    feature.addon && !feature.includedInPlans.includes(currentPlan);

  const handleRootToggle = (feature: FeatureDefinition, nextEnabled: boolean) => {
    const usersAffected = usersByFeature?.[feature.key] ?? 0;
    if (!nextEnabled && usersAffected > 0) {
      setPendingDisable(feature);
      return;
    }
    if (nextEnabled && isPaidAddon(feature)) {
      setPendingEnable(feature);
      return;
    }
    applyRootToggle(feature, nextEnabled);
  };

  const confirmDisable = () => {
    if (!pendingDisable) return;
    applyRootToggle(pendingDisable, false);
    setPendingDisable(null);
  };

  const confirmEnable = () => {
    if (!pendingEnable) return;
    applyRootToggle(pendingEnable, true);
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
        {sections.map((section) => {
          const SectionIcon = section.icon;
          return (
            <div key={section.id}>
              <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-black/40">
                <SectionIcon size={12} strokeWidth={2} />
                {section.label}
              </div>
              <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
                {section.features.map((feature, idx) => (
                  <ModuleFeatureRow
                    key={feature.key}
                    feature={feature}
                    value={value}
                    includedInPlan={feature.includedInPlans.includes(currentPlan)}
                    usersAffected={usersByFeature?.[feature.key] ?? 0}
                    onToggleRoot={(next) => handleRootToggle(feature, next)}
                    onToggleSub={applySubToggle}
                    isLast={idx === section.features.length - 1}
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

type ModuleFeatureRowProps = {
  feature: FeatureDefinition;
  value: CompanyFeatures;
  includedInPlan: boolean;
  usersAffected: number;
  onToggleRoot: (next: boolean) => void;
  onToggleSub: (subKey: FeatureKey, next: boolean) => void;
  isLast: boolean;
  disabled?: boolean;
};

function ModuleFeatureRow({
  feature,
  value,
  includedInPlan,
  usersAffected,
  onToggleRoot,
  onToggleSub,
  isLast,
  disabled = false,
}: ModuleFeatureRowProps) {
  const Icon = feature.icon;
  const enabled = Boolean(value[feature.key]);
  const subs = useMemo(() => subFeaturesOf(feature.key), [feature.key]);
  const hasSubs = subs.length > 0;
  // Abre já expandido quando há sub-feature desligada (customização visível).
  const [expanded, setExpanded] = useState(() =>
    subs.some((s) => value[s.key] === false)
  );
  // Feature ainda não lançada ("Em breve"): permite desligar, mas nunca ligar.
  const lockedOn = feature.dormant && !enabled;

  const subsOn = subs.filter((s) => isFeatureEnabledForCompany(value, s.key)).length;

  return (
    <div className={cn(!isLast && "border-b border-black/5")}>
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {hasSubs ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              disabled={!enabled}
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full transition-colors",
                enabled ? "bg-brand/10 hover:bg-brand/20" : "bg-black/5",
                !enabled && "cursor-default"
              )}
              aria-label={expanded ? `Recolher ${feature.label}` : `Expandir ${feature.label}`}
              aria-expanded={expanded}
            >
              <ChevronRight
                size={16}
                strokeWidth={2}
                className={cn(
                  "transition-transform",
                  enabled ? "text-ink" : "text-black/40",
                  expanded && "rotate-90"
                )}
              />
            </button>
          ) : (
            <div
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
                enabled ? "bg-brand/10" : "bg-black/5"
              )}
            >
              <Icon size={16} strokeWidth={1.5} className={enabled ? "text-ink" : "text-black/50"} />
            </div>
          )}
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
            {hasSubs && enabled && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-1 text-[11px] font-medium text-foreground hover:underline"
              >
                {subsOn} de {subs.length} funcionalidades ativas · {expanded ? "recolher" : "personalizar"}
              </button>
            )}
            {!hasSubs && enabled && usersAffected > 0 && (
              <p className="mt-1 text-[11px] text-black/40">{usersAffected} usuário(s) com acesso</p>
            )}
          </div>
        </div>

        <Switch
          checked={enabled}
          onCheckedChange={onToggleRoot}
          disabled={disabled || lockedOn}
          aria-label={
            lockedOn ? `${feature.label} (em breve, indisponível)` : `Ativar ou desativar ${feature.label}`
          }
          title={lockedOn ? "Feature ainda não lançada" : undefined}
        />
      </div>

      {hasSubs && enabled && expanded && (
        <div className="border-t border-black/5 bg-black/[0.015] pl-6">
          {subs.map((sub, idx) => {
            const SubIcon = sub.icon;
            const subEnabled = isFeatureEnabledForCompany(value, sub.key);
            return (
              <div
                key={sub.key}
                className={cn(
                  "flex items-center justify-between gap-3 py-3 pr-4",
                  idx !== subs.length - 1 && "border-b border-black/5"
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <SubIcon
                    size={15}
                    strokeWidth={1.5}
                    className={cn("flex-shrink-0", subEnabled ? "text-black/60" : "text-black/30")}
                  />
                  <div className="min-w-0">
                    <div className="text-sm text-black/75">{sub.label}</div>
                    <p className="truncate text-xs text-black/45">{sub.description}</p>
                  </div>
                </div>
                <Switch
                  checked={subEnabled}
                  onCheckedChange={(next) => onToggleSub(sub.key, next)}
                  disabled={disabled}
                  aria-label={`Ativar ou desativar ${sub.label}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
