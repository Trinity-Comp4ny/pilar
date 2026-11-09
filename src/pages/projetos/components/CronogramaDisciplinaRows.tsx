import { cn } from "@/lib/utils";
import { type ProjetoDisciplinaDB } from "@/types/projetos";
import { barPosition, DISCIPLINA_STATUS_COLORS, parseDate, textoSobreBarra } from "@/lib/cronograma";
import { useProjetoDisciplinas } from "@/hooks/useProjetoDisciplinas";

function discBarClass(d: ProjetoDisciplinaDB): string {
  return (DISCIPLINA_STATUS_COLORS[d.status] || DISCIPLINA_STATUS_COLORS["Não Iniciado"]).bar;
}

/**
 * Modo "Meus projetos" (SPEC 143): com `pessoaId`, só as disciplinas dela aparecem; as outras ficam
 * atrás de uma linha "+N disciplinas de outras pessoas". Coluna e timeline usam a mesma regra para
 * as linhas continuarem alinhadas.
 */
function separarPorPessoa(disciplinas: ProjetoDisciplinaDB[], pessoaId: string | undefined, mostrarOutras: boolean) {
  if (!pessoaId) return { exibidas: disciplinas, outras: 0 };
  const minhas = disciplinas.filter((d) => d.responsaveis?.some((r) => r.id === pessoaId));
  const outras = disciplinas.length - minhas.length;
  return { exibidas: mostrarOutras ? disciplinas : minhas, outras };
}

/** Sub-linhas da coluna fixa esquerda (nomes) para as disciplinas de um projeto expandido. */
export function DisciplinaLeftRows({
  projetoId,
  pessoaId,
  mostrarOutras = false,
  onMostrarOutras,
}: {
  projetoId: string;
  pessoaId?: string;
  mostrarOutras?: boolean;
  onMostrarOutras?: () => void;
}) {
  const { data: disciplinas, isLoading } = useProjetoDisciplinas(projetoId);

  if (isLoading) {
    return (
      <div className="h-10 border-b pl-8 pr-3 flex items-center">
        <div className="h-2 w-24 rounded bg-muted animate-pulse" />
      </div>
    );
  }

  if (!disciplinas || disciplinas.length === 0) {
    return (
      <div className="h-10 border-b pl-8 pr-3 flex items-center">
        <span className="text-[10px] text-muted-foreground">Nenhuma disciplina cadastrada</span>
      </div>
    );
  }

  const { exibidas, outras } = separarPorPessoa(disciplinas, pessoaId, mostrarOutras);
  const rotulo = `+${outras} disciplina${outras === 1 ? "" : "s"} de outras pessoas`;

  return (
    <>
      {exibidas.map((d) => (
        <div key={d.id} className="h-10 border-b pl-8 pr-3 flex items-center gap-1.5">
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full shrink-0", discBarClass(d))} aria-hidden />
          <span className="text-[11px] truncate">
            {d.codigo && <span className="font-mono text-muted-foreground mr-1">{d.codigo}</span>}
            {d.nome}
          </span>
        </div>
      ))}
      {outras > 0 && (
        <div className="h-10 border-b pl-8 pr-3 flex items-center">
          <button
            type="button"
            onClick={onMostrarOutras}
            aria-label={mostrarOutras ? undefined : rotulo}
            className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {mostrarOutras ? (
              "Ocultar disciplinas de outras pessoas"
            ) : (
              <>
                {/* Coluna de 104px no celular: o rótulo curto cabe, o completo fica no nome acessível. */}
                <span className="sm:hidden" aria-hidden>{`+${outras} de outras`}</span>
                <span className="hidden sm:inline">{rotulo}</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );
}

/** Sub-linhas da timeline (barras) para as disciplinas de um projeto expandido. Mesma
 *  query do useProjetoDisciplinas de DisciplinaLeftRows: o react-query dedupe evita
 *  refetch duplicado das duas colunas. */
export function DisciplinaTimelineRows({
  projetoId,
  timelineStart,
  timelineEnd,
  onNavigate,
  pessoaId,
  mostrarOutras = false,
}: {
  projetoId: string;
  timelineStart: Date;
  timelineEnd: Date;
  onNavigate: () => void;
  pessoaId?: string;
  mostrarOutras?: boolean;
}) {
  const { data: disciplinas, isLoading } = useProjetoDisciplinas(projetoId);

  if (isLoading || !disciplinas || disciplinas.length === 0) {
    return <div className="h-10 border-b relative" />;
  }

  const { exibidas, outras } = separarPorPessoa(disciplinas, pessoaId, mostrarOutras);

  return (
    <>
      {exibidas.map((d) => {
        const start = parseDate(d.data_inicio);
        const end = parseDate(d.data_fim);

        if (!start || !end) {
          return (
            <div key={d.id} className="h-10 border-b relative flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground/60">sem datas</span>
            </div>
          );
        }

        const { leftPct, widthPct } = barPosition(start, end, timelineStart, timelineEnd);

        return (
          <div key={d.id} className="h-10 border-b relative">
            <button
              type="button"
              onClick={onNavigate}
              className={cn(
                "absolute top-2 h-6 rounded flex items-center overflow-hidden shadow-sm border border-black/5 cursor-pointer",
                discBarClass(d)
              )}
              style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: "24px" }}
            >
              <span className={cn("text-[9px] font-medium truncate mx-2", textoSobreBarra(discBarClass(d)))}>
                {d.nome}
              </span>
            </button>
          </div>
        );
      })}
      {outras > 0 && <div className="h-10 border-b" />}
    </>
  );
}
