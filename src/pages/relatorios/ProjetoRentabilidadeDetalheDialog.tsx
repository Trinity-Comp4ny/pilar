import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

/**
 * Drill-down da margem (spec 037): abre as LINHAS que somam no número do projeto.
 * O que separa "planilha bonita" de número que o dono audita e assina embaixo.
 */

interface LinhaDetalhe {
  descricao: string | null;
  valor: number | null;
  status?: string | null;
  data?: string | null;
  fornecedor?: string | null;
  horas?: number | null;
  percentual?: number | null;
}

interface DetalheRentabilidade {
  receitas: LinhaDetalhe[];
  despesas_diretas: LinhaDetalhe[];
  custo_mo: LinhaDetalhe[];
  parcelas: LinhaDetalhe[];
}

function useProjetoRentabilidadeDetalhe(projetoId: string | null) {
  return useQuery({
    queryKey: ["projeto-rentabilidade-detalhe", projetoId],
    queryFn: async (): Promise<DetalheRentabilidade> => {
      const { data, error } = await supabase.rpc("get_projeto_rentabilidade_detalhe", {
        p_projeto_id: projetoId as string,
      });
      if (error) throw error;
      const d = (data ?? {}) as Partial<DetalheRentabilidade>;
      return {
        receitas: d.receitas ?? [],
        despesas_diretas: d.despesas_diretas ?? [],
        custo_mo: d.custo_mo ?? [],
        parcelas: d.parcelas ?? [],
      };
    },
    enabled: !!projetoId,
    staleTime: 2 * 60 * 1000,
  });
}

function Bloco({
  titulo,
  linhas,
  tone,
  vazioMsg,
}: {
  titulo: string;
  linhas: LinhaDetalhe[];
  tone: "positive" | "danger" | "neutral";
  vazioMsg: string;
}) {
  const subtotal = linhas.reduce((acc, l) => acc + Number(l.valor ?? 0), 0);
  const toneClass =
    tone === "positive" ? "text-positive-strong" : tone === "danger" ? "text-danger-strong" : "text-ink";

  return (
    <section>
      <div className="mb-1.5 flex items-baseline justify-between">
        <h4 className="text-sm font-semibold text-ink">{titulo}</h4>
        <span className={cn("text-sm font-semibold tabular-nums", toneClass)}>{formatCurrency(subtotal)}</span>
      </div>
      {linhas.length === 0 ? (
        <p className="rounded-md border border-border-subtle bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {vazioMsg}
        </p>
      ) : (
        <ul className="divide-y divide-border-subtle rounded-md border border-border-subtle">
          {linhas.map((l, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-3 py-1.5 text-xs">
              <span className="min-w-0 flex-1 truncate text-ink">
                {l.descricao || "Sem descrição"}
                {l.fornecedor ? <span className="text-ink/50"> · {l.fornecedor}</span> : null}
                {l.horas != null ? <span className="text-ink/50"> · {l.horas}h</span> : null}
              </span>
              <span className="shrink-0 text-ink/50">{formatDate(l.data)}</span>
              {l.status ? <span className="shrink-0 text-ink/50">{l.status}</span> : null}
              <span className="shrink-0 tabular-nums text-ink">{formatCurrency(Number(l.valor ?? 0))}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function ProjetoRentabilidadeDetalheDialog({
  projetoId,
  projetoNome,
  onClose,
}: {
  projetoId: string | null;
  projetoNome: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useProjetoRentabilidadeDetalhe(projetoId);

  return (
    <Dialog open={!!projetoId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>De onde vem a margem</DialogTitle>
          <DialogDescription>{projetoNome} · as linhas que compõem receita e custo</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : error || !data ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Não foi possível carregar o detalhe. Tente novamente em instantes.
          </p>
        ) : (
          <div className="max-h-[65vh] space-y-5 overflow-auto pr-1">
            <Bloco titulo="Receitas" linhas={data.receitas} tone="positive" vazioMsg="Nenhuma receita lançada." />
            <Bloco
              titulo="Despesas diretas"
              linhas={data.despesas_diretas}
              tone="danger"
              vazioMsg="Nenhuma despesa direta lançada."
            />
            <Bloco
              titulo="Custo de mão de obra"
              linhas={data.custo_mo}
              tone="danger"
              vazioMsg="Nenhuma hora apontada neste projeto. O custo de mão de obra depende do apontamento de horas."
            />
            <Bloco
              titulo="Parcelas de faturamento"
              linhas={data.parcelas}
              tone="neutral"
              vazioMsg="Nenhum marco de faturamento definido."
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
