import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { desvioOrcamento } from "@/lib/obras";
import { cn } from "@/lib/utils";
import { achatarOrcado, type LinhaOrcado, type OrcadoRealizado } from "@/lib/orcadoRealizado";
import { NIVEL_COR, NIVEL_NOME } from "./cronograma/estado";

const COLUNAS =
  "grid grid-cols-[minmax(0,1fr)_96px_96px_88px] items-center gap-2 md:grid-cols-[minmax(0,1fr)_120px_120px_120px]";

/** Previsto editável: só grava ao sair do campo e quando o valor mudou. */
function PrevistoCampo({
  linha,
  canEdit,
  onSave,
}: {
  linha: LinhaOrcado;
  canEdit: boolean;
  onSave: (v: number) => void;
}) {
  const formatCurrency = useMoneyMask();
  const [rascunho, setRascunho] = useState(linha.previstoProprio ? String(linha.previstoProprio) : "");
  const somaFilhos = linha.filhos.reduce((a, f) => a + f.previsto, 0);

  if (!canEdit) {
    return (
      <span className="text-right text-xs text-muted-foreground">
        {linha.previsto ? formatCurrency(linha.previsto) : "—"}
      </span>
    );
  }
  return (
    <Input
      type="number"
      step="0.01"
      min="0"
      value={rascunho}
      onChange={(e) => setRascunho(e.target.value)}
      onBlur={() => {
        const v = Number(rascunho) || 0;
        if (v !== linha.previstoProprio) onSave(v);
      }}
      placeholder={somaFilhos > 0 ? String(somaFilhos) : "Previsto"}
      aria-label={`Previsto de ${linha.no.nome}`}
      className="h-8 px-2 text-right text-xs"
    />
  );
}

function Linha({
  linha,
  aberto,
  onToggle,
  canEdit,
  onSave,
}: {
  linha: LinhaOrcado;
  aberto: boolean;
  onToggle: () => void;
  canEdit: boolean;
  onSave: (id: string, v: number) => void;
}) {
  const formatCurrency = useMoneyMask();
  const desvio = desvioOrcamento(linha.previsto, linha.realizado);
  const estourou = linha.previsto > 0 && desvio.valor > 0;
  const consumo = linha.previsto > 0 ? Math.min(100, Math.round((linha.realizado / linha.previsto) * 100)) : 0;
  const temFilhos = linha.filhos.length > 0;

  return (
    <div
      className={cn(COLUNAS, "min-h-11 border-b border-l-4 px-3 py-1.5", linha.nivel === "fase" && "bg-muted/40")}
      style={{ borderLeftColor: NIVEL_COR[linha.nivel] }}
      data-testid={`orcado-${linha.no.id}`}
    >
      <div className="flex min-w-0 items-center gap-1" style={{ paddingLeft: linha.profundidade * 14 }}>
        <button
          type="button"
          onClick={onToggle}
          disabled={!temFilhos}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted disabled:opacity-25"
          aria-label={aberto ? `Recolher ${linha.no.nome}` : `Expandir ${linha.no.nome}`}
        >
          {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <div className="min-w-0">
          <p
            className={cn("truncate text-sm text-ink", linha.nivel === "fase" ? "font-semibold" : "font-medium")}
            title={`${NIVEL_NOME[linha.nivel]}: ${linha.caminho}`}
          >
            {linha.no.nome}
          </p>
          {linha.previsto > 0 && (
            <Progress
              value={consumo}
              className={cn("mt-1 h-1 w-24", estourou && "[&>div]:bg-negative")}
              aria-label={`${consumo}% do previsto`}
            />
          )}
        </div>
      </div>
      <PrevistoCampo
        key={linha.previstoProprio}
        linha={linha}
        canEdit={canEdit}
        onSave={(v) => onSave(linha.no.id, v)}
      />
      <span className="text-right text-xs tabular-nums text-ink">{formatCurrency(linha.realizado)}</span>
      <span
        className={cn("text-right text-xs tabular-nums", estourou ? "text-danger-strong" : "text-muted-foreground")}
      >
        {linha.previsto > 0 && linha.realizado > 0
          ? `${desvio.valor >= 0 ? "+" : ""}${formatCurrency(desvio.valor)}`
          : "—"}
        {linha.realizado > 0 && desvio.pct != null && (
          <span className="block text-[10px]">{`${desvio.pct >= 0 ? "+" : ""}${desvio.pct}%`}</span>
        )}
      </span>
    </div>
  );
}

/**
 * Orçado x realizado da obra em árvore (fase, etapa, serviço): o previsto se digita em qualquer nível e
 * cada nível soma o que está abaixo. Mesma leitura do cronograma, com o dinheiro ao lado.
 */
export function ObraOrcadoRealizadoCard({
  dados,
  canEdit,
  onSave,
}: {
  dados: OrcadoRealizado;
  canEdit: boolean;
  onSave: (obraFrenteId: string, valor: number) => void;
}) {
  const formatCurrency = useMoneyMask();
  const [recolhidos, setRecolhidos] = useState<Set<string>>(new Set());
  const linhas = useMemo(() => achatarOrcado(dados.raizes, recolhidos), [dados.raizes, recolhidos]);
  const desvioTotal = desvioOrcamento(dados.totalPrevisto, dados.totalRealizado);

  const alternar = (id: string) =>
    setRecolhidos((atual) => {
      const novo = new Set(atual);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });

  return (
    <Card className="overflow-hidden rounded-2xl border border-black/5 bg-white">
      <CardContent className="p-0">
        <div className="px-4 pt-4">
          <h3 className="text-sm font-medium text-ink">Orçado x realizado</h3>
          <p className="text-xs text-muted-foreground">
            Digite o previsto em qualquer nível. Fase e etapa somam o que está abaixo quando não têm valor próprio.
          </p>
        </div>
        <div
          className={cn(
            COLUNAS,
            "mt-3 border-b bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
          )}
        >
          <span className="pl-7">Fase / etapa / serviço</span>
          <span className="text-right">Previsto</span>
          <span className="text-right">Realizado</span>
          <span className="text-right">Desvio</span>
        </div>
        {linhas.map((l) => (
          <Linha
            key={l.no.id}
            linha={l}
            aberto={!recolhidos.has(l.no.id)}
            onToggle={() => alternar(l.no.id)}
            canEdit={canEdit}
            onSave={onSave}
          />
        ))}
        {dados.semEtapa > 0 && (
          <div className={cn(COLUNAS, "min-h-11 border-b px-3 py-1.5 text-xs")}>
            <span className="pl-7 text-muted-foreground">Sem fase, etapa ou serviço</span>
            <span className="text-right text-muted-foreground">—</span>
            <span className="text-right tabular-nums text-ink">{formatCurrency(dados.semEtapa)}</span>
            <span />
          </div>
        )}
        <div className={cn(COLUNAS, "bg-muted/20 px-3 py-2.5 text-sm font-semibold")}>
          <span className="pl-7 text-ink">Total da obra</span>
          <span className="text-right text-xs tabular-nums">{formatCurrency(dados.totalPrevisto)}</span>
          <span className="text-right text-xs tabular-nums">{formatCurrency(dados.totalRealizado)}</span>
          <span
            className={cn(
              "text-right text-xs tabular-nums",
              dados.totalPrevisto > 0 && desvioTotal.valor > 0 ? "text-danger-strong" : "text-muted-foreground"
            )}
          >
            {dados.totalPrevisto > 0 ? `${desvioTotal.valor >= 0 ? "+" : ""}${formatCurrency(desvioTotal.valor)}` : "—"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
