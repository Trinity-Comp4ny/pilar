import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { FEATURES, isFeatureEnabledForCompany, type CompanyFeatures, type FeatureDefinition, type FeatureKey } from "@/lib/features";
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
  scope: "all";
};

export type BulkFeatureManagerProps = {
  empresas: BulkCompany[];
  /** Aplica em massa e retorna quantas empresas foram efetivamente alteradas. */
  onApply: (input: BulkFeatureInput) => Promise<number>;
  disabled?: boolean;
};

type Pending = BulkFeatureInput & { label: string; affected: number };

/**
 * Ação em massa (ligar/desligar) só sobre acesso antecipado (`universal: false`
 * em features.ts): IA Hub, Capacidade, Templates, Timesheet. Módulo maduro não
 * entra mais aqui, é universal, toda empresa já tem. Ver ADR 0026.
 */
export function BulkFeatureManager({ empresas, onApply, disabled = false }: BulkFeatureManagerProps) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [applying, setApplying] = useState(false);

  const total = empresas.length;
  const earlyAccessFeatures = useMemo(() => FEATURES.filter((f) => !f.universal), []);

  const countOn = (key: FeatureKey) => empresas.filter((e) => isFeatureEnabledForCompany(e.features, key)).length;

  const affectedBy = (feature: FeatureDefinition, value: boolean) =>
    empresas.filter((e) => isFeatureEnabledForCompany(e.features, feature.key) !== value).length;

  const openConfirm = (feature: FeatureDefinition, value: boolean) => {
    setPending({
      feature: feature.key,
      value,
      scope: "all",
      label: feature.label,
      affected: affectedBy(feature, value),
    });
  };

  const confirm = async () => {
    if (!pending) return;
    setApplying(true);
    try {
      await onApply({ feature: pending.feature, value: pending.value, scope: pending.scope });
      setPending(null);
    } finally {
      setApplying(false);
    }
  };

  if (earlyAccessFeatures.length === 0) return null;

  return (
    <div className="space-y-5">
      <p className="text-sm text-black/60">
        A ação sobrescreve o estado atual de cada empresa e não tem desfazer em massa (mas você pode reaplicar).
      </p>

      <div>
        <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-[0.08em] uppercase text-black/40">
          <Sparkles size={12} strokeWidth={2} />
          Acesso antecipado
        </div>
        <div className="overflow-hidden rounded-lg border border-black/10 bg-white">
          {earlyAccessFeatures.map((feature, idx) => (
            <BulkFeatureRow
              key={feature.key}
              feature={feature}
              onCount={countOn(feature.key)}
              total={total}
              disabled={disabled || applying}
              onEnableAll={() => openConfirm(feature, true)}
              onDisableAll={() => openConfirm(feature, false)}
              isLast={idx === earlyAccessFeatures.length - 1}
            />
          ))}
        </div>
      </div>

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
                  <strong>{pending.affected}</strong> {pending.affected === 1 ? "empresa" : "empresas"} (todas as
                  empresas). As demais já estão no estado desejado e não mudam. Não há desfazer em massa.
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
  onCount: number;
  total: number;
  disabled: boolean;
  onEnableAll: () => void;
  onDisableAll: () => void;
  isLast: boolean;
};

function BulkFeatureRow({ feature, onCount, total, disabled, onEnableAll, onDisableAll, isLast }: BulkFeatureRowProps) {
  const Icon = feature.icon;
  const allOn = total > 0 && onCount === total;
  const allOff = onCount === 0;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
        !isLast && "border-b border-black/5"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          size={16}
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
        <Button type="button" variant="outline" size="sm" onClick={onEnableAll} disabled={disabled || allOn}>
          Ligar p/ todas
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDisableAll} disabled={disabled || allOff}>
          Desligar p/ todas
        </Button>
      </div>
    </div>
  );
}
