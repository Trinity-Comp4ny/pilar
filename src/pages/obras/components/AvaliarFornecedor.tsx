import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormDialog } from "@/components/FormDialog";
import { cn } from "@/lib/utils";
import { getSafeErrorMessage } from "@/lib/safeError";
import {
  CRITERIOS_AVALIACAO,
  formatarNota,
  notaGeral,
  type ChaveCriterio,
  type NotasAvaliacao,
} from "@/lib/cotacaoConvite";
import { useAvaliacaoDaProposta, useAvaliarFornecedor } from "@/hooks/useFornecedorAvaliacoes";

const VAZIAS: NotasAvaliacao = { demora: null, preco: null, prazo: null, qualidade: null };
const NOTAS = [0, 1, 2, 3, 4, 5];

interface Props {
  propostaId: string;
  fornecedorId: string | null;
  fornecedorNome: string;
}

/** "Avaliar fornecedor" na proposta vencedora (SPEC 144): 4 critérios de 0 a 5; o fornecedor nunca vê a nota. */
export function AvaliarFornecedor({ propostaId, fornecedorId, fornecedorNome }: Props) {
  const { data: atual } = useAvaliacaoDaProposta(propostaId);
  const [aberto, setAberto] = useState(false);

  // Sem fornecedor no cadastro não há página para guardar a nota.
  if (!fornecedorId) return null;

  return (
    <>
      {atual ? (
        <Button variant="ghost" size="sm" className="h-7" onClick={() => setAberto(true)}>
          Nota {formatarNota(atual.nota_geral)}
          <span className="ml-1 text-muted-foreground">· editar</span>
        </Button>
      ) : (
        <Button variant="outline" size="sm" className="h-7" onClick={() => setAberto(true)}>
          Avaliar fornecedor
        </Button>
      )}
      {aberto && (
        <AvaliacaoDialog
          propostaId={propostaId}
          fornecedorId={fornecedorId}
          fornecedorNome={fornecedorNome}
          inicial={
            atual
              ? {
                  notas: {
                    demora: atual.nota_demora,
                    preco: atual.nota_preco,
                    prazo: atual.nota_prazo,
                    qualidade: atual.nota_qualidade,
                  },
                  comentario: atual.comentario ?? "",
                }
              : { notas: VAZIAS, comentario: "" }
          }
          onClose={() => setAberto(false)}
        />
      )}
    </>
  );
}

function AvaliacaoDialog({
  propostaId,
  fornecedorId,
  fornecedorNome,
  inicial,
  onClose,
}: {
  propostaId: string;
  fornecedorId: string;
  fornecedorNome: string;
  inicial: { notas: NotasAvaliacao; comentario: string };
  onClose: () => void;
}) {
  const avaliar = useAvaliarFornecedor(propostaId, fornecedorId);
  const [notas, setNotas] = useState<NotasAvaliacao>(inicial.notas);
  const [comentario, setComentario] = useState(inicial.comentario);
  const geral = notaGeral(notas);

  const definir = (chave: ChaveCriterio, valor: number) =>
    setNotas((n) => ({ ...n, [chave]: n[chave] === valor ? null : valor }));

  return (
    <FormDialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={`Avaliar ${fornecedorNome}`}
      description="Nota de 0 a 5 por critério. Preencha ao menos um. O fornecedor não vê a nota."
      size="md"
      submitLabel="Salvar avaliação"
      isPending={avaliar.isPending}
      submitDisabled={geral === null}
      onSubmit={() =>
        avaliar.mutate(
          { notas, comentario },
          {
            onSuccess: () => {
              toast.success("Avaliação salva");
              onClose();
            },
            onError: (e) => toast.error(getSafeErrorMessage(e, "Não foi possível salvar a avaliação.")),
          }
        )
      }
    >
      <div className="space-y-3">
        {CRITERIOS_AVALIACAO.map((c) => (
          <div key={c.chave} role="group" aria-label={c.rotulo} className="flex items-center gap-3">
            <span className="w-40 shrink-0 text-sm text-ink">{c.rotulo}</span>
            <div className="flex gap-1">
              {NOTAS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={notas[c.chave] === n}
                  aria-label={`${c.rotulo}: ${n}`}
                  onClick={() => definir(c.chave, n)}
                  className={cn(
                    "h-8 w-8 rounded-md border text-sm tabular-nums transition-colors",
                    "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    notas[c.chave] === n
                      ? "border-transparent bg-brand font-semibold text-ink"
                      : "border-input text-muted-foreground hover:text-ink"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="space-y-1.5">
          <Label htmlFor="avaliacao-comentario">Comentário (opcional)</Label>
          <Input
            id="avaliacao-comentario"
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={500}
            placeholder="Ex.: entregou antes do combinado"
          />
        </div>
        <p className="text-sm font-medium text-ink">Nota geral: {formatarNota(geral)}</p>
      </div>
    </FormDialog>
  );
}
