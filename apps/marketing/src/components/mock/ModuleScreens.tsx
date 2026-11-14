/**
 * Telas de produto desenhadas em vetor, uma por módulo. Substituem o print
 * estático: nada aqui é imagem, então não corta, não pixela e não desatualiza
 * junto com a UI real. Toda animação respeita `prefers-reduced-motion`.
 */
import type { ReactNode } from "react";
import { m, useReducedMotion } from "framer-motion";
import type { MockNome, ModuloSlug } from "../../lib/modules";

/* As cores seguem o app, não a identidade da landing: cartão branco com borda
   black/5 sobre o fundo do shell, colunas em muted/40, status em tom suave com
   texto forte (`TONE_BADGE`) e ponto de status do registry. Antes os painéis
   eram cinza chapado e as barras do cronograma usavam o tom escuro dos módulos
   (azul-marinho, verde-musgo, marrom), que não existe no produto. */

/** Cartão do app: branco, cantos de 16px e borda black/5. */
const PAINEL = "bg-white border border-black/5 rounded-2xl";

/** Chip de status: tom suave com texto forte, o `TONE_BADGE` do app. */
const CHIP = {
  ok: "bg-success-soft text-success-strong",
  info: "bg-info-soft text-info-strong",
  neutro: "bg-app-muted text-ink-muted",
} as const;

/** Abas de uma tela de detalhe, em linha com sublinhado, como no app. */
function Abas({ itens, ativa }: { itens: string[]; ativa: string }) {
  return (
    <div className="flex items-center gap-4 border-b border-black/5 mb-4 overflow-hidden">
      {itens.map((item) => (
        <span
          key={item}
          className={`pb-1.5 -mb-px border-b-2 text-[9px] whitespace-nowrap ${
            item === ativa ? "border-ink font-medium text-ink" : "border-transparent text-black/60"
          }`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

const ABAS_OBRA = ["Visão", "Diário", "Cronograma", "Tarefas", "Cotações", "Estoque", "Conta da obra", "Acessos"];
const ABAS_PROJETO = ["Disciplinas", "Atividades", "Pagamentos", "Escopo", "Histórico"];

/* ── Gestão: funil de leads, com um card trocando de coluna ───────────── */

const LEADS = [
  {
    col: "Em Contato",
    n: 4,
    dot: "bg-pipeline-contato",
    cards: [{ t: "Retrofit elétrico, hospital", v: "R$ 84.000" }],
  },
  {
    col: "Proposta Enviada",
    n: 3,
    dot: "bg-pipeline-negociacao",
    cards: [{ t: "Climatização, centro cirúrgico", v: "R$ 128.400" }],
  },
  { col: "Em Negociação", n: 2, dot: "bg-brand", cards: [{ t: "Fotovoltaico, condomínio", v: "R$ 71.200" }] },
  { col: "Ganho", n: 6, dot: "bg-status-done", cards: [{ t: "Gases medicinais, clínica", v: "R$ 58.000" }] },
];

function Card({ t, v, className = "" }: { t: string; v: string; className?: string }) {
  return (
    <div className={`bg-white border border-app-border rounded-lg p-2 shadow-sm ${className}`}>
      <p className="text-[9.5px] leading-tight font-medium text-ink mb-1.5">{t}</p>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-app-muted shrink-0" />
        <span className="text-[8px] text-ink-muted tabular-nums">{v}</span>
      </div>
    </div>
  );
}

/** Cabeçalho de coluna de quadro: ponto de cor, nome e contagem em pílula. */
function CabecalhoColuna({ dot, nome, n }: { dot: string; nome: string; n: number }) {
  return (
    <div className="flex items-center gap-1.5 mb-2">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      <span className="text-[8.5px] font-medium text-ink truncate">{nome}</span>
      <span className="ml-auto rounded-full bg-app-muted px-1.5 text-[8px] tabular-nums text-ink-muted">{n}</span>
    </div>
  );
}

/**
 * Estático de propósito: nas páginas de módulo a tela faz papel de print do
 * produto, e um card se mexendo em loop vira ruído, não demonstração.
 */
export function KanbanScreen() {
  return (
    <div>
      <ScreenHead crumb="Gestão · Comercial" title="Funil de leads" chip="+ Novo lead" />
      <div className="grid grid-cols-4 gap-2">
        {LEADS.map((c) => (
          <div key={c.col}>
            <CabecalhoColuna dot={c.dot} nome={c.col} n={c.n} />
            <div className="bg-app-muted/40 rounded-xl p-2 min-h-[150px]">
              {c.cards.map((card) => (
                <Card key={card.t} {...card} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Projetos: Gantt das disciplinas ──────────────────────────────────── */

/** Barra por status, nas cores do registry do app (Cronograma de Projetos). */
const STATUS_GANTT = {
  concluido: { nome: "Concluído", tom: "bg-status-done" },
  andamento: { nome: "Em andamento", tom: "bg-status-progress" },
  revisao: { nome: "Revisão", tom: "bg-status-review" },
  planejamento: { nome: "Planejamento", tom: "bg-status-planning" },
} as const;

const BARRAS: { label: string; left: string; width: string; status: keyof typeof STATUS_GANTT }[] = [
  { label: "Estrutural", left: "2%", width: "44%", status: "concluido" },
  { label: "Elétrico", left: "14%", width: "38%", status: "revisao" },
  { label: "Hidrossanitário", left: "22%", width: "34%", status: "andamento" },
  { label: "Climatização", left: "38%", width: "31%", status: "andamento" },
  { label: "Compatibilização", left: "62%", width: "26%", status: "planejamento" },
  { label: "Entrega final", left: "84%", width: "13%", status: "planejamento" },
];

export function GanttScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead crumb="Projetos · Cronograma" title="Cronograma das disciplinas" chip="Gantt" />
      <div className={`${PAINEL} p-3`}>
        <div className="flex justify-between text-[7.5px] uppercase tracking-wider text-ink-muted pl-[104px] mb-1">
          {["Set", "Out", "Nov", "Dez", "Jan"].map((mes) => (
            <span key={mes}>{mes}</span>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {BARRAS.map((b, i) => (
            <div key={b.label} className="grid grid-cols-[100px_1fr] gap-1.5 items-center">
              <span className="text-[9.5px] text-ink-soft truncate">{b.label}</span>
              <div className="h-[15px] bg-app-muted/50 rounded relative overflow-hidden">
                <m.span
                  className={`absolute top-0.5 h-[11px] rounded-sm origin-left ${STATUS_GANTT[b.status].tom}`}
                  style={{ left: b.left, width: b.width }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 1.1, ease: [0.22, 0.9, 0.28, 1], delay: reduced ? 0 : i * 0.09 }}
                />
                {/* Marcador de hoje, vermelho como no app. */}
                <span className="absolute inset-y-0 w-px bg-chart-danger" style={{ left: "46%" }} />
              </div>
            </div>
          ))}
        </div>

        {/* Legenda de status, a mesma do app. */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 mt-3 text-[7.5px] text-ink-muted">
          {Object.values(STATUS_GANTT).map((st) => (
            <span key={st.nome} className="flex items-center gap-1">
              <span className={`w-2.5 h-1.5 rounded-full ${st.tom}`} />
              {st.nome}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="w-px h-2 bg-chart-danger" />
            Hoje
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Obra: diário do dia, vindo do campo ──────────────────────────────── */

export function DiarioScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead crumb="Obras › Residencial Santa Rita" title="Diário de obra de hoje" chip="Veio do campo" />
      <Abas itens={ABAS_OBRA} ativa="Diário" />
      <div className="grid md:grid-cols-[1.15fr_1fr] gap-3">
        <div className="bg-white border border-black/5 rounded-2xl p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Registro do dia</p>
          {[
            ["Clima", "Nublado"],
            ["Efetivo em obra", "14"],
            ["Alvenaria 3º pav.", "62 m²"],
            ["Ocorrências", "1"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between text-[9.5px] text-ink-soft py-1 border-b border-black/5 last:border-0"
            >
              <span>{k}</span>
              <span className="text-ink tabular-nums">{v}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 mt-2 text-[8px] uppercase tracking-wider text-positive-strong">
            <span className="w-1.5 h-1.5 rounded-full bg-positive" />
            Sincronizado do celular
          </div>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Fotos do canteiro</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <m.span
                key={i}
                className="aspect-square rounded bg-app-muted block"
                initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: reduced ? 0 : i * 0.14 }}
              />
            ))}
          </div>
          {[
            ["Frente", "Estrutura"],
            ["Tarefa marcada", "Concluída"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between text-[9.5px] text-ink-soft py-1 border-b border-black/5 last:border-0 mt-2 first:mt-2"
            >
              <span>{k}</span>
              <span className="text-ink">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Portal: o que o cliente vê pelo link, só leitura ─────────────────── */

const DISCIPLINAS_PORTAL = [
  { nome: "Estrutural", pct: 100 },
  { nome: "Elétrico", pct: 100 },
  { nome: "Climatização", pct: 45 },
];

const PARCELAS_PORTAL = [
  { nome: "Parcela 1", valor: "R$ 42.800", status: "Paga", paga: true },
  { nome: "Parcela 2", valor: "R$ 42.800", status: "Em aberto" },
  { nome: "Parcela 3", valor: "R$ 42.800", status: "Dezembro" },
];

export function PortalScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead
        crumb="Portal do cliente · Só leitura"
        title="Centro cirúrgico, Santa Rita"
        chip="Link compartilhado"
      />
      <div className="grid md:grid-cols-2 gap-3">
        <div className="bg-white border border-black/5 rounded-2xl p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2.5">Andamento por disciplina</p>
          {DISCIPLINAS_PORTAL.map((d, i) => (
            <div key={d.nome} className="mb-2.5 last:mb-0">
              <div className="flex justify-between text-[9.5px] mb-1">
                <span className="text-ink-soft">{d.nome}</span>
                <span className="text-ink tabular-nums">{d.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-app-muted overflow-hidden">
                <m.span
                  className={`block h-full rounded-full origin-left ${d.pct === 100 ? "bg-status-done" : "bg-brand"}`}
                  style={{ width: `${d.pct}%` }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, delay: reduced ? 0 : 0.2 + i * 0.12, ease: [0.22, 0.9, 0.28, 1] }}
                />
              </div>
            </div>
          ))}
          <p className="mt-2.5 pt-2 border-t border-black/5 text-[8.5px] text-ink-muted">
            Atualizado hoje, direto do cronograma
          </p>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Parcelas do contrato</p>
          {PARCELAS_PORTAL.map((p) => (
            <div
              key={p.nome}
              className="flex items-center justify-between gap-2 py-1.5 border-b border-black/5 last:border-0"
            >
              <span className="text-[9.5px] text-ink-soft">{p.nome}</span>
              <span className="flex items-center gap-2">
                <span className="text-[9.5px] font-medium text-ink tabular-nums">{p.valor}</span>
                <span
                  className={`text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    p.paga ? CHIP.ok : CHIP.neutro
                  }`}
                >
                  {p.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Campo: o celular do encarregado, desenhado à mão em CSS ──────────── */

/**
 * Moldura de celular com a proporção de um iPhone de verdade (9:19,5), barra de
 * status, ilha e indicador de início. Antes a moldura só abraçava o conteúdo e o
 * aparelho saía quase quadrado, achatado. O miolo é uma coluna: o que vem antes
 * do `mt-auto` fica no topo e o botão de ação desce para o pé da tela, como no app.
 */
export function Celular({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto w-full max-w-[272px] ${className}`}>
      <div className="rounded-[46px] bg-ink p-[7px] shadow-[0_32px_64px_-24px_rgba(0,0,0,0.5)] ring-1 ring-black/10">
        <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[39px] bg-app">
          <div className="relative flex h-11 shrink-0 items-center justify-between px-7 pt-1 text-[10.5px] font-semibold tabular-nums text-ink">
            <span>9:41</span>
            <span className="absolute left-1/2 top-2.5 h-[22px] w-[76px] -translate-x-1/2 rounded-full bg-ink" />
            <span className="flex items-center gap-1" aria-hidden="true">
              <span className="flex items-end gap-[1.5px]">
                {[4, 6, 8, 10].map((h, i) => (
                  <span
                    key={h}
                    className={`w-[2.5px] rounded-[1px] ${i < 2 ? "bg-ink" : "bg-ink/25"}`}
                    style={{ height: h }}
                  />
                ))}
              </span>
              <span className="relative ml-0.5 h-[10px] w-[20px] rounded-[3px] border border-ink/40 p-[1.5px]">
                <span className="block h-full w-[70%] rounded-[1.5px] bg-ink" />
              </span>
            </span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-2 pt-2">{children}</div>
          <span className="mx-auto mb-2 h-[4px] w-[96px] shrink-0 rounded-full bg-ink/80" />
        </div>
      </div>
    </div>
  );
}

/** Cabeçalho das telas do Campo: obra em caixa-alta e o título do dia. */
function TopoCampo({ obra, titulo, chip }: { obra: string; titulo: string; chip?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2 pb-3">
      <div>
        <p className="text-[8px] uppercase tracking-wider text-ink-muted">{obra}</p>
        <p className="text-[15px] font-semibold tracking-tight text-ink">{titulo}</p>
      </div>
      {chip}
    </div>
  );
}

export function CampoScreen() {
  const reduced = useReducedMotion();

  return (
    <Celular>
      <TopoCampo
        obra="Obra Santa Rita"
        titulo="Diário de hoje"
        chip={
          <span className="mt-0.5 flex items-center gap-1 rounded-full bg-app-muted px-2 py-1 text-[7.5px] uppercase tracking-wider text-ink-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-chart-warning" />
            Sem sinal
          </span>
        }
      />

      <div className="mb-3 rounded-xl border border-black/5 bg-white px-3 py-1.5">
        {[
          ["Clima", "Nublado"],
          ["Efetivo em obra", "14"],
          ["Alvenaria 3º pav.", "62 m²"],
          ["Ocorrências", "1"],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex justify-between border-b border-black/5 py-1.5 text-[10.5px] text-ink-soft last:border-0"
          >
            <span>{k}</span>
            <span className="tabular-nums text-ink">{v}</span>
          </div>
        ))}
      </div>

      <p className="mb-1.5 text-[8px] uppercase tracking-wider text-ink-muted">Fotos do serviço</p>
      <div className="mb-3 grid grid-cols-3 gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <m.span
            key={i}
            className="block aspect-square rounded-lg bg-app-muted"
            initial={reduced ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: reduced ? 0 : 0.3 + i * 0.1 }}
          />
        ))}
        <span className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-black/15 text-[16px] font-light text-ink-muted">
          +
        </span>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-black/5 bg-white px-3 py-2.5">
        <span className="text-[10.5px] text-ink">Tarefa do cronograma</span>
        <span className={`rounded-full px-1.5 py-0.5 text-[7.5px] uppercase tracking-wider ${CHIP.ok}`}>Concluída</span>
      </div>

      <div className="mt-auto pt-3">
        <span className="flex h-10 w-full items-center justify-center rounded-full bg-brand text-[12.5px] font-medium text-ink">
          Enviar o dia
        </span>
        <m.p
          className="mt-2 text-center text-[8.5px] text-ink-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: reduced ? 0 : 0.9 }}
        >
          Fica no aparelho e sobe sozinho quando o sinal voltar
        </m.p>
      </div>
    </Celular>
  );
}

/* ── Telas por grupo de funcionalidade ────────────────────────────────────
   Cada grupo da página de módulo mostra uma tela diferente: repetir o mesmo
   desenho três vezes dizia "isso é enfeite", não "isso é o produto". */

/** Gestão · financeiro: o extrato importado com a categoria sugerida pela IA. */
export function FinanceiroScreen() {
  const linhas = [
    { desc: "PIX recebido, VRZ Engenharia", cat: "Receita de projeto", valor: "+ R$ 42.800", entrada: true },
    { desc: "Sempre Engenharia LTDA 03/12", cat: "Projetos contratados", valor: "- R$ 7.400" },
    { desc: "Posto Ipiranga", cat: "Deslocamento", valor: "- R$ 380" },
  ];
  return (
    <div>
      <ScreenHead crumb="Gestão · Financeiro" title="Extrato importado" chip="Lido por IA" />
      <div className="bg-white border border-black/5 rounded-2xl p-3">
        {linhas.map((l) => (
          <div
            key={l.desc}
            className="flex items-center justify-between gap-2 py-1.5 border-b border-black/5 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-[9.5px] text-ink truncate">{l.desc}</p>
              <span className="inline-block mt-0.5 text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-app-muted text-ink-muted">
                {l.cat}
              </span>
            </div>
            <span
              className={`text-[9.5px] font-medium tabular-nums shrink-0 ${l.entrada ? "text-positive-strong" : "text-ink"}`}
            >
              {l.valor}
            </span>
          </div>
        ))}
        <p className="mt-2 text-[8px] text-ink-muted">3 lançamentos prontos · revise e aprove</p>
      </div>
    </div>
  );
}

/** Gestão · fechamento: a folha da competência com comprovante por pessoa. */
export function FolhaScreen() {
  const pessoas = [
    { nome: "Ana Beatriz", papel: "Estrutural · 3 projetos", valor: "R$ 6.200" },
    { nome: "Carlos Mota", papel: "Elétrico · 2 projetos", valor: "R$ 5.400" },
    { nome: "Juliana Reis", papel: "Hidro · 4 projetos", valor: "R$ 5.900" },
  ];
  return (
    <div>
      <ScreenHead crumb="Gestão · Folha" title="Competência de agosto" chip="Fechada" />
      <div className="bg-white border border-black/5 rounded-2xl p-3">
        {pessoas.map((p) => (
          <div
            key={p.nome}
            className="flex items-center justify-between gap-2 py-1.5 border-b border-black/5 last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-full bg-app-muted shrink-0" />
              <div className="min-w-0">
                <p className="text-[9.5px] font-medium text-ink truncate">{p.nome}</p>
                <p className="text-[8px] text-ink-muted truncate">{p.papel}</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-medium tabular-nums text-ink">{p.valor}</span>
              <span className="text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success-soft text-success-strong">
                PDF enviado
              </span>
            </span>
          </div>
        ))}
        <div className="flex justify-between mt-2 pt-1.5 border-t border-black/5 text-[9px]">
          <span className="text-ink-muted">Total da competência</span>
          <span className="font-semibold tabular-nums text-ink">R$ 17.500</span>
        </div>
      </div>
    </div>
  );
}

/** Projetos · quadro: colunas definidas pelo escritório. */
export function QuadroScreen() {
  const colunas = [
    {
      col: "Em estudo",
      n: 2,
      dot: "bg-status-planning",
      cards: [{ t: "Galpão logístico", d: "2 disciplinas", pct: 10 }],
    },
    {
      col: "Em projeto",
      n: 4,
      dot: "bg-status-progress",
      cards: [{ t: "Centro cirúrgico", d: "5 disciplinas", pct: 72 }],
    },
    {
      col: "Compatibilização",
      n: 1,
      dot: "bg-status-review",
      cards: [{ t: "Retrofit elétrico", d: "3 disciplinas", pct: 90 }],
    },
    { col: "Entregue", n: 7, dot: "bg-status-done", cards: [{ t: "Fotovoltaico", d: "1 disciplina", pct: 100 }] },
  ];
  return (
    <div>
      <ScreenHead crumb="Projetos · Quadro" title="Carteira por status" chip="Suas colunas" />
      <div className="grid grid-cols-4 gap-2">
        {colunas.map((c) => (
          <div key={c.col}>
            <CabecalhoColuna dot={c.dot} nome={c.col} n={c.n} />
            <div className="bg-app-muted/40 rounded-xl p-2 min-h-[128px]">
              {c.cards.map((card) => (
                <div key={card.t} className="bg-white border border-app-border rounded-lg p-2 shadow-sm">
                  <p className="text-[9px] leading-tight font-medium text-ink mb-1">{card.t}</p>
                  <p className="text-[7.5px] text-ink-muted mb-1.5">{card.d}</p>
                  {/* Barra de progresso do card: preta no quadro do app. */}
                  <span className="block h-[3px] rounded-full bg-app-muted overflow-hidden">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${card.pct}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Projetos · contrato: parcelas com status, na aba do projeto. */
export function ParcelasScreen() {
  const parcelas = [
    { nome: "Parcela 1 · Entrada", valor: "R$ 53.500", status: "Recebida", ok: true },
    { nome: "Parcela 2 · Anteprojeto", valor: "R$ 53.500", status: "Recebida", ok: true },
    { nome: "Parcela 3 · Executivo", valor: "R$ 53.500", status: "Em aberto" },
    { nome: "Parcela 4 · Entrega", valor: "R$ 53.500", status: "Dezembro" },
  ];
  return (
    <div>
      <ScreenHead crumb="Projetos › Centro cirúrgico" title="Parcelas do contrato" chip="R$ 214.000" />
      <Abas itens={ABAS_PROJETO} ativa="Pagamentos" />
      <div className="bg-white border border-black/5 rounded-2xl p-3">
        {parcelas.map((p) => (
          <div
            key={p.nome}
            className="flex items-center justify-between gap-2 py-1.5 border-b border-black/5 last:border-0"
          >
            <span className="text-[9.5px] text-ink-soft truncate">{p.nome}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-medium tabular-nums text-ink">{p.valor}</span>
              <span
                className={`text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  p.ok ? CHIP.ok : CHIP.neutro
                }`}
              >
                {p.status}
              </span>
            </span>
          </div>
        ))}
        <div className="flex justify-between mt-2 pt-1.5 border-t border-black/5 text-[8.5px] text-ink-muted">
          <span>
            Recebido <span className="font-medium text-ink tabular-nums">R$ 107.000</span>
          </span>
          <span>
            Pendente <span className="font-medium text-ink tabular-nums">R$ 107.000</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Obra · suprimentos: cotação comparada, com a vencedora eleita. */
export function CotacaoScreen() {
  const propostas = [
    { loja: "Aço Forte", prazo: "5 dias", total: "R$ 18.740", vence: true },
    { loja: "Casa do Construtor", prazo: "2 dias", total: "R$ 19.980" },
    { loja: "Depósito São José", prazo: "8 dias", total: "R$ 18.320" },
  ];
  return (
    <div>
      <ScreenHead
        crumb="Obras › Residencial Santa Rita"
        title="Cotação: cesta de aço e cimento"
        chip="3 fornecedores"
      />
      <Abas itens={ABAS_OBRA} ativa="Cotações" />
      <div className="bg-white border border-black/5 rounded-2xl p-3">
        <div className="grid grid-cols-[1fr_60px_70px_58px] gap-1 text-[7.5px] uppercase tracking-wider text-ink-muted pb-1.5 border-b border-black/5">
          <span>Fornecedor</span>
          <span>Prazo</span>
          <span className="text-right">Total</span>
          <span />
        </div>
        {propostas.map((p) => (
          <div
            key={p.loja}
            className="grid grid-cols-[1fr_60px_70px_58px] gap-1 items-center py-1.5 border-b border-black/5 last:border-0"
          >
            <span className="text-[9.5px] text-ink truncate">{p.loja}</span>
            <span className="text-[9px] text-ink-muted">{p.prazo}</span>
            <span className="text-[9.5px] font-medium tabular-nums text-ink text-right">{p.total}</span>
            <span className="text-right">
              {p.vence && (
                <span className="text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success-soft text-success-strong">
                  Vencedora
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Obra · conta da obra: aporte, despesa, taxa e o saldo. */
export function ContaObraScreen() {
  const linhas = [
    { k: "Aportes do cliente", v: "R$ 120.000" },
    { k: "Despesas com comprovante", v: "R$ 74.300" },
    { k: "Taxa de administração (12%)", v: "R$ 8.916" },
  ];
  return (
    <div>
      <ScreenHead crumb="Obras › Residencial Santa Rita" title="Conta da obra" chip="Prestação de contas" />
      <Abas itens={ABAS_OBRA} ativa="Conta da obra" />
      <div className="grid md:grid-cols-[1fr_120px] gap-3">
        <div className="bg-white border border-black/5 rounded-2xl p-3">
          {linhas.map((l) => (
            <div
              key={l.k}
              className="flex justify-between text-[9.5px] text-ink-soft py-1.5 border-b border-black/5 last:border-0"
            >
              <span>{l.k}</span>
              <span className="text-ink font-medium tabular-nums">{l.v}</span>
            </div>
          ))}
        </div>
        <div className="bg-white border border-black/5 rounded-2xl p-3 flex flex-col items-start justify-center">
          <p className="text-[7.5px] uppercase tracking-wider text-ink-muted mb-1">Saldo em conta</p>
          <p className="text-[16px] font-semibold tabular-nums text-ink leading-none">R$ 45.700</p>
          <p className="mt-1.5 text-[8px] text-positive-strong">Atualizado a cada lançamento</p>
        </div>
      </div>
    </div>
  );
}

/** Portal · visão de obra: a prestação de contas que o cliente abre sozinho. */
export function PortalObraScreen() {
  const linhas = [
    { k: "Aporte de 05/08", v: "R$ 40.000", chip: "Recebido" },
    { k: "Concreto usinado", v: "R$ 12.400", chip: "Comprovante" },
    { k: "Locação de grua", v: "R$ 6.800", chip: "Comprovante" },
  ];
  return (
    <div>
      <ScreenHead crumb="Portal do cliente · Obra" title="Prestação de contas" chip="Só leitura" />
      <div className="bg-white border border-black/5 rounded-2xl p-3">
        {linhas.map((l) => (
          <div
            key={l.k}
            className="flex items-center justify-between gap-2 py-1.5 border-b border-black/5 last:border-0"
          >
            <span className="text-[9.5px] text-ink-soft truncate">{l.k}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-medium tabular-nums text-ink">{l.v}</span>
              <span className="text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-app-muted text-ink-muted">
                {l.chip}
              </span>
            </span>
          </div>
        ))}
        <div className="flex justify-between mt-2 pt-1.5 border-t border-black/5 text-[9px]">
          <span className="text-ink-muted">Saldo da obra</span>
          <span className="font-semibold tabular-nums text-ink">R$ 45.700</span>
        </div>
      </div>
    </div>
  );
}

/** Campo · tarefas da frente: o encarregado marca o que andou. */
export function CampoTarefasScreen() {
  const tarefas = [
    { t: "Armadura da viga V3", status: "Concluída", ok: true },
    { t: "Forma do pilar P12", status: "62 m² hoje", ok: true },
    { t: "Escoramento laje L4", status: "Concluída", ok: true },
    { t: "Concretagem 3º pav.", status: "Parada: chuva" },
    { t: "Desforma 2º pav.", status: "Amanhã" },
  ];
  const feitas = tarefas.filter((t) => t.ok).length;

  return (
    <Celular>
      <TopoCampo obra="Frente Estrutura" titulo="Tarefas de hoje" />

      <div className="mb-3 rounded-xl border border-black/5 bg-white px-3 py-2.5">
        <div className="mb-1.5 flex justify-between text-[10px]">
          <span className="text-ink-soft">Avanço do dia</span>
          <span className="tabular-nums text-ink">
            {feitas} de {tarefas.length}
          </span>
        </div>
        <span className="block h-1.5 overflow-hidden rounded-full bg-app-muted">
          <span
            className="block h-full rounded-full bg-brand"
            style={{ width: `${(feitas / tarefas.length) * 100}%` }}
          />
        </span>
      </div>

      {tarefas.map((t) => (
        <div
          key={t.t}
          className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-black/5 bg-white px-3 py-2.5"
        >
          <span className="truncate text-[10.5px] text-ink">{t.t}</span>
          <span
            className={`shrink-0 rounded-full px-1.5 py-0.5 text-[7.5px] uppercase tracking-wider ${
              t.ok ? CHIP.ok : CHIP.neutro
            }`}
          >
            {t.status}
          </span>
        </div>
      ))}

      <div className="mt-auto pt-3">
        <span className="flex h-10 w-full items-center justify-center rounded-full bg-brand text-[12.5px] font-medium text-ink">
          Enviar pro escritório
        </span>
      </div>
    </Celular>
  );
}

/* ── Compartilhado ────────────────────────────────────────────────────── */

function ScreenHead({ crumb, title, chip }: { crumb: string; title: string; chip: string }) {
  return (
    <div className="flex justify-between items-start gap-3 mb-4">
      <div>
        <p className="text-[8.5px] uppercase tracking-widest text-ink-muted mb-1">{crumb}</p>
        <p className="text-[14.5px] font-medium text-ink tracking-tight">{title}</p>
      </div>
      <span className="text-[9.5px] px-2.5 py-1 rounded-full bg-brand text-ink-on-brand font-semibold shrink-0">
        {chip}
      </span>
    </div>
  );
}

export function ModuleScreen({ slug }: { slug: ModuloSlug }) {
  if (slug === "gestao") return <KanbanScreen />;
  if (slug === "projetos") return <GanttScreen />;
  if (slug === "portal") return <PortalScreen />;
  if (slug === "campo") return <CampoScreen />;
  return <DiarioScreen />;
}

/**
 * Tela vetorial de um grupo de funcionalidade, enquanto o print real não
 * existe. Os mocks de Campo já vêm com a moldura de celular; os demais são
 * miolo de tela, pra página envolver no BrowserFrame.
 */
export function GroupMock({ mock }: { mock: MockNome }) {
  switch (mock) {
    case "kanban":
      return <KanbanScreen />;
    case "financeiro":
      return <FinanceiroScreen />;
    case "folha":
      return <FolhaScreen />;
    case "quadro":
      return <QuadroScreen />;
    case "gantt":
      return <GanttScreen />;
    case "parcelas":
      return <ParcelasScreen />;
    case "diario":
      return <DiarioScreen />;
    case "cotacao":
      return <CotacaoScreen />;
    case "conta-obra":
      return <ContaObraScreen />;
    case "portal-projeto":
      return <PortalScreen />;
    case "portal-obra":
      return <PortalObraScreen />;
    case "campo-diario":
      return <CampoScreen />;
    case "campo-tarefas":
      return <CampoTarefasScreen />;
  }
}
