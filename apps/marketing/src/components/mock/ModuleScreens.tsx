/**
 * Telas de produto desenhadas em vetor, uma por módulo. Substituem o print
 * estático: nada aqui é imagem, então não corta, não pixela e não desatualiza
 * junto com a UI real. Toda animação respeita `prefers-reduced-motion`.
 */
import { m, useReducedMotion } from "framer-motion";
import type { MockNome, ModuloSlug } from "../../lib/modules";

/* ── Gestão: funil de leads, com um card trocando de coluna ───────────── */

const LEADS = [
  { col: "Em contato", n: 4, cards: [{ t: "Retrofit elétrico, hospital", v: "R$ 84.000" }] },
  { col: "Proposta", n: 3, cards: [{ t: "Climatização, centro cirúrgico", v: "R$ 128.400" }] },
  { col: "Negociação", n: 2, cards: [{ t: "Fotovoltaico, condomínio", v: "R$ 71.200" }] },
  { col: "Ganho", n: 6, cards: [{ t: "Gases medicinais, clínica", v: "R$ 58.000" }] },
];

function Card({ t, v, className = "" }: { t: string; v: string; className?: string }) {
  return (
    <div className={`bg-white border border-paper-border/60 rounded-md p-2 shadow-sm ${className}`}>
      <p className="text-[9.5px] leading-tight font-medium text-ink mb-1.5">{t}</p>
      <div className="flex items-center gap-1.5">
        <span className="w-3 h-3 rounded-full bg-paper-border shrink-0" />
        <span className="text-[8px] text-ink-muted tabular-nums">{v}</span>
      </div>
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
          <div key={c.col} className="bg-paper-alt rounded-lg p-2 min-h-[168px]">
            <div className="flex justify-between text-[8px] uppercase tracking-wider text-ink-muted mb-2">
              <span>{c.col}</span>
              <span>{c.n}</span>
            </div>

            {c.cards.map((card) => (
              <Card key={card.t} {...card} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Projetos: Gantt das disciplinas ──────────────────────────────────── */

const BARRAS = [
  { label: "Estrutural", left: "2%", width: "44%", tone: "bg-modulo-projetos-strong" },
  { label: "Elétrico", left: "14%", width: "38%", tone: "bg-modulo-projetos-strong" },
  { label: "Hidrossanitário", left: "22%", width: "34%", tone: "bg-modulo-gestao-strong" },
  { label: "Climatização", left: "38%", width: "31%", tone: "bg-modulo-obra-strong" },
  { label: "Compatibilização", left: "62%", width: "26%", tone: "bg-paper-border" },
  { label: "Entrega final", left: "84%", width: "13%", tone: "bg-paper-border" },
];

export function GanttScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead crumb="Projetos · Carteira" title="Cronograma das disciplinas" chip="Gantt" />
      <div className="flex justify-between text-[7.5px] uppercase tracking-wider text-ink-muted pl-[104px] mb-1">
        {["Set", "Out", "Nov", "Dez", "Jan"].map((mes) => (
          <span key={mes}>{mes}</span>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        {BARRAS.map((b, i) => (
          <div key={b.label} className="grid grid-cols-[100px_1fr] gap-1.5 items-center">
            <span className="text-[9.5px] text-ink-soft truncate">{b.label}</span>
            <div className="h-[15px] bg-paper-alt rounded relative overflow-hidden">
              <m.span
                className={`absolute top-0.5 h-[11px] rounded-sm origin-left ${b.tone}`}
                style={{ left: b.left, width: b.width }}
                initial={reduced ? false : { scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 1.1, ease: [0.22, 0.9, 0.28, 1], delay: reduced ? 0 : i * 0.09 }}
              />
              <span className="absolute inset-y-0 w-px bg-ink/30" style={{ left: "46%" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Obra: diário do dia, vindo do campo ──────────────────────────────── */

export function DiarioScreen() {
  const reduced = useReducedMotion();

  return (
    <div>
      <ScreenHead crumb="Obra · Diário" title="Diário de obra de hoje" chip="Veio do campo" />
      <div className="grid md:grid-cols-[1.15fr_1fr] gap-3">
        <div className="bg-paper-alt rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Registro do dia</p>
          {[
            ["Clima", "Nublado"],
            ["Efetivo em obra", "14"],
            ["Alvenaria 3º pav.", "62 m²"],
            ["Ocorrências", "1"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between text-[9.5px] text-ink-soft py-1 border-b border-paper-border/50 last:border-0"
            >
              <span>{k}</span>
              <span className="text-ink tabular-nums">{v}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5 mt-2 text-[8px] uppercase tracking-wider text-modulo-gestao-strong">
            <span className="w-1.5 h-1.5 rounded-full bg-modulo-gestao-strong" />
            Sincronizado do celular
          </div>
        </div>

        <div className="bg-paper-alt rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Fotos do canteiro</p>
          <div className="grid grid-cols-3 gap-1.5">
            {[0, 1, 2].map((i) => (
              <m.span
                key={i}
                className="aspect-square rounded bg-gradient-to-br from-paper-border to-paper-alt block"
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
              className="flex justify-between text-[9.5px] text-ink-soft py-1 border-b border-paper-border/50 last:border-0 mt-2 first:mt-2"
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
        <div className="bg-paper-alt rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2.5">Andamento por disciplina</p>
          {DISCIPLINAS_PORTAL.map((d, i) => (
            <div key={d.nome} className="mb-2.5 last:mb-0">
              <div className="flex justify-between text-[9.5px] mb-1">
                <span className="text-ink-soft">{d.nome}</span>
                <span className="text-ink tabular-nums">{d.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-paper-border/50 overflow-hidden">
                <m.span
                  className={`block h-full rounded-full origin-left ${d.pct === 100 ? "bg-ink" : "bg-brand"}`}
                  style={{ width: `${d.pct}%` }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.9, delay: reduced ? 0 : 0.2 + i * 0.12, ease: [0.22, 0.9, 0.28, 1] }}
                />
              </div>
            </div>
          ))}
          <p className="mt-2.5 pt-2 border-t border-paper-border/50 text-[8.5px] text-ink-muted">
            Atualizado hoje, direto do cronograma
          </p>
        </div>

        <div className="bg-paper-alt rounded-lg p-3">
          <p className="text-[8px] uppercase tracking-wider text-ink-muted mb-2">Parcelas do contrato</p>
          {PARCELAS_PORTAL.map((p) => (
            <div
              key={p.nome}
              className="flex items-center justify-between gap-2 py-1.5 border-b border-paper-border/50 last:border-0"
            >
              <span className="text-[9.5px] text-ink-soft">{p.nome}</span>
              <span className="flex items-center gap-2">
                <span className="text-[9.5px] font-medium text-ink tabular-nums">{p.valor}</span>
                <span
                  className={`text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    p.paga ? "bg-brand text-ink" : "bg-paper-border/60 text-ink-muted"
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

export function CampoScreen() {
  const reduced = useReducedMotion();

  return (
    <div className="mx-auto w-[300px]">
      <div className="rounded-[36px] border-[3px] border-ink bg-ink shadow-[0_28px_56px_-20px_rgba(0,0,0,0.45)]">
        <div className="relative overflow-hidden rounded-[32px] bg-frame">
          <span className="absolute left-1/2 top-3.5 h-6 w-20 -translate-x-1/2 rounded-full bg-ink" />

          <div className="px-4 pb-6 pt-12">
            <div className="flex items-center justify-between pb-3">
              <div>
                <p className="text-[8px] uppercase tracking-wider text-ink-muted">Obra Santa Rita</p>
                <p className="text-[13px] font-semibold tracking-tight text-ink">Diário de hoje</p>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-paper-alt px-2 py-1 text-[7.5px] uppercase tracking-wider text-ink-muted">
                <span className="h-1.5 w-1.5 rounded-full bg-chart-warning" />
                Sem sinal
              </span>
            </div>

            <div className="rounded-lg bg-paper-alt p-2.5 mb-2.5">
              {[
                ["Clima", "Nublado"],
                ["Efetivo em obra", "14"],
                ["Alvenaria 3º pav.", "62 m²"],
              ].map(([k, v]) => (
                <div
                  key={k}
                  className="flex justify-between text-[10px] text-ink-soft py-1 border-b border-paper-border/50 last:border-0"
                >
                  <span>{k}</span>
                  <span className="text-ink tabular-nums">{v}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5 mb-2.5">
              {[0, 1, 2].map((i) => (
                <m.span
                  key={i}
                  className="aspect-square rounded-md bg-gradient-to-br from-paper-border to-paper-alt block"
                  initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: reduced ? 0 : 0.3 + i * 0.12 }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between rounded-lg bg-paper-alt px-2.5 py-2 mb-3">
              <span className="text-[10px] text-ink">Tarefa do cronograma</span>
              <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand text-ink">
                Concluída
              </span>
            </div>

            <span className="flex h-9 w-full items-center justify-center rounded-full bg-brand text-[12px] font-medium text-ink">
              Enviar o dia
            </span>
            <m.p
              className="mt-2 text-center text-[8px] text-ink-muted"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: reduced ? 0 : 0.9 }}
            >
              Fica no aparelho e sobe sozinho quando o sinal voltar
            </m.p>
          </div>
        </div>
      </div>
    </div>
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
      <div className="bg-paper-alt rounded-lg p-3">
        {linhas.map((l) => (
          <div
            key={l.desc}
            className="flex items-center justify-between gap-2 py-1.5 border-b border-paper-border/50 last:border-0"
          >
            <div className="min-w-0">
              <p className="text-[9.5px] text-ink truncate">{l.desc}</p>
              <span className="inline-block mt-0.5 text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white border border-paper-border/60 text-ink-muted">
                {l.cat}
              </span>
            </div>
            <span
              className={`text-[9.5px] font-medium tabular-nums shrink-0 ${l.entrada ? "text-modulo-gestao-strong" : "text-ink"}`}
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
      <div className="bg-paper-alt rounded-lg p-3">
        {pessoas.map((p) => (
          <div
            key={p.nome}
            className="flex items-center justify-between gap-2 py-1.5 border-b border-paper-border/50 last:border-0"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-full bg-paper-border shrink-0" />
              <div className="min-w-0">
                <p className="text-[9.5px] font-medium text-ink truncate">{p.nome}</p>
                <p className="text-[8px] text-ink-muted truncate">{p.papel}</p>
              </div>
            </div>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-medium tabular-nums text-ink">{p.valor}</span>
              <span className="text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand text-ink-on-brand">
                PDF enviado
              </span>
            </span>
          </div>
        ))}
        <div className="flex justify-between mt-2 pt-1.5 border-t border-paper-border/50 text-[9px]">
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
    { col: "Em estudo", n: 2, cards: [{ t: "Galpão logístico", d: "2 disciplinas" }] },
    { col: "Em projeto", n: 4, cards: [{ t: "Centro cirúrgico", d: "5 disciplinas" }] },
    { col: "Compatibilização", n: 1, cards: [{ t: "Retrofit elétrico", d: "3 disciplinas" }] },
    { col: "Entregue", n: 7, cards: [{ t: "Fotovoltaico", d: "1 disciplina" }] },
  ];
  return (
    <div>
      <ScreenHead crumb="Projetos · Quadro" title="Carteira por status" chip="Suas colunas" />
      <div className="grid grid-cols-4 gap-2">
        {colunas.map((c) => (
          <div key={c.col} className="bg-paper-alt rounded-lg p-2 min-h-[140px]">
            <div className="flex justify-between text-[7.5px] uppercase tracking-wider text-ink-muted mb-2">
              <span className="truncate">{c.col}</span>
              <span>{c.n}</span>
            </div>
            {c.cards.map((card) => (
              <div key={card.t} className="bg-white border border-paper-border/60 rounded-md p-2 shadow-sm">
                <p className="text-[9px] leading-tight font-medium text-ink mb-1">{card.t}</p>
                <p className="text-[7.5px] text-ink-muted">{card.d}</p>
              </div>
            ))}
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
      <ScreenHead crumb="Projetos · Centro cirúrgico" title="Parcelas do contrato" chip="R$ 214.000" />
      <div className="bg-paper-alt rounded-lg p-3">
        {parcelas.map((p) => (
          <div
            key={p.nome}
            className="flex items-center justify-between gap-2 py-1.5 border-b border-paper-border/50 last:border-0"
          >
            <span className="text-[9.5px] text-ink-soft truncate">{p.nome}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-medium tabular-nums text-ink">{p.valor}</span>
              <span
                className={`text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  p.ok ? "bg-brand text-ink-on-brand" : "bg-paper-border/60 text-ink-muted"
                }`}
              >
                {p.status}
              </span>
            </span>
          </div>
        ))}
        <div className="flex justify-between mt-2 pt-1.5 border-t border-paper-border/50 text-[8.5px] text-ink-muted">
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
      <ScreenHead crumb="Obra · Suprimentos" title="Cotação: cesta de aço e cimento" chip="3 fornecedores" />
      <div className="bg-paper-alt rounded-lg p-3">
        <div className="grid grid-cols-[1fr_60px_70px_58px] gap-1 text-[7.5px] uppercase tracking-wider text-ink-muted pb-1.5 border-b border-paper-border/50">
          <span>Fornecedor</span>
          <span>Prazo</span>
          <span className="text-right">Total</span>
          <span />
        </div>
        {propostas.map((p) => (
          <div
            key={p.loja}
            className="grid grid-cols-[1fr_60px_70px_58px] gap-1 items-center py-1.5 border-b border-paper-border/50 last:border-0"
          >
            <span className="text-[9.5px] text-ink truncate">{p.loja}</span>
            <span className="text-[9px] text-ink-muted">{p.prazo}</span>
            <span className="text-[9.5px] font-medium tabular-nums text-ink text-right">{p.total}</span>
            <span className="text-right">
              {p.vence && (
                <span className="text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-brand text-ink-on-brand">
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
      <ScreenHead crumb="Obra · Conta da obra" title="Residencial Santa Rita" chip="Prestação de contas" />
      <div className="grid md:grid-cols-[1fr_120px] gap-3">
        <div className="bg-paper-alt rounded-lg p-3">
          {linhas.map((l) => (
            <div
              key={l.k}
              className="flex justify-between text-[9.5px] text-ink-soft py-1.5 border-b border-paper-border/50 last:border-0"
            >
              <span>{l.k}</span>
              <span className="text-ink font-medium tabular-nums">{l.v}</span>
            </div>
          ))}
        </div>
        <div className="bg-paper-alt rounded-lg p-3 flex flex-col items-start justify-center">
          <p className="text-[7.5px] uppercase tracking-wider text-ink-muted mb-1">Saldo em conta</p>
          <p className="text-[16px] font-semibold tabular-nums text-ink leading-none">R$ 45.700</p>
          <p className="mt-1.5 text-[8px] text-modulo-gestao-strong">Atualizado a cada lançamento</p>
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
      <div className="bg-paper-alt rounded-lg p-3">
        {linhas.map((l) => (
          <div
            key={l.k}
            className="flex items-center justify-between gap-2 py-1.5 border-b border-paper-border/50 last:border-0"
          >
            <span className="text-[9.5px] text-ink-soft truncate">{l.k}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9.5px] font-medium tabular-nums text-ink">{l.v}</span>
              <span className="text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white border border-paper-border/60 text-ink-muted">
                {l.chip}
              </span>
            </span>
          </div>
        ))}
        <div className="flex justify-between mt-2 pt-1.5 border-t border-paper-border/50 text-[9px]">
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
    { t: "Concretagem 3º pav.", status: "Parada: chuva" },
  ];
  return (
    <div className="mx-auto w-[300px]">
      <div className="rounded-[36px] border-[3px] border-ink bg-ink shadow-[0_28px_56px_-20px_rgba(0,0,0,0.45)]">
        <div className="relative overflow-hidden rounded-[32px] bg-frame">
          <span className="absolute left-1/2 top-3.5 h-6 w-20 -translate-x-1/2 rounded-full bg-ink" />
          <div className="px-4 pb-6 pt-12">
            <div className="pb-3">
              <p className="text-[8px] uppercase tracking-wider text-ink-muted">Frente Estrutura</p>
              <p className="text-[13px] font-semibold tracking-tight text-ink">Tarefas de hoje</p>
            </div>
            {tarefas.map((t) => (
              <div
                key={t.t}
                className="flex items-center justify-between gap-2 rounded-lg bg-paper-alt px-2.5 py-2.5 mb-2"
              >
                <span className="text-[10px] text-ink truncate">{t.t}</span>
                <span
                  className={`text-[7.5px] uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 ${
                    t.ok ? "bg-brand text-ink-on-brand" : "bg-paper-border/60 text-ink-muted"
                  }`}
                >
                  {t.status}
                </span>
              </div>
            ))}
            <span className="mt-1 flex h-9 w-full items-center justify-center rounded-full bg-brand text-[12px] font-medium text-ink">
              Enviar pro escritório
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Compartilhado ────────────────────────────────────────────────────── */

function ScreenHead({ crumb, title, chip }: { crumb: string; title: string; chip: string }) {
  return (
    <div className="flex justify-between items-start gap-3 mb-4">
      <div>
        <p className="text-[8.5px] uppercase tracking-[0.1em] text-ink-muted mb-1">{crumb}</p>
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
