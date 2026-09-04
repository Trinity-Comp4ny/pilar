import { cn } from "@/lib/utils";
import type { Feature } from "@/lib/permissions";
import type { ItemLayout, Tamanho } from "@/hooks/usePainelLayout";
import type { PainelGestao } from "@/hooks/usePainelGestao";
import { BarrasDivergentes, BarrasHorizontais, CargaPorPessoa, LegendaPainel } from "./blocos/Primitivas";
import { ConversaoMensalChart, PontualidadeChart, ThroughputChart } from "./blocos/Graficos";
import { ListaStatusProjetos, NumerosObras, NumerosProjetos, NumerosPropostas, Vazio } from "./blocos/Numeros";
import { ListaAprovacoes, ListaPrazos, ListaRdo } from "./blocos/Listas";

/**
 * Catálogo de widgets do painel (SPEC 092, ADR 0038).
 *
 * Fonte única de verdade do que existe na tela: cada item declara a seção, os
 * tamanhos que aceita, a permissão que exige e como renderiza. Adicionar um
 * widget novo é adicionar uma entrada aqui, e ele aparece no seletor sozinho.
 *
 * `secao` é módulo do produto (Gestão, Projetos, Obras, Financeiro), não
 * taxonomia analítica: é assim que o usuário navega o resto do sistema.
 */

export type Secao = "gestao" | "projetos" | "obras" | "financeiro";

export const SECOES: { key: Secao; label: string; feature: Feature | null }[] = [
  { key: "gestao", label: "Gestão", feature: null },
  { key: "projetos", label: "Projetos", feature: "projetos" },
  { key: "obras", label: "Obras", feature: "obras" },
  { key: "financeiro", label: "Financeiro", feature: "financeiro" },
];

export type Widget = {
  id: string;
  titulo: string;
  /** Uma linha no seletor, dizendo que pergunta o widget responde. */
  descricao: string;
  secao: Secao;
  tamanhos: Tamanho[];
  padrao: Tamanho;
  /** Permissão exigida. Sem ela, o widget não entra no catálogo nem renderiza. */
  feature: Feature | null;
  render: (data: PainelGestao) => React.ReactNode;
  /** Linha de leitura no pé do card. */
  leitura?: (data: PainelGestao) => React.ReactNode;
  /** Marca o widget que depende de migration para ser confiável. */
  fase2?: string;
};

const fmtMoeda = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const CATALOGO: Widget[] = [
  // ── Gestão ────────────────────────────────────────────────────────────────
  {
    id: "gestao_propostas_numeros",
    titulo: "Propostas em números",
    descricao: "Enviadas, ganhas, perdidas e a taxa de conversão dos últimos 90 dias.",
    secao: "gestao",
    tamanhos: ["meia", "inteira"],
    padrao: "meia",
    feature: "propostas",
    render: (d) => <NumerosPropostas data={d} />,
  },
  {
    id: "gestao_funil",
    titulo: "Funil de propostas",
    descricao: "Quantas propostas estão em cada etapa, em contagem.",
    secao: "gestao",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "propostas",
    render: (d) =>
      d.gestao.funil.every((f) => f.n === 0) ? (
        <Vazio>Nenhuma proposta criada nos últimos 90 dias.</Vazio>
      ) : (
        <BarrasHorizontais
          itens={d.gestao.funil.map((f) => ({
            id: f.etapa,
            nome: ROTULO_FUNIL[f.etapa] ?? f.etapa,
            valor: f.n,
            tone: f.etapa === "recusada" || f.etapa === "expirada" ? "estado" : "main",
          }))}
        />
      ),
  },
  {
    id: "gestao_conversao_mensal",
    titulo: "Conversão por mês de entrada",
    descricao: "Das propostas que entraram no mês, quantas fecharam.",
    secao: "gestao",
    tamanhos: ["meia", "inteira"],
    padrao: "meia",
    feature: "propostas",
    fase2: "Com propostas.decidida_em isto passa a ser a linha do tempo das decisões",
    render: (d) =>
      d.gestao.conversaoMensal.every((m) => m.ganhas + m.perdidas === 0) ? (
        <Vazio>Sem proposta decidida nos últimos 12 meses.</Vazio>
      ) : (
        <>
          <ConversaoMensalChart dados={d.gestao.conversaoMensal} />
          <LegendaPainel
            itens={[
              { label: "Ganhas", cls: "bg-chart-info" },
              { label: "Perdidas", cls: "bg-chart-neutral" },
              { label: "Taxa de conversão", cls: "bg-chart-info", linha: true },
            ]}
          />
        </>
      ),
    leitura: () => "Coorte de entrada, não data de decisão: o schema ainda não registra quando a proposta fechou.",
  },
  {
    id: "gestao_motivo_perda",
    titulo: "Por que perdemos",
    descricao: "Motivo das perdas nos últimos 12 meses, do maior para o menor.",
    secao: "gestao",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "leads",
    fase2: "leads.motivo_perda é texto livre: o painel normaliza o que dá e agrupa o resto em Outro",
    render: (d) => {
      const total = d.gestao.motivosPerda.reduce((s, m) => s + m.n, 0);
      if (total === 0) return <Vazio>Nenhum lead marcado como perdido nos últimos 12 meses.</Vazio>;
      return (
        <BarrasHorizontais
          tone="estado"
          itens={d.gestao.motivosPerda.map((m) => ({
            id: m.motivo,
            nome: m.motivo,
            valor: m.n,
            detalhe: `${Math.round((m.n / total) * 100)}%`,
          }))}
        />
      );
    },
  },
  {
    id: "gestao_espera_proposta",
    titulo: "Tempo na mão do cliente",
    descricao: "Idade das propostas enviadas que ainda não têm decisão.",
    secao: "gestao",
    tamanhos: ["kpi", "terco"],
    padrao: "terco",
    feature: "propostas",
    render: (d) =>
      d.gestao.propostasTotais.aguardando === 0 ? (
        <Vazio>Nenhuma proposta aguardando decisão.</Vazio>
      ) : (
        <BarrasHorizontais
          itens={d.gestao.esperaProposta.map((e) => ({
            id: e.faixa,
            nome: e.faixa,
            valor: e.n,
            tone: e.faixa === "Mais de 30 dias" ? "estado" : "main",
          }))}
        />
      ),
  },
  {
    id: "gestao_origem_lead",
    titulo: "Origem do lead e taxa de ganho",
    descricao: "De onde vêm os leads e qual origem realmente fecha.",
    secao: "gestao",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "leads",
    render: (d) =>
      d.gestao.origemGanho.length === 0 ? (
        <Vazio>Precisa de pelo menos 2 leads por origem para comparar.</Vazio>
      ) : (
        <BarrasHorizontais
          itens={d.gestao.origemGanho.map((o) => ({
            id: o.origem,
            nome: o.origem,
            valor: o.leads,
            detalhe: o.ganhoPct === null ? undefined : `${o.ganhoPct}% ganho`,
          }))}
        />
      ),
  },
  {
    id: "gestao_ritmo_entrega",
    titulo: "Ritmo de entrega",
    descricao: "Tarefas concluídas por semana, contra a média do período.",
    secao: "gestao",
    tamanhos: ["meia", "inteira"],
    padrao: "meia",
    feature: null,
    render: (d) => {
      const serie = d.gestao.throughputSemanal;
      if (serie.every((s) => s.n === 0)) return <Vazio>Nenhuma tarefa concluída nas últimas 12 semanas.</Vazio>;
      const media = Math.round(serie.reduce((s, x) => s + x.n, 0) / serie.length);
      return <ThroughputChart dados={serie} media={media} />;
    },
  },
  {
    id: "gestao_carga_equipe",
    titulo: "Carga da equipe",
    descricao: "Disciplinas abertas por pessoa, separando em dia de atrasada.",
    secao: "gestao",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "projetos",
    render: (d) =>
      d.gestao.cargaEquipe.length === 0 ? (
        <Vazio>Nenhuma disciplina aberta com responsável definido.</Vazio>
      ) : (
        <>
          <CargaPorPessoa itens={d.gestao.cargaEquipe} />
          <LegendaPainel
            itens={[
              { label: "Em dia", cls: "bg-chart-info" },
              { label: "Atrasada", cls: "bg-negative" },
            ]}
          />
        </>
      ),
  },
  {
    id: "gestao_aprovacoes",
    titulo: "Esperando aprovação",
    descricao: "Escopos e aditivos parados, e há quantos dias.",
    secao: "gestao",
    tamanhos: ["kpi", "terco", "meia"],
    padrao: "terco",
    feature: "projetos",
    render: (d) => <ListaAprovacoes data={d} />,
  },

  // ── Projetos ──────────────────────────────────────────────────────────────
  {
    id: "projetos_numeros",
    titulo: "Projetos em números",
    descricao: "Ativos, em andamento, concluídos no ano e com prazo estourado.",
    secao: "projetos",
    tamanhos: ["meia", "inteira"],
    padrao: "inteira",
    feature: "projetos",
    render: (d) => <NumerosProjetos data={d} />,
  },
  {
    id: "projetos_status",
    titulo: "Status dos ativos",
    descricao: "Quantos projetos em cada status.",
    secao: "projetos",
    tamanhos: ["kpi", "terco"],
    padrao: "terco",
    feature: "projetos",
    render: (d) => <ListaStatusProjetos data={d} />,
  },
  {
    id: "projetos_pontualidade",
    titulo: "Entregamos no prazo?",
    descricao: "Percentual dos concluídos que saiu no prazo, mês a mês.",
    secao: "projetos",
    tamanhos: ["meia", "inteira"],
    padrao: "meia",
    feature: "projetos",
    fase2: "Só é honesto com projetos.data_previsao_original congelada",
    render: (d) => {
      const comDado = d.projetos.pontualidadeMensal.filter((m) => m.total > 0).length;
      if (comDado === 0) return <Vazio>Nenhum projeto concluído com data de previsão nos últimos 12 meses.</Vazio>;
      if (comDado < 3)
        return <Vazio>Só {comDado} mês com projeto concluído. A série fica confiável a partir de 3 meses.</Vazio>;
      return <PontualidadeChart dados={d.projetos.pontualidadeMensal} />;
    },
    leitura: () => "Medido contra data_previsao, que é editável: prazo empurrado conta como cumprido.",
  },
  {
    id: "projetos_atraso_disciplina",
    titulo: "Onde o atraso acontece",
    descricao: "Atraso médio por disciplina, já descontando pausa documentada.",
    secao: "projetos",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "projetos",
    render: (d) =>
      d.projetos.atrasoPorDisciplina.length === 0 ? (
        <Vazio>Nenhuma disciplina concluída com atraso nos últimos 12 meses.</Vazio>
      ) : (
        <BarrasHorizontais
          tone="estado"
          itens={d.projetos.atrasoPorDisciplina.map((x) => ({
            id: x.disciplina,
            nome: x.disciplina,
            valor: x.diasMedio,
            detalhe: "dias",
            titulo: `${x.entregas} entrega${x.entregas === 1 ? "" : "s"} com atraso`,
          }))}
        />
      ),
  },
  {
    id: "projetos_prazos_15",
    titulo: "Vence nos próximos 15 dias",
    descricao: "Disciplinas em aberto com prazo chegando, e quem responde por elas.",
    secao: "projetos",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "projetos",
    render: (d) => <ListaPrazos data={d} />,
  },
  {
    id: "projetos_horas",
    titulo: "Horas: estimado contra real",
    descricao: "Projetos que mais fugiram das horas orçadas, para cima e para baixo.",
    secao: "projetos",
    tamanhos: ["meia", "inteira"],
    padrao: "meia",
    feature: "projetos",
    render: (d) =>
      d.projetos.horasPorProjeto.length === 0 ? (
        <Vazio>Nenhum projeto ativo tem horas estimadas nas disciplinas.</Vazio>
      ) : (
        <BarrasDivergentes
          itens={d.projetos.horasPorProjeto.map((h) => ({
            id: h.projetoId,
            nome: h.projeto,
            pct: h.desvioPct ?? 0,
            titulo: `${h.estimadas} h estimadas, ${h.realizadas} h lançadas`,
          }))}
        />
      ),
  },

  // ── Obras ─────────────────────────────────────────────────────────────────
  {
    id: "obras_numeros",
    titulo: "Obras em números",
    descricao: "Em andamento, planejadas, paralisadas e com prazo estourado.",
    secao: "obras",
    tamanhos: ["meia", "inteira"],
    padrao: "inteira",
    feature: "obras",
    render: (d) => <NumerosObras data={d} />,
  },
  {
    id: "obras_rdo",
    titulo: "Diário de obra em atraso",
    descricao: "Há quantos dias cada obra em andamento não recebe RDO.",
    secao: "obras",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "obras",
    render: (d) => <ListaRdo data={d} />,
    leitura: () => "Obra sem RDO há mais de 3 dias é obra sem registro do que aconteceu.",
  },
  {
    id: "obras_avanco",
    titulo: "Avanço das obras",
    descricao: "Percentual de tarefas concluídas por obra em andamento.",
    secao: "obras",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "obras",
    render: (d) =>
      d.obras.avancoPorObra.length === 0 ? (
        <Vazio>Nenhuma obra em andamento com tarefa cadastrada.</Vazio>
      ) : (
        <BarrasHorizontais
          itens={d.obras.avancoPorObra.map((o) => ({
            id: o.obraId,
            nome: o.obra,
            valor: o.pct ?? 0,
            rotulo: `${o.pct ?? 0}%`,
            detalhe: `${o.concluidas} de ${o.total}`,
          }))}
        />
      ),
  },

  // ── Financeiro: no catálogo só de quem pode ver dinheiro (ADR 0034/0038) ──
  {
    id: "fin_mes",
    titulo: "Caixa do mês",
    descricao: "Recebido, a receber e a pagar no mês corrente.",
    secao: "financeiro",
    tamanhos: ["meia", "inteira"],
    padrao: "meia",
    feature: "financeiro",
    render: (d) => {
      if (!d.financeiro) return <Vazio>Sem acesso ao financeiro.</Vazio>;
      const f = d.financeiro;
      return (
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {[
            { v: f.mes.recebido, r: "recebido no mês", ruim: false },
            { v: f.mes.aReceber, r: "a receber", ruim: false },
            { v: f.despesaMes.aPagar, r: "a pagar", ruim: false },
            { v: f.mes.receberVencido, r: "a receber vencido", ruim: f.mes.receberVencido > 0 },
          ].map((x) => (
            <div
              key={x.r}
              className={cn(
                "flex flex-col gap-0.5 rounded-xl border border-black/5 p-3",
                x.ruim && "border-l-[3px] border-l-negative"
              )}
            >
              <span className="whitespace-nowrap text-lg font-bold leading-none tabular-nums text-ink">
                {fmtMoeda(x.v)}
              </span>
              <span className="text-xs text-muted-foreground">{x.r}</span>
            </div>
          ))}
        </div>
      );
    },
  },
  {
    id: "fin_margem",
    titulo: "Margem por projeto ativo",
    descricao: "Orçado contra custo real, do pior para o melhor.",
    secao: "financeiro",
    tamanhos: ["terco", "meia"],
    padrao: "meia",
    feature: "financeiro",
    render: (d) =>
      !d.financeiro || d.financeiro.margemPorProjeto.length === 0 ? (
        <Vazio>Nenhum projeto ativo com orçamento por disciplina lançado.</Vazio>
      ) : (
        <BarrasDivergentes
          itens={d.financeiro.margemPorProjeto.map((m) => ({
            id: m.projetoId,
            nome: m.projeto,
            pct: -(m.pct ?? 0),
            titulo: `margem de ${m.pct ?? 0}%`,
          }))}
        />
      ),
    leitura: () => "Barra à direita é margem negativa: o projeto vai fechar no prejuízo.",
  },
];

const ROTULO_FUNIL: Record<string, string> = {
  rascunho: "Rascunho, nunca enviada",
  enviada: "Enviada, sem decisão",
  aceita: "Aceita",
  recusada: "Recusada",
  expirada: "Expirada",
};

export const POR_ID = new Map(CATALOGO.map((w) => [w.id, w]));

/**
 * Layout padrão: enxuto de propósito. Números palpáveis primeiro, um gráfico
 * por módulo, e nada de financeiro (ADR 0038). Quem quiser mais, adiciona.
 */
export const LAYOUT_PADRAO: ItemLayout[] = [
  { w: "projetos_numeros", s: "inteira" },
  { w: "gestao_propostas_numeros", s: "meia" },
  { w: "projetos_prazos_15", s: "meia" },
  { w: "projetos_pontualidade", s: "meia" },
  { w: "gestao_motivo_perda", s: "meia" },
];

export const LARGURA: Record<Tamanho, string> = {
  kpi: "lg:col-span-3",
  terco: "lg:col-span-4",
  meia: "lg:col-span-6",
  inteira: "lg:col-span-12",
};

export const ROTULO_TAMANHO: Record<Tamanho, string> = {
  kpi: "KPI",
  terco: "Um terço",
  meia: "Meia tela",
  inteira: "Tela inteira",
};
