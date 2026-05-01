import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  FEATURE_GROUP_LABEL,
  FEATURE_GROUP_ORDER,
  FEATURES,
  type CompanyFeatures,
  type FeatureAccess,
  type FeatureDefinition,
  type FeatureGroup,
  type FeatureKey,
  type PermissionLevel,
  type UserFeatures,
  isFeatureEnabledForCompany,
} from "@/lib/features";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lock } from "lucide-react";

const LEVELS: readonly { value: FeatureAccess; label: string; hint: string }[] = [
  { value: null, label: "Sem acesso", hint: "Usuário não vê o módulo" },
  { value: "viewer", label: "Viewer", hint: "Apenas leitura" },
  { value: "editor", label: "Editor", hint: "Criar, editar, excluir" },
];

type ShortcutId = "all-viewer" | "all-editor" | "clear" | "commercial" | "ops" | "finance";

type Shortcut = {
  id: ShortcutId;
  label: string;
  apply: (available: readonly FeatureKey[]) => UserFeatures;
};

const SHORTCUTS: readonly Shortcut[] = [
  {
    id: "all-viewer",
    label: "Tudo viewer",
    apply: (keys) => Object.fromEntries(keys.map((k) => [k, "viewer" as PermissionLevel])),
  },
  {
    id: "all-editor",
    label: "Tudo editor",
    apply: (keys) => Object.fromEntries(keys.map((k) => [k, "editor" as PermissionLevel])),
  },
  {
    id: "commercial",
    label: "Perfil Comercial",
    apply: (keys) => {
      const target: FeatureKey[] = ["leads", "propostas", "clientes"];
      return Object.fromEntries(keys.filter((k) => target.includes(k)).map((k) => [k, "editor" as PermissionLevel]));
    },
  },
  {
    id: "ops",
    label: "Perfil Operação",
    apply: (keys) => {
      const editor: FeatureKey[] = ["projetos", "mapa"];
      const viewer: FeatureKey[] = ["clientes", "pessoas"];
      const next: UserFeatures = {};
      for (const k of keys) {
        if (editor.includes(k)) next[k] = "editor";
        else if (viewer.includes(k)) next[k] = "viewer";
      }
      return next;
    },
  },
  {
    id: "finance",
    label: "Perfil Financeiro",
    apply: (keys) => {
      const editor: FeatureKey[] = ["financeiro"];
      const viewer: FeatureKey[] = ["relatorios", "projetos", "clientes"];
      const next: UserFeatures = {};
      for (const k of keys) {
        if (editor.includes(k)) next[k] = "editor";
        else if (viewer.includes(k)) next[k] = "viewer";
      }
      return next;
    },
  },
  {
    id: "clear",
    label: "Limpar tudo",
    apply: () => ({}),
  },
];

export type FeatureAccessGridProps = {
  value: UserFeatures;
  onChange: (next: UserFeatures) => void;
  companyFeatures: CompanyFeatures | null | undefined;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
};

export function FeatureAccessGrid({
  value,
  onChange,
  companyFeatures,
  disabled = false,
  disabledReason,
  className,
}: FeatureAccessGridProps) {
  const available = useMemo(
    () => FEATURES.filter((f) => !f.core && isFeatureEnabledForCompany(companyFeatures, f.key)),
    [companyFeatures]
  );

  const availableKeys = useMemo(() => available.map((f) => f.key), [available]);

  const grouped = useMemo(() => {
    const map = FEATURE_GROUP_ORDER.reduce(
      (acc, g) => {
        acc[g] = [];
        return acc;
      },
      {} as Record<FeatureGroup, FeatureDefinition[]>
    );
    for (const f of available) map[f.group].push(f);
    return map;
  }, [available]);

  const setAccess = (key: FeatureKey, level: FeatureAccess) => {
    const next: UserFeatures = { ...value };
    if (level === null) {
      delete next[key];
    } else {
      next[key] = level;
    }
    onChange(next);
  };

  const applyShortcut = (shortcut: Shortcut) => {
    onChange(shortcut.apply(availableKeys));
  };

  if (disabled) {
    return (
      <div className={cn("rounded-lg border border-dashed border-black/10 bg-black/[0.02] p-6 text-center", className)}>
        <Lock className="mx-auto mb-2 h-5 w-5 text-black/40" strokeWidth={1.5} />
        <p className="text-sm text-black/60">
          {disabledReason ?? "Admin da empresa tem acesso total — configuração individual desativada."}
        </p>
      </div>
    );
  }

  if (available.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-black/10 bg-black/[0.02] p-6 text-center", className)}>
        <p className="text-sm text-black/60">
          Nenhuma feature disponível. Ative features em <span className="font-medium">Admin › Features da Empresa</span>{" "}
          antes de convidar usuários.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-5", className)}>
      <div className="flex flex-wrap gap-2">
        {SHORTCUTS.map((s) => (
          <Button
            key={s.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyShortcut(s)}
            className="h-8 rounded-full text-xs"
          >
            {s.label}
          </Button>
        ))}
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
                  <FeatureRow
                    key={feature.key}
                    feature={feature}
                    access={value[feature.key] ?? null}
                    onChange={(lvl) => setAccess(feature.key, lvl)}
                    isLast={idx === features.length - 1}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type FeatureRowProps = {
  feature: FeatureDefinition;
  access: FeatureAccess;
  onChange: (level: FeatureAccess) => void;
  isLast: boolean;
};

function FeatureRow({ feature, access, onChange, isLast }: FeatureRowProps) {
  const Icon = feature.icon;
  return (
    <div
      className={cn(
        "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
        !isLast && "border-b border-black/5"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-black/5">
          <Icon size={16} strokeWidth={1.5} className="text-black/70" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-black/80">{feature.label}</span>
            {feature.addon && (
              <Badge
                variant="outline"
                className="h-5 rounded-full border-brand/30 bg-brand/10 px-2 text-[10px] font-medium text-brand"
              >
                Add-on
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
          <p className="truncate text-xs text-black/50">{feature.description}</p>
        </div>
      </div>

      <SegmentedAccess value={access} onChange={onChange} />
    </div>
  );
}

type SegmentedAccessProps = {
  value: FeatureAccess;
  onChange: (level: FeatureAccess) => void;
};

function SegmentedAccess({ value, onChange }: SegmentedAccessProps) {
  return (
    <div role="radiogroup" className="inline-flex rounded-full border border-black/10 bg-black/[0.02] p-0.5">
      {LEVELS.map((level) => {
        const active = value === level.value;
        return (
          <button
            key={String(level.value)}
            type="button"
            role="radio"
            aria-checked={active}
            title={level.hint}
            onClick={() => onChange(level.value)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              active ? "bg-white text-black shadow-sm" : "text-black/50 hover:text-black/80"
            )}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
