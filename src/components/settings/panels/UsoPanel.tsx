import { FolderKanban, Users, Loader2, ArrowUpRight, Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useUsoEmpresa } from "@/components/settings/useUsoEmpresa";
import { useExtratoTokens, agentKeyLabel } from "@/components/settings/useExtratoTokens";
import { useSettingsModal } from "@/contexts/SettingsModalContext";
import { formatNumberCompact, formatNumber, formatDateTime } from "@/lib/format";
import { DataTable } from "@/components/data/DataTable";
import { toDataSourceResult } from "@/types/dataSource";
import type { ColumnDef } from "@/components/data/DataTable";
import type { ExtratoTokenEvento } from "@/components/settings/useExtratoTokens";

// Barra de consumo de um recurso contra o teto da faixa do plano. Sem teto (plano
// não define limite ou não há assinatura), vira um contador simples.
function Medidor({
  icon: Icon,
  label,
  used,
  max,
  hint,
}: {
  icon: typeof FolderKanban;
  label: string;
  used: number;
  max: number | null;
  hint?: string;
}) {
  const hasLimit = typeof max === "number" && max > 0;
  const pct = hasLimit ? Math.min(100, Math.round((used / max!) * 100)) : 0;
  const near = hasLimit && used / max! >= 0.8;
  const full = hasLimit && used >= max!;

  return (
    <Card className="border border-black/5">
      <CardContent className="pt-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-sm font-medium text-black/70">
            <Icon size={16} className="text-black/40" /> {label}
          </span>
          <span className="text-sm tabular-nums text-black/70">
            <span className="text-lg font-semibold text-ink">{used}</span>
            {hasLimit ? (
              <span className="text-black/40"> / {max}</span>
            ) : (
              <span className="text-black/40"> · ilimitado</span>
            )}
          </span>
        </div>
        {hasLimit && (
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className={
                "h-full rounded-full transition-all " +
                (full ? "bg-chart-danger" : near ? "bg-chart-warning" : "bg-brand")
              }
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
        {hint && <p className="text-xs text-black/45">{hint}</p>}
        {near && !full && (
          <p className="text-xs font-medium text-warning-mid">Você está perto do limite da sua faixa.</p>
        )}
        {full && <p className="text-xs font-medium text-danger-mid">Faixa cheia. Suba de plano para abrir mais.</p>}
      </CardContent>
    </Card>
  );
}

const extratoColumns: ColumnDef<ExtratoTokenEvento>[] = [
  {
    key: "createdAt",
    header: "Quando",
    cell: (e) => <span className="text-black/70">{formatDateTime(e.createdAt)}</span>,
    getSortValue: (e) => e.createdAt,
  },
  {
    key: "userNome",
    header: "Quem",
    cell: (e) => <span className="text-black/70">{e.userNome ?? "—"}</span>,
  },
  {
    key: "agentKey",
    header: "Agente",
    cell: (e) => <span className="text-black/70">{agentKeyLabel(e.agentKey)}</span>,
  },
  {
    key: "tokensTotal",
    header: "Tokens",
    cell: (e) => <span className="tabular-nums text-ink">{formatNumber(e.tokensTotal)}</span>,
    getSortValue: (e) => e.tokensTotal,
  },
];

// Aba Uso: medidor do eixo de cobrança (faixa de projetos ativos, PRICING v2) + saldo
// e extrato de tokens de IA (motor de tokens, spec 076). Usuários são ilimitados no
// modelo, então aparecem só como contagem informativa.
export function UsoPanel() {
  const { uso, isLoading, error } = useUsoEmpresa();
  const { eventos, isLoading: extratoLoading, error: extratoError } = useExtratoTokens();
  const { openSettings } = useSettingsModal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-black/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-danger-soft border border-danger-mid-border rounded-xl text-sm text-danger-strong">
        Não foi possível carregar o uso. Tente recarregar.
      </div>
    );
  }

  const nearProjetos =
    typeof uso.maxProjetos === "number" && uso.maxProjetos > 0 && uso.projetosAtivos / uso.maxProjetos >= 0.8;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-semibold text-ink">Uso da empresa</h3>
        <p className="text-sm text-black/55">
          {uso.planoNome ? `Você está no plano ${uso.planoNome}.` : "Sem assinatura ativa no momento."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Medidor
          icon={FolderKanban}
          label="Projetos ativos"
          used={uso.projetosAtivos}
          max={uso.maxProjetos}
          hint="Conta os projetos não arquivados. É o que define a faixa da sua assinatura."
        />
        <Medidor
          icon={Users}
          label="Usuários"
          used={uso.usuarios}
          max={uso.maxUsuarios}
          hint="Usuários são ilimitados no Pilar; convide a firma inteira sem custo por cabeça."
        />
      </div>

      <div>
        <h3 className="text-base font-semibold text-ink">Tokens de IA</h3>
        <p className="text-sm text-black/55">
          Consumo dos agentes de IA (chat, leitura de cotação, importação financeira) neste ciclo.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border border-black/5">
          <CardContent className="pt-5 space-y-1">
            <span className="flex items-center gap-2 text-sm font-medium text-black/70">
              <Coins size={16} className="text-black/40" /> Tokens do plano
            </span>
            <p className="text-lg font-semibold text-ink">{formatNumberCompact(uso.tokensPlano)}</p>
            <p className="text-xs text-black/45">Renovados a cada ciclo mensal; o que sobra não acumula.</p>
          </CardContent>
        </Card>
        <Card className="border border-black/5">
          <CardContent className="pt-5 space-y-1">
            <span className="flex items-center gap-2 text-sm font-medium text-black/70">
              <Coins size={16} className="text-black/40" /> Tokens comprados
            </span>
            <p className="text-lg font-semibold text-ink">{formatNumberCompact(uso.tokensComprado)}</p>
            <p className="text-xs text-black/45">Pacote avulso, não expira no ciclo.</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h4 className="text-sm font-medium text-ink mb-2">Extrato recente</h4>
        <DataTable
          columns={extratoColumns}
          data={toDataSourceResult<ExtratoTokenEvento>({
            data: eventos,
            isLoading: extratoLoading,
            error: extratoError,
          })}
          rowKey={(e) => e.id}
          defaultSortKey="createdAt"
          defaultSortDir="desc"
          emptyMessage="Nenhum uso de IA registrado ainda."
          errorTitle="Não foi possível carregar o extrato"
        />
      </div>

      {(nearProjetos || !uso.planoNome) && (
        <Card className="border border-black/5 bg-black/[0.02]">
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-4">
            <div>
              <p className="text-sm font-medium text-ink">
                {uso.planoNome ? "Precisa de mais projetos ativos?" : "Escolha um plano"}
              </p>
              <p className="text-sm text-black/55">
                {uso.planoNome
                  ? "Suba de faixa e abra mais projetos sem trocar de ferramenta."
                  : "Assine para liberar o uso completo do Pilar."}
              </p>
            </div>
            <Button variant="brand" className="rounded-full flex-shrink-0" onClick={() => openSettings("pagamento")}>
              Ver assinatura <ArrowUpRight size={16} className="ml-1" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
