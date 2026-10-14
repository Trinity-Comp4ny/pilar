import { useMemo, useState } from "react";
import { ChevronDown, FlaskConical } from "lucide-react";
import { PilarPage } from "@/components/PilarPage";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  FEATURES,
  FEATURE_GROUP_LABEL,
  applyFeatureToggle,
  isFeatureEnabledForCompany,
  type FeatureDefinition,
} from "@/lib/features";
import { edgeFetch, type EmpresaRow } from "./api";
import { atualizarEmpresa, useAcaoEmpresa, useEmpresas } from "./hooks";

/**
 * Catálogo de funcionalidades (SPEC 117). Duas classes, por ADR 0026:
 * - liberada pra todas (`universal`): toda empresa tem, sem chave;
 * - em teste fechado (feature flag em `empresas.features`): você escolhe quem
 *   tem, empresa por empresa ou todas de uma vez.
 * Módulo dormente (código existe, fora do produto) não aparece.
 */
export default function Funcionalidades() {
  usePageTitle("Funcionalidades · Ultra admin");
  const empresasQ = useEmpresas();
  const empresas = useMemo(() => (empresasQ.data ?? []).filter((e) => e.status !== "cancelled"), [empresasQ.data]);

  const flags = useMemo(() => FEATURES.filter((f) => !f.universal && !f.core && !f.dormant), []);
  const liberadas = useMemo(() => FEATURES.filter((f) => (f.universal || f.core) && !f.parent && !f.dormant), []);

  return (
    <PilarPage title="Funcionalidades">
      <p className="-mt-2 max-w-3xl text-sm text-ink-soft">
        Recurso novo nasce em teste fechado: você liga pra empresas escolhidas e, quando estiver pronto, libera pra
        todas no código.
      </p>

      <section className="space-y-3" aria-labelledby="flags-titulo">
        <h2 id="flags-titulo" className="text-sm font-semibold text-ink">
          Em teste fechado
        </h2>
        {empresasQ.isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : flags.length === 0 ? (
          <Card className="border border-black/5">
            <EmptyState
              icon={FlaskConical}
              title="Nenhum recurso em teste fechado agora"
              description="Quando um recurso novo for marcado como não universal em features.ts, ele aparece aqui pra você escolher quais empresas têm acesso."
            />
          </Card>
        ) : (
          flags.map((f) => <FlagCard key={f.key} feature={f} empresas={empresas} />)
        )}
      </section>

      <section className="space-y-3" aria-labelledby="liberadas-titulo">
        <h2 id="liberadas-titulo" className="text-sm font-semibold text-ink">
          Liberadas pra todas <span className="font-normal text-ink-muted">({liberadas.length})</span>
        </h2>
        <Card className="border border-black/5">
          <CardContent className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {liberadas.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.key} className="flex min-w-0 gap-3">
                  <Icon size={16} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-soft" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{f.label}</p>
                    <p className="text-xs text-ink-muted">
                      {FEATURE_GROUP_LABEL[f.group]} · {f.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </PilarPage>
  );
}

function FlagCard({ feature, empresas }: { feature: FeatureDefinition; empresas: EmpresaRow[] }) {
  const [emMassa, setEmMassa] = useState<boolean | null>(null);
  const Icon = feature.icon;
  const ligadas = empresas.filter((e) => isFeatureEnabledForCompany(e.features, feature.key));
  const afetadas =
    emMassa === null ? 0 : empresas.length - (emMassa ? ligadas.length : empresas.length - ligadas.length);

  const porEmpresa = useAcaoEmpresa({
    run: (i: { empresa: EmpresaRow; valor: boolean }) =>
      atualizarEmpresa(i.empresa.id, { features: applyFeatureToggle(i.empresa.features, feature.key, i.valor) }),
    sucesso: (i) => `${feature.label} ${i.valor ? "ligado" : "desligado"} em ${i.empresa.nome}`,
    erro: "Não foi possível salvar",
    contexto: "ultra-admin-empresas:features",
  });
  const massa = useAcaoEmpresa({
    run: (valor: boolean) =>
      edgeFetch("ultra-admin-empresas", {
        method: "PUT",
        params: { action: "bulk-feature" },
        body: { feature: feature.key, value: valor, scope: "all" },
      }),
    sucesso: (valor) => `${feature.label} ${valor ? "ligado" : "desligado"} pra todas`,
    erro: "Não foi possível aplicar em todas",
    contexto: "ultra-admin-empresas:bulk-feature",
  });

  return (
    <Card className="border border-black/5">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="flex min-w-0 gap-3">
          <Icon size={18} strokeWidth={1.5} className="mt-0.5 shrink-0 text-ink-soft" />
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              {feature.label}
              <Badge variant="info">Teste fechado</Badge>
            </CardTitle>
            <p className="text-sm text-ink-muted">{feature.description}</p>
            <p className="mt-1 text-sm text-ink">
              {ligadas.length} de {empresas.length} {empresas.length === 1 ? "empresa" : "empresas"} com acesso
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={ligadas.length === empresas.length}
            onClick={() => setEmMassa(true)}
          >
            Ligar pra todas
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={ligadas.length === 0}
            onClick={() => setEmMassa(false)}
          >
            Desligar pra todas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Collapsible>
          <CollapsibleTrigger className="group flex items-center gap-1 text-xs font-medium text-ink-soft hover:text-ink">
            Escolher empresa por empresa
            <ChevronDown size={14} className="transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ul className="mt-3 divide-y divide-black/5 rounded-lg border border-black/5">
              {empresas.map((e) => {
                const ligada = isFeatureEnabledForCompany(e.features, feature.key);
                return (
                  <li key={e.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="truncate text-sm text-ink">{e.nome}</span>
                    <Switch
                      checked={ligada}
                      disabled={porEmpresa.isPending}
                      onCheckedChange={(valor) => porEmpresa.mutate({ empresa: e, valor })}
                      aria-label={`${feature.label} em ${e.nome}`}
                    />
                  </li>
                );
              })}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      <ConfirmDialog
        open={emMassa !== null}
        onOpenChange={(o) => !o && setEmMassa(null)}
        title={`${emMassa ? "Ligar" : "Desligar"} ${feature.label} pra todas?`}
        description={`Muda ${afetadas} ${afetadas === 1 ? "empresa" : "empresas"}; as outras já estão assim. Não tem desfazer em massa, mas dá pra ajustar empresa por empresa depois.`}
        confirmText={emMassa ? "Ligar pra todas" : "Desligar pra todas"}
        variant={emMassa ? "default" : "destructive"}
        loading={massa.isPending}
        onConfirm={() => emMassa !== null && massa.mutate(emMassa, { onSuccess: () => setEmMassa(null) })}
      />
    </Card>
  );
}
