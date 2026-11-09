import { Star } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { diaDoTimestamp, formatarNota } from "@/lib/cotacaoConvite";
import { type AvaliacaoFornecedor } from "@/hooks/useFornecedorAvaliacoes";

/** Média das notas gerais das avaliações, uma casa decimal; sem avaliação, nulo. */
export function notaMedia(avaliacoes: AvaliacaoFornecedor[]): number | null {
  const notas = avaliacoes.map((a) => a.nota_geral).filter((n): n is number => n !== null);
  if (notas.length === 0) return null;
  return Math.round((notas.reduce((a, b) => a + Number(b), 0) / notas.length) * 10) / 10;
}

const CRITERIOS: Array<{ rotulo: string; chave: keyof AvaliacaoFornecedor }> = [
  { rotulo: "Demora", chave: "nota_demora" },
  { rotulo: "Preço", chave: "nota_preco" },
  { rotulo: "Prazo", chave: "nota_prazo" },
  { rotulo: "Qualidade", chave: "nota_qualidade" },
];

/** Aba Avaliações da página do fornecedor (SPEC 144). A nota é interna: o fornecedor nunca a vê. */
export function AvaliacoesFornecedor({ avaliacoes }: { avaliacoes: AvaliacaoFornecedor[] }) {
  if (avaliacoes.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="Nenhuma avaliação ainda"
        description="Depois de fechar uma compra com este fornecedor, avalie na proposta vencedora da cotação."
      />
    );
  }

  return (
    <div className="space-y-2">
      {avaliacoes.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.cotacao?.descricao ?? "Cotação removida"}</p>
                <p className="text-xs text-muted-foreground">
                  {[a.cotacao?.obra?.nome, diaDoTimestamp(a.avaliado_em)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <span className="rounded-md bg-brand px-2 py-0.5 text-sm font-semibold tabular-nums text-ink">
                {formatarNota(a.nota_geral)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {CRITERIOS.filter((c) => a[c.chave] !== null).map((c) => (
                <span key={c.rotulo}>
                  {c.rotulo} <b className="tabular-nums text-ink">{String(a[c.chave])}</b>
                </span>
              ))}
            </div>
            {a.comentario && <p className="mt-2 text-sm text-ink">{a.comentario}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
