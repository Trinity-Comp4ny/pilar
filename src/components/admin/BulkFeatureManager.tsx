import { useMemo, useState } from "react";
import { LayoutGrid, Loader2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FEATURES,
  isFeatureEnabledForCompany,
  moduleOfFeature,
  subFeaturesOf,
  type CompanyFeatures,
  type FeatureDefinition,
  type FeatureKey,
} from "@/lib/features";
import { MODULES, MODULE_ORDER } from "@/lib/modules";
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

/** Empresa reduzida ao que o painel precisa: id + features já parseadas. */
export type BulkCompany = { id: string; features: CompanyFeatures };

export type BulkFeatureInput = {
  feature: FeatureKey;
  value: boolean;
  scope: "all" | "has_parent";
  parent?: FeatureKey;
};

export type BulkFeatureManagerProps = {
  empresas: BulkCompany[];
  /** Aplica em massa e retorna quantas empresas foram efetivamente alteradas. */
  onApply: (input: BulkFeatureInput) => Promise<number>;
  disabled?: boolean;
};

type Section = { id: string; label: string; icon: LucideIcon; features: FeatureDefinition[] };

type Pending = BulkFeatureInput & { label: string; affected: number; scopeLabel: string };

export function BulkFeatureManager({ empresas, onApply, disabled = false }: BulkFeatureManagerProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [applying, setApplying] = useState(false);

  const total = empresas.length;

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

  // Quantas empresas têm a feature ligada hoje (semântica com herança pai→filho).
  const countOn = (key: FeatureKey) =>
    empresas.filter((e) => isFeatureEnabledForCompany(e.features, key)).length;

  // Empresas que mudariam se aplicássemos (feature, value). Sub-feature só conta
  // as que têm o módulo-pai ligado (scope has_parent forçado).
  const affectedBy = (feature: FeatureDefinition, value: boolean) => {
    const parent = feature.parent;
    return empresas.filter((e) => {
      if (parent && e.features[parent] !== true) return false;
      const current = isFeatureEnabledForCompany(e.features, feature.key);
      return current !== value;
    }).length;
  };

  const openConfirm = (feature: FeatureDefinition, value: boolean) => {
    const parent = feature.parent;
    const scope: BulkFeatureInput["scope"] = parent ? "has_parent" : "all";
    const scopeLabel = parent
      ? "empresas com o módulo Obras ligado"
      : "todas as empresas";
    setPending({
      feature: feature.key,
      value,
      scope,
      parent,
      label: feature.label,
      affected: affectedBy(feature, value),
      scopeLabel,
    });
  };

  const confirm = async () => {
    if (!pending) return;
    setApplying(true);
    try {
      await onApply({ feature: pending.feature, value: pending.value, scope: pending.scope, parent: pending.parent });
      setPending(null);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-black/60">
        A ação sobrescreve o estado atual de cada empresa e não tem desfazer em massa (mas você pode
        reaplicar). Sub-funcionalidades de Obras só afetam empresas com o módulo ligado.
      </p>

      {sections.map((section) => {
        const SectionIcon = section.icon;
        return (
          <div key={section.id}>
            <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-black/40">
              <SectionIcon size={12} strokeWidth={2} />
              {section.label}
            </div>
            <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
              {section.features.map((feature, idx) => {
                const subs = subFeaturesOf(feature.key);
                const rows: Array<{ f: FeatureDefinition; isSub: boolean }> = [
                  { f: feature, isSub: false },
                  ...subs.map((s) => ({ f: s, isSub: true })),
                ];
                return rows.map(({ f, isSub }, rowIdx) => {
                  const on = countOn(f.key);
                  const isLastOfSection = idx === section.features.length - 1 && rowIdx === rows.length - 1;
                  return (
                    <BulkFeatureRow
                      key={f.key}
                      feature={f}
                      isSub={isSub}
                      onCount={on}
                      total={total}
                      disabled={disabled || applying}
                      onEnableAll={() => openConfirm(f, true)}
                      onDisableAll={() => openConfirm(f, false)}
                      isLast={isLastOfSection}
                    />
                  );
                });
              })}
            </div>
          </div>
        );
      })}

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && !applying && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.value ? "Ligar" : "Desligar"} {pending?.label} em massa?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  Isso vai <strong>{pending.value ? "ligar" : "desligar"}</strong> {pending.label} em{" "}
                  <strong>{pending.affected}</strong>{" "}
                  {pending.affected === 1 ? "empresa" : "empresas"} ({pending.scopeLabel}). As demais já
                  estão no estado desejado e não mudam. Não há desfazer em massa.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applying}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirm();
              }}
              disabled={applying || pending?.affected === 0}
            >
              {applying ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Aplicando…
                </>
              ) : (
                `${pending?.value ? "Ligar" : "Desligar"} em ${pending?.affected ?? 0}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type BulkFeatureRowProps = {
  feature: FeatureDefinition;
  isSub: boolean;
  onCount: number;
  total: number;
  disabled: boolean;
  onEnableAll: () => void;
  onDisableAll: () => void;
  isLast: boolean;
};

function BulkFeatureRow({
  feature,
  isSub,
  onCount,
  total,
  disabled,
  onEnableAll,
  onDisableAll,
  isLast,
}: BulkFeatureRowProps) {
  const Icon = feature.icon;
  const allOn = total > 0 && onCount === total;
  const allOff = onCount === 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
        isSub && "bg-black/[0.015] pl-10",
        !isLast && "border-b border-black/5"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          size={isSub ? 15 : 16}
          strokeWidth={1.5}
          className={cn("mt-0.5 flex-shrink-0", onCount > 0 ? "text-ink" : "text-black/40")}
        />
        <div className="min-w-0">
          <div className="text-sm font-medium text-black/80">{feature.label}</div>
          <p className="text-xs text-black/50">
            {onCount} de {total} {total === 1 ? "empresa" : "empresas"} com acesso
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onEnableAll}
          disabled={disabled || allOn}
        >
          Ligar p/ todas
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onDisableAll}
          disabled={disabled || allOff}
        >
          Desligar p/ todas
        </Button>
      </div>
    </div>
  );
}
