import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import type { PainelGestao } from "@/hooks/usePainelGestao";
import { Vazio } from "./Numeros";

/**
 * Listas do painel: prazo de disciplina, fila de aprovação e diário de obra.
 *
 * Cada linha é clicável e leva à tela de origem. Cor entra só no número que
 * carrega estado (vencido, esperando demais), nunca na linha inteira.
 */

export function ListaPrazos({ data }: { data: PainelGestao }) {
  const navigate = useNavigate();
  const itens = data.projetos.prazos15Dias;
  if (itens.length === 0) return <Vazio>Nenhuma disciplina em aberto vence nos próximos 15 dias.</Vazio>;
  return (
    <div className="flex flex-col">
      {itens.map((p) => {
        const texto = p.dias < 0 ? `venceu há ${Math.abs(p.dias)} d` : p.dias === 0 ? "vence hoje" : `em ${p.dias} d`;
        return (
          <button
            key={p.disciplinaId}
            type="button"
            onClick={() => navigate(`/projetos/${p.projetoId}`)}
            className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-border py-2 text-left last:border-b-0 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
          >
            <span className="min-w-0 text-[12.5px] text-ink-soft">
              <span className="block truncate">
                {p.disciplina} · {p.projeto}
              </span>
              {p.responsavel && <small className="block text-[11px] text-muted-foreground">{p.responsavel}</small>}
            </span>
            <span
              className={cn(
                "whitespace-nowrap text-[12.5px] font-semibold tabular-nums",
                p.dias < 0 ? "text-danger-mid" : "text-ink-soft"
              )}
            >
              {texto}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ListaAprovacoes({ data }: { data: PainelGestao }) {
  const navigate = useNavigate();
  const itens = data.gestao.filaAprovacao;
  if (itens.length === 0) return <Vazio>Nada esperando aprovação.</Vazio>;
  return (
    <div className="flex flex-col">
      {itens.map((a) => (
        <button
          key={a.escopoId}
          type="button"
          onClick={() => navigate(`/projetos/${a.projetoId}`)}
          className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-border py-2 text-left last:border-b-0 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
        >
          <span className="min-w-0 truncate text-[12.5px] text-ink-soft">
            {a.tipo === "aditivo" ? "Aditivo" : "Escopo"} · {a.projeto}
          </span>
          <span
            className={cn(
              "whitespace-nowrap text-[12.5px] font-semibold tabular-nums",
              a.dias > 15 ? "text-danger-mid" : "text-ink-soft"
            )}
          >
            {a.dias} d
          </span>
        </button>
      ))}
    </div>
  );
}

export function ListaRdo({ data }: { data: PainelGestao }) {
  const navigate = useNavigate();
  const itens = data.obras.rdoPorObra;
  if (itens.length === 0) return <Vazio>Nenhuma obra em andamento.</Vazio>;
  return (
    <div className="flex flex-col">
      {itens.map((o) => (
        <button
          key={o.obraId}
          type="button"
          onClick={() => navigate(`/obras/${o.obraId}`)}
          className="grid grid-cols-[1fr_auto] items-center gap-2.5 border-b border-border py-2 text-left last:border-b-0 hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
        >
          <span className="min-w-0 text-[12.5px] text-ink-soft">
            <span className="block truncate">{o.obra}</span>
            <small className="block text-[11px] text-muted-foreground">
              {o.ultimoRdo ? `último em ${formatDate(o.ultimoRdo)}` : "nenhum RDO lançado"}
            </small>
          </span>
          <span
            className={cn(
              "whitespace-nowrap text-[12.5px] font-semibold tabular-nums",
              o.diasSemRdo === null || o.diasSemRdo > 3 ? "text-danger-mid" : "text-ink-soft"
            )}
          >
            {o.diasSemRdo === null ? "sem RDO" : `${o.diasSemRdo} d`}
          </span>
        </button>
      ))}
    </div>
  );
}
