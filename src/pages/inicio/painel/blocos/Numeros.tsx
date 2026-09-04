import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { statusBadgeClasses, statusLabel } from "@/lib/status";
import type { PainelGestao } from "@/hooks/usePainelGestao";

/**
 * Blocos de número do painel (SPEC 092).
 *
 * Regra de cor desta tela: o número é sempre tinta. Cor entra só onde carrega
 * ESTADO, e sempre como badge (fundo soft + texto strong do registry de status),
 * nunca como cor do número nem como fundo de card. É o que mantém a tela com
 * cara de Pilar em vez de painel de aeroporto.
 */

type NumeroProps = {
  valor: string | number;
  rotulo: string;
  /** Chip de estado à direita do número. Use só quando houver estado. */
  chip?: { texto: string; dominio: "projeto" | "financeiro"; status: string } | null;
  destaque?: "atencao" | null;
  onClick?: () => void;
};

function Numero({ valor, rotulo, chip, destaque, onClick }: NumeroProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col gap-0.5 rounded-xl border border-black/5 p-3 text-left",
        destaque === "atencao" ? "border-l-[3px] border-l-negative" : null,
        onClick && "transition-colors hover:bg-black/[0.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      )}
    >
      <span className="flex items-baseline gap-2">
        <span className="text-2xl font-bold leading-none tabular-nums text-ink">{valor}</span>
        {chip && (
          <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-medium", statusBadgeClasses(chip.dominio, chip.status))}>
            {chip.texto}
          </span>
        )}
      </span>
      <span className="text-xs text-muted-foreground">{rotulo}</span>
    </Tag>
  );
}

/** Grid de números que se adapta ao tamanho do widget. */
function GradeNumeros({ children, colunas }: { children: React.ReactNode; colunas: number }) {
  return (
    <div
      className={cn(
        "grid gap-2",
        colunas <= 2 ? "grid-cols-2" : colunas === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"
      )}
    >
      {children}
    </div>
  );
}

/** Projetos: o pedido literal do design partner (total, em andamento, concluídos, atrasados). */
export function NumerosProjetos({ data }: { data: PainelGestao }) {
  const navigate = useNavigate();
  const t = data.projetos.totais;
  return (
    <GradeNumeros colunas={4}>
      <Numero valor={t.ativos} rotulo="projetos ativos" onClick={() => navigate("/projetos")} />
      <Numero valor={t.emAndamento} rotulo="em andamento" onClick={() => navigate("/projetos")} />
      <Numero valor={t.concluidosAno} rotulo="concluídos no ano" onClick={() => navigate("/projetos")} />
      <Numero
        valor={t.atrasados}
        rotulo="com prazo estourado"
        destaque={t.atrasados > 0 ? "atencao" : null}
        chip={t.risco > 0 ? { texto: `+${t.risco} em risco`, dominio: "projeto", status: "Planejamento" } : null}
        onClick={() => navigate("/projetos")}
      />
    </GradeNumeros>
  );
}

/** Comercial em quatro números, sem gráfico. */
export function NumerosPropostas({ data }: { data: PainelGestao }) {
  const navigate = useNavigate();
  const p = data.gestao.propostasTotais;
  const ir = () => navigate("/gestao/propostas");
  return (
    <GradeNumeros colunas={4}>
      <Numero valor={p.enviadas} rotulo="propostas em 90 dias" onClick={ir} />
      <Numero valor={p.ganhas} rotulo="ganhas" onClick={ir} />
      <Numero valor={p.perdidas} rotulo="perdidas" onClick={ir} />
      <Numero
        valor={p.conversaoPct === null ? "sem decisão" : `${p.conversaoPct}%`}
        rotulo="taxa de conversão"
        onClick={ir}
      />
    </GradeNumeros>
  );
}

export function NumerosObras({ data }: { data: PainelGestao }) {
  const navigate = useNavigate();
  const o = data.obras.totais;
  const ir = () => navigate("/obras");
  return (
    <GradeNumeros colunas={4}>
      <Numero valor={o.emAndamento} rotulo="obras em andamento" onClick={ir} />
      <Numero valor={o.planejadas} rotulo="planejadas" onClick={ir} />
      <Numero valor={o.paralisadas} rotulo="paralisadas" onClick={ir} />
      <Numero
        valor={o.atrasadas}
        rotulo="com prazo estourado"
        destaque={o.atrasadas > 0 ? "atencao" : null}
        onClick={ir}
      />
    </GradeNumeros>
  );
}

/** Status dos projetos ativos: contagem com o badge do registry. */
export function ListaStatusProjetos({ data }: { data: PainelGestao }) {
  const itens = data.projetos.statusAtivos;
  if (itens.length === 0) return <Vazio>Nenhum projeto ativo.</Vazio>;
  return (
    <div className="flex flex-col">
      {itens.map((s) => (
        <div key={s.status} className="flex items-center gap-2.5 border-b border-border py-2 last:border-b-0">
          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-medium", statusBadgeClasses("projeto", s.status))}>
            {statusLabel("projeto", s.status)}
          </span>
          <span className="ml-auto text-sm font-semibold tabular-nums">{s.n}</span>
        </div>
      ))}
    </div>
  );
}

export function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex flex-1 items-center rounded-xl bg-black/[0.02] px-3 py-5 text-xs text-muted-foreground">
      {children}
    </p>
  );
}
