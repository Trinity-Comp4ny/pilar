import { useRef, useState } from "react";
import { format, isToday, isTomorrow, isYesterday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/motion/PageLoader";
import { useMoneyMask } from "@/hooks/useMoneyMask";
import { getDisplayDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import type { Lancamento } from "../hooks/useLancamentosUnified";

/** Largura da ação revelada ao deslizar a linha. */
const ACAO_LARGURA = 112;
/** Abaixo disto o gesto é um toque. */
const LIMIAR_DE_TOQUE = 6;

interface Props {
  items: Lancamento[];
  loading: boolean;
  /** Vazio por filtro ("Nenhum lançamento com esses filtros") ou de verdade. */
  temFiltro: boolean;
  canEdit: boolean;
  isPaid: (l: Lancamento) => boolean;
  isOverdue: (l: Lancamento) => boolean;
  /** Toque na linha: abre o detalhe. */
  onOpen: (l: Lancamento) => void;
  /** Ação revelada: marcar como pago ou recebido. */
  onMarkPaid: (l: Lancamento) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

/** "Hoje, 19 out", "Ontem, 18 out", "Amanhã, 20 out" ou "sábado, 18 out". */
function rotuloDoDia(iso: string | null | undefined): string {
  if (!iso) return "Sem data";
  const d = parseISO(iso);
  const dia = format(d, "d MMM", { locale: ptBR }).replace(".", "");
  if (isToday(d)) return `Hoje, ${dia}`;
  if (isYesterday(d)) return `Ontem, ${dia}`;
  if (isTomorrow(d)) return `Amanhã, ${dia}`;
  return `${format(d, "EEEE", { locale: ptBR })}, ${dia}`;
}

/** Grupos de linhas seguidas com o mesmo dia: respeita a ordenação que veio do banco. */
function agruparPorDia(items: Lancamento[]) {
  const grupos: { dia: string | null; itens: Lancamento[] }[] = [];
  for (const l of items) {
    const dia = getDisplayDate(l.data_efetivacao, l.data_vencimento, l.status) ?? null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dia === dia) ultimo.itens.push(l);
    else grupos.push({ dia, itens: [l] });
  }
  return grupos;
}

function Linha({
  l,
  canEdit,
  paga,
  atrasada,
  onOpen,
  onMarkPaid,
}: {
  l: Lancamento;
  canEdit: boolean;
  paga: boolean;
  atrasada: boolean;
  onOpen: () => void;
  onMarkPaid: () => void;
}) {
  const formatCurrency = useMoneyMask();
  const isReceita = l.tipo === "receita";
  const isTransf = l.tipo === "transferencia";
  const podeMarcar = canEdit && !paga && !isTransf;

  const [deslocamento, setDeslocamento] = useState(0);
  const [aberta, setAberta] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const horizontal = useRef(false);
  const moveu = useRef(false);

  const aoSoltar = () => {
    if (!inicio.current) return;
    inicio.current = null;
    setArrastando(false);
    if (horizontal.current) {
      const abre = deslocamento < -ACAO_LARGURA / 2;
      setAberta(abre);
      setDeslocamento(abre ? -ACAO_LARGURA : 0);
    } else {
      setDeslocamento(aberta ? -ACAO_LARGURA : 0);
    }
  };

  const rotuloAcao = isReceita ? "Marcar recebido" : "Marcar pago";
  const apoio = [isTransf ? l.conta_nome : l.projeto_nome || l.categoria_nome, l.contraparte_nome]
    .filter(Boolean)
    .join(" · ");
  const parcela =
    !isTransf && l.parcela_numero && l.parcela_total && l.parcela_total > 1
      ? `${l.parcela_numero}/${l.parcela_total}`
      : null;

  return (
    <div className="relative overflow-hidden border-b border-black/5">
      {podeMarcar && (
        <div className="absolute inset-y-0 right-0 flex items-stretch bg-ink" style={{ width: ACAO_LARGURA }}>
          <button
            type="button"
            tabIndex={aberta ? 0 : -1}
            aria-hidden={!aberta}
            onClick={() => {
              setAberta(false);
              setDeslocamento(0);
              onMarkPaid();
            }}
            className="flex w-full flex-col items-center justify-center gap-1 text-xs font-semibold text-white"
          >
            <Check size={18} strokeWidth={2.4} className="text-brand" aria-hidden="true" />
            {rotuloAcao}
          </button>
        </div>
      )}
      <div
        role="button"
        tabIndex={0}
        aria-label={`${l.descricao}, ${isReceita ? "receita" : isTransf ? "transferência" : "despesa"}, ${formatCurrency(l.valor)}`}
        onClick={() => {
          if (moveu.current) {
            moveu.current = false;
            return;
          }
          if (aberta) {
            setAberta(false);
            setDeslocamento(0);
            return;
          }
          onOpen();
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          onOpen();
        }}
        onPointerDown={
          podeMarcar
            ? (e) => {
                inicio.current = { x: e.clientX, y: e.clientY };
                horizontal.current = false;
                moveu.current = false;
              }
            : undefined
        }
        onPointerMove={
          podeMarcar
            ? (e) => {
                if (!inicio.current) return;
                const dx = e.clientX - inicio.current.x;
                const dy = e.clientY - inicio.current.y;
                if (!horizontal.current) {
                  if (Math.abs(dx) < LIMIAR_DE_TOQUE || Math.abs(dx) < Math.abs(dy)) return;
                  horizontal.current = true;
                  moveu.current = true;
                  setArrastando(true);
                  e.currentTarget.setPointerCapture(e.pointerId);
                }
                const base = aberta ? -ACAO_LARGURA : 0;
                setDeslocamento(Math.min(0, Math.max(-ACAO_LARGURA, base + dx)));
              }
            : undefined
        }
        onPointerUp={podeMarcar ? aoSoltar : undefined}
        onPointerCancel={podeMarcar ? aoSoltar : undefined}
        style={{ transform: `translateX(${deslocamento}px)`, touchAction: podeMarcar ? "pan-y" : undefined }}
        className={cn(
          "relative flex min-h-[64px] cursor-pointer items-center gap-3 bg-background px-5 py-3 outline-hidden transition-transform duration-200 ease-out focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring motion-reduce:transition-none",
          arrastando && "transition-none"
        )}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-[15px] font-medium leading-snug text-ink">{l.descricao}</p>
          <p className="flex items-center gap-1.5 text-[13px] leading-snug text-muted-foreground">
            {atrasada && (
              <span className="shrink-0 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-semibold text-danger-mid">
                Atrasado
              </span>
            )}
            {!atrasada && !paga && (
              <span className="shrink-0 rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-semibold text-info-mid">
                {isReceita ? "A receber" : "A pagar"}
              </span>
            )}
            <span className="truncate">
              {apoio}
              {apoio && paga ? " · " : ""}
              {paga ? l.status : ""}
              {parcela ? ` · ${parcela}` : ""}
            </span>
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-[15px] font-semibold tabular-nums",
            isTransf ? "text-info-mid" : isReceita ? "text-positive-strong" : "text-negative-strong"
          )}
        >
          {isTransf ? "⇄" : isReceita ? "+" : "−"}
          {formatCurrency(l.valor)}
        </span>
      </div>
    </div>
  );
}

/**
 * Lista de lançamentos do celular (SPEC 134): no lugar da tabela de 11 colunas, linhas
 * agrupadas por dia com descrição, apoio e valor. Deslizar a linha revela "Marcar pago",
 * que abre o mesmo diálogo de data da tabela. Toque abre o detalhe.
 */
export function LancamentosListaMobile({
  items,
  loading,
  temFiltro,
  canEdit,
  isPaid,
  isOverdue,
  onOpen,
  onMarkPaid,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: Props) {
  if (loading && items.length === 0) {
    return <PageLoader size="section" label="Buscando lançamentos" />;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        iconTone="brand"
        title={temFiltro ? "Nenhum lançamento com esses filtros" : "Nenhum lançamento ainda"}
        description={
          temFiltro
            ? "Mude o período ou limpe os filtros para ver mais."
            : "Registre a primeira entrada ou saída para ver o saldo e o que vence."
        }
      />
    );
  }

  return (
    <div className="-mx-6 overflow-hidden border-y border-black/5 bg-background">
      {agruparPorDia(items).map((g) => (
        <section key={`${g.dia}-${g.itens[0].tipo}-${g.itens[0].id}`}>
          <h3 className="bg-background px-5 pb-1.5 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {rotuloDoDia(g.dia)}
          </h3>
          {g.itens.map((l) => (
            <Linha
              key={`${l.tipo}-${l.id}`}
              l={l}
              canEdit={canEdit}
              paga={isPaid(l)}
              atrasada={isOverdue(l)}
              onOpen={() => onOpen(l)}
              onMarkPaid={() => onMarkPaid(l)}
            />
          ))}
        </section>
      ))}
      {hasNextPage && (
        <div className="flex justify-center px-4 py-4">
          <Button variant="outline" size="sm" onClick={onLoadMore} loading={isFetchingNextPage}>
            Carregar mais
          </Button>
        </div>
      )}
    </div>
  );
}
