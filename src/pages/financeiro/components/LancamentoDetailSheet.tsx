import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowLeftRight, ArrowUpCircle, Check, Pencil, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { formatDateDisplay } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { Lancamento } from "../hooks/useLancamentosUnified";
import { useGruposParcelaResumo } from "../hooks/useGruposParcelaResumo";
import { useParcelasDosGrupos } from "../hooks/useParcelasDosGrupos";
import { GrupoParcelaActions } from "./GrupoParcelaActions";
import { isOverdue, isPaidStatus } from "./lancamentosRows";

interface Props {
  lancamento: Lancamento | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDelete: (l: Lancamento) => void;
  onEditInTab: (l: Lancamento) => void;
  /** Abre o diálogo de pagamento/recebimento (data + conta) da lista. */
  onRegistrarPagamento?: (l: Lancamento) => void;
  /** Troca o painel para outra parcela do mesmo grupo. */
  onSelect?: (l: Lancamento) => void;
  onGroupChanged?: () => void;
}

/** Status que o usuário vê: em aberto e vencido aparece como Atrasado, mesmo antes do job diário. */
function statusVisivel(l: Lancamento): string {
  if (isPaidStatus(l)) return l.tipo === "receita" ? "Recebido" : "Pago";
  if (l.status === "Cancelado") return "Cancelado";
  return isOverdue(l) ? "Atrasado" : "Pendente";
}

function useRateio(l: Lancamento | null) {
  return useQuery({
    queryKey: ["lancamento-rateio-detalhe", l?.tipo, l?.id, l?.centro_custo_id],
    enabled: !!l && l.tipo !== "transferencia",
    staleTime: 60 * 1000,
    queryFn: async (): Promise<{ nome: string; percentual: number | null }[]> => {
      if (!l) return [];
      const { data: rateios } = await supabase
        .from("lancamento_rateios")
        .select("percentual, centros_custo(nome)")
        .eq("lancamento_id", l.id)
        .eq("tipo_lancamento", l.tipo);
      const lista = (rateios ?? []) as Array<{ percentual: number; centros_custo: { nome: string } | null }>;
      if (lista.length > 0) return lista.map((r) => ({ nome: r.centros_custo?.nome ?? "—", percentual: r.percentual }));
      if (!l.centro_custo_id) return [];
      const { data: cc } = await supabase
        .from("centros_custo")
        .select("nome")
        .eq("id", l.centro_custo_id)
        .maybeSingle();
      return cc ? [{ nome: (cc as { nome: string }).nome, percentual: null }] : [];
    },
  });
}

/**
 * Detalhe do lançamento em painel lateral (SPEC 150, fase 3). Abre sem tirar o usuário
 * da lista, como Omie e Conta Azul: valor e status no topo, a ação principal
 * (registrar pagamento) à mão, todos os dados do título, o plano de parcelas inteiro
 * com progresso e o registro de quando foi criado/alterado. No celular vira tela cheia
 * de baixo para cima.
 */
export function LancamentoDetailSheet({
  lancamento: l,
  open,
  onOpenChange,
  onDelete,
  onEditInTab,
  onRegistrarPagamento,
  onSelect,
  onGroupChanged,
}: Props) {
  const { canEdit } = useFeatureAccess("financeiro");
  const isMobile = useIsMobile();
  const formatCurrency = useMoneyMask();
  const grupoIds = l?.grupo_parcela ? [l.grupo_parcela] : [];
  const resumoGrupos = useGruposParcelaResumo(grupoIds);
  const parcelasDosGrupos = useParcelasDosGrupos(grupoIds);
  const rateio = useRateio(open ? l : null);

  if (!l) return null;

  const isReceita = l.tipo === "receita";
  const isTransf = l.tipo === "transferencia";
  const paga = isPaidStatus(l);
  const status = statusVisivel(l);
  const resumoGrupo = l.grupo_parcela ? resumoGrupos.get(l.grupo_parcela) : undefined;
  const parcelas = l.grupo_parcela ? (parcelasDosGrupos.get(l.grupo_parcela) ?? []) : [];
  const progresso =
    resumoGrupo && resumoGrupo.totalOriginal > 0
      ? Math.min(100, Math.round((resumoGrupo.totalPago / resumoGrupo.totalOriginal) * 100))
      : 0;

  const Icone = isTransf ? ArrowLeftRight : isReceita ? ArrowUpCircle : ArrowDownCircle;
  const rotuloTipo = isTransf ? "Transferência" : isReceita ? "Receita" : "Despesa";
  const rotuloEfetivacao = isReceita ? "Recebido em" : "Pago em";
  const rotuloAcao = isReceita ? "Registrar recebimento" : "Registrar pagamento";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0",
          isMobile ? "h-[92dvh] rounded-t-2xl" : "w-full sm:max-w-md"
        )}
      >
        <SheetHeader className="space-y-3 border-b px-6 pb-5 pt-6 text-left">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <Icone className="h-4 w-4" aria-hidden="true" />
            {rotuloTipo}
            {l.parcela_numero && l.parcela_total && l.parcela_total > 1 && (
              <span className="normal-case tracking-normal">
                · parcela {l.parcela_numero}/{l.parcela_total}
              </span>
            )}
          </div>
          <SheetTitle className="text-lg leading-snug">{l.descricao}</SheetTitle>
          <SheetDescription className="sr-only">Detalhes do lançamento</SheetDescription>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p
              className={cn(
                "text-2xl font-semibold tabular-nums tracking-tight",
                isReceita ? "text-positive-strong" : "text-ink"
              )}
            >
              {isTransf ? "" : isReceita ? "+ " : "− "}
              {formatCurrency(l.valor)}
            </p>
            {!isTransf && <StatusBadge domain="financeiro" status={status} />}
          </div>
          {canEdit && !isTransf && (
            <div className="flex items-center gap-2 pt-1">
              {!paga && onRegistrarPagamento && (
                <Button variant="brand" className="flex-1 gap-2" onClick={() => onRegistrarPagamento(l)}>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {rotuloAcao}
                </Button>
              )}
              <Button variant="outline" className={cn("gap-2", paga && "flex-1")} onClick={() => onEditInTab(l)}>
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Editar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Excluir"
                className="text-danger-mid hover:bg-danger-soft hover:text-danger-mid"
                onClick={() => onDelete(l)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          <Secao titulo="Datas">
            <Campo label="Vencimento">{formatDateDisplay(l.data_vencimento)}</Campo>
            <Campo label={rotuloEfetivacao}>{l.data_efetivacao ? formatDateDisplay(l.data_efetivacao) : "—"}</Campo>
            <Campo label="Competência">{l.data_competencia ? formatDateDisplay(l.data_competencia) : "—"}</Campo>
          </Secao>

          <Secao titulo={isTransf ? "Contas" : "Onde e como"}>
            <Campo label={isTransf ? "Origem" : "Conta"}>
              {l.conta_nome || (l.cartao_id ? "Cartão de crédito" : "—")}
            </Campo>
            {isTransf ? (
              <Campo label="Destino">{l.contraparte_nome || "—"}</Campo>
            ) : (
              <Campo label="Forma de pagamento">{l.forma_pagamento || "—"}</Campo>
            )}
            {!isTransf && <Campo label="Nota fiscal">{l.nota_fiscal || "—"}</Campo>}
          </Secao>

          {!isTransf && (
            <Secao titulo="Classificação">
              <Campo label={isReceita ? "Cliente" : "Fornecedor"}>{l.contraparte_nome || "—"}</Campo>
              <Campo label="Projeto">{l.projeto_nome || "—"}</Campo>
              <Campo label="Categoria">{l.categoria_nome || "—"}</Campo>
              <Campo label="Centro de custo">
                {rateio.data && rateio.data.length > 0
                  ? rateio.data.map((r) => (r.percentual != null ? `${r.nome} (${r.percentual}%)` : r.nome)).join(", ")
                  : "—"}
              </Campo>
            </Secao>
          )}

          {l.observacao && (
            <section className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Observação</h3>
              <p className="whitespace-pre-line text-sm">{l.observacao}</p>
            </section>
          )}

          {l.grupo_parcela && (
            <section className="space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Parcelamento</h3>
              {resumoGrupo && (
                <div className="space-y-2 rounded-xl border p-4">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>
                      <span className="font-semibold">{resumoGrupo.pagas}</span> de {resumoGrupo.totalParcelas}{" "}
                      {isReceita ? "recebidas" : "pagas"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(resumoGrupo.totalPago)} de {formatCurrency(resumoGrupo.totalOriginal)}
                    </span>
                  </div>
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progresso}
                    aria-label="Progresso do parcelamento"
                  >
                    <div className="h-full rounded-full bg-positive" style={{ width: `${progresso}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Saldo em aberto{" "}
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(resumoGrupo.saldo)}
                    </span>
                    {resumoGrupo.proximaVenc && <> · próxima em {formatDateDisplay(resumoGrupo.proximaVenc)}</>}
                  </p>
                </div>
              )}
              {parcelas.length > 0 && (
                <ol className="divide-y rounded-xl border">
                  {parcelas.map((p) => {
                    const atual = p.id === l.id;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          disabled={atual || !onSelect}
                          onClick={() => onSelect?.(p)}
                          aria-current={atual ? "true" : undefined}
                          className={cn(
                            "flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm",
                            atual ? "bg-muted/60" : "hover:bg-muted/40"
                          )}
                        >
                          <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                            {p.parcela_numero}/{p.parcela_total}
                          </span>
                          <span className="flex-1 tabular-nums">{formatDateDisplay(p.data_vencimento)}</span>
                          <span className="tabular-nums">{formatCurrency(p.valor)}</span>
                          <StatusBadge domain="financeiro" status={statusVisivel(p)} className="shrink-0" />
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
              {canEdit && (
                <GrupoParcelaActions
                  lancamento={l}
                  onChanged={() => {
                    onGroupChanged?.();
                    onOpenChange(false);
                  }}
                />
              )}
            </section>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</dl>
    </section>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-sm">{children}</dd>
    </div>
  );
}
