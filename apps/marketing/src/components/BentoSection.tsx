import { Link } from "react-router-dom";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, WifiOff } from "lucide-react";
import { Reveal } from "./Reveal";
import { EASE } from "../lib/motion";

/**
 * Bento dos módulos, no formato da referência: cada cartão tem uma composição
 * própria (celular, gantt, colunas, canteiro escuro, link do portal), não uma
 * anatomia repetida com o gráfico trocado. A variedade de forma é o que faz o
 * conjunto parecer produto, não template.
 *
 * A navegação de cada cartão é a seta redonda na linha do título, não um link
 * no rodapé: o rodapé custava uma fileira inteira só pro botão, e a meta da
 * seção é caber numa tela.
 */

const VISTA = { once: true, amount: 0.35 } as const;

/**
 * Cabeçalho comum dos cartões: rótulo, título, legenda à esquerda e a seta de
 * navegação à direita, na mesma linha. O que varia entre os cartões é o corpo,
 * nunca este topo, senão o visitante reaprende a navegar a cada cartão.
 */
function CabecalhoCartao({
  rotulo,
  titulo,
  legenda,
  href,
  escuro,
}: {
  rotulo: string;
  titulo: string;
  legenda: string;
  href: string;
  escuro?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className={`mb-1.5 text-[10px] uppercase tracking-[0.16em] ${escuro ? "text-white/45" : "text-ink/50"}`}>
          {rotulo}
        </p>
        <h3
          className={`mb-1.5 text-[20px] md:text-[22px] font-medium tracking-[-0.025em] leading-[1.15] ${
            escuro ? "text-white" : "text-ink"
          }`}
        >
          {titulo}
        </h3>
        <p className={`text-[12.5px] leading-snug ${escuro ? "text-white/55" : "text-ink/60"}`}>{legenda}</p>
      </div>
      <Link
        to={href}
        aria-label={`Ver ${rotulo}`}
        className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
          escuro
            ? "border-white/20 text-white hover:bg-white hover:text-ink"
            : "border-ink/15 text-ink hover:bg-ink hover:text-white"
        }`}
      >
        <ArrowRight className="h-4 w-4" strokeWidth={1.9} />
      </Link>
    </div>
  );
}

/**
 * Cartão 1: Gestão, o herói do bento, no verde cheio.
 *
 * O celular é desenhado à mão em CSS (sem lib de mockup) e sangra a borda de
 * baixo do cartão, no truque da referência: o aparelho tem 600px de altura mas
 * o cartão corta ele onde acabar, então ele parece grande sem esticar a seção.
 * A tela conta a história do módulo de cima pra baixo: leads, o ganho, e o
 * financeiro que recebe o dinheiro, com o cartão "Fechado" flutuando por cima.
 */
function CartaoGestao() {
  const reducedMotion = useReducedMotion();
  const leads = [
    { nome: "Retrofit elétrico", valor: "84.000", etapa: "Em contato", dot: "bg-pipeline-contato" },
    { nome: "Centro cirúrgico", valor: "128.400", etapa: "Ganho", dot: "bg-status-done", ganho: true },
    { nome: "Fotovoltaico", valor: "71.200", etapa: "Negociação", dot: "bg-brand" },
  ];
  const financeiro = [
    { label: "Receitas", valor: "R$ 96.400", pct: 0.9, tom: "bg-brand" },
    { label: "Despesas", valor: "R$ 61.200", pct: 0.57, tom: "bg-ink/25" },
  ];

  return (
    <Reveal variant="scale" className="h-full">
      <div className="relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-[26px] bg-card-brand p-7">
        <CabecalhoCartao
          rotulo="Gestão"
          titulo="Do lead ao dinheiro na conta"
          legenda="Funil, proposta, contrato e financeiro no mesmo fluxo."
          href="/gestao"
        />

        <div className="relative mt-7 flex-1">
          <div className="absolute left-1/2 top-0 w-[290px] -translate-x-1/2">
            <div className="rounded-[36px] border-[3px] border-ink bg-ink shadow-[0_24px_48px_-18px_rgba(0,0,0,0.4)]">
              <div className="relative h-[600px] overflow-hidden rounded-[32px] bg-frame">
                <span className="absolute left-1/2 top-3.5 h-6 w-20 -translate-x-1/2 rounded-full bg-ink" />

                <div className="px-4 pt-12">
                  <div className="flex items-center justify-between pb-3">
                    <span className="text-[13px] font-semibold tracking-tight text-ink">Leads</span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] font-semibold leading-none text-ink">
                      +
                    </span>
                  </div>

                  {leads.map((c, i) => (
                    <m.div
                      key={c.nome}
                      className={`relative mb-2.5 overflow-hidden rounded-lg px-3 py-3 ${
                        c.ganho ? "bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.16)]" : "bg-paper-alt"
                      }`}
                      initial={{ opacity: 0, x: -14 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={VISTA}
                      transition={{ duration: 0.5, delay: 0.25 + i * 0.14, ease: EASE.out }}
                    >
                      <span className={`absolute inset-y-0 left-0 w-[3px] ${c.dot}`} />
                      <p className="mb-2 pl-1.5 text-[12px] font-medium leading-tight text-ink">{c.nome}</p>
                      <div className="flex items-center justify-between pl-1.5">
                        <span className="text-[7.5px] uppercase tracking-wider text-ink-muted">{c.etapa}</span>
                        <span className="text-[10.5px] font-semibold tabular-nums text-ink">R$ {c.valor}</span>
                      </div>
                    </m.div>
                  ))}

                  <div className="mt-4 border-t border-paper-border/70 pt-3">
                    <p className="mb-2.5 text-[9px] uppercase tracking-wider text-ink-muted">Financeiro · Setembro</p>
                    {financeiro.map((f, i) => (
                      <div key={f.label} className="mb-2.5 last:mb-0">
                        <div className="mb-1 flex items-center justify-between text-[10px]">
                          <span className="text-ink-soft">{f.label}</span>
                          <span className="font-semibold tabular-nums text-ink">{f.valor}</span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-paper-alt">
                          <m.span
                            className={`block h-full origin-left rounded-full ${f.tom}`}
                            style={{ width: `${f.pct * 100}%` }}
                            initial={reducedMotion ? false : { scaleX: 0 }}
                            whileInView={{ scaleX: 1 }}
                            viewport={VISTA}
                            transition={{ duration: 0.7, delay: 0.7 + i * 0.15, ease: EASE.out }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* O chip pousa sobre o lead "Ganho" de propósito: repete o valor
                dele, então a leitura é "o ganho virou dinheiro fechado". */}
            <m.div
              className="absolute -right-5 top-[148px] rounded-xl bg-ink px-4 py-3 shadow-[0_16px_32px_-10px_rgba(0,0,0,0.5)]"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={VISTA}
              transition={{ duration: 0.5, delay: 0.55, ease: EASE.out }}
            >
              <p className="text-[8.5px] uppercase tracking-wider text-white/45">Fechado</p>
              <p className="text-[15px] font-semibold tabular-nums text-brand">R$ 128.400</p>
            </m.div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/** Cartão 2: Projetos, o cronograma na lavagem clara. */
function CartaoProjetos() {
  const reducedMotion = useReducedMotion();
  const barras = [
    { nome: "Estrutural", inicio: 0, larg: 0.5, tom: "bg-modulo-projetos", pct: "100%" },
    { nome: "Elétrico", inicio: 0.18, larg: 0.46, tom: "bg-modulo-projetos", pct: "100%" },
    { nome: "Climatização", inicio: 0.4, larg: 0.52, tom: "bg-brand", pct: "45%" },
  ];

  return (
    <Reveal variant="scale" delay={0.08} className="h-full">
      <div className="flex h-full flex-col rounded-[26px] bg-card-brand-soft p-7">
        <CabecalhoCartao
          rotulo="Projetos"
          titulo="Disciplina, prazo e responsável"
          legenda="Concluiu uma disciplina, o próximo já sabe."
          href="/projetos"
        />

        <div className="mt-6 rounded-2xl border border-paper-border/70 bg-frame p-4">
          {/* Régua de meses: sem ela as barras não significam prazo. */}
          <div className="mb-2.5 flex gap-2 pl-[80px]">
            {["ago", "set", "out", "nov"].map((mes) => (
              <span key={mes} className="flex-1 text-center text-[7.5px] uppercase tracking-wider text-ink-muted">
                {mes}
              </span>
            ))}
          </div>

          <div className="relative">
            {barras.map((b, i) => (
              <div key={b.nome} className="mb-2.5 flex items-center gap-2.5 last:mb-0">
                <span className="w-[74px] shrink-0 truncate text-[9px] text-ink-soft">{b.nome}</span>
                <span className="relative h-3.5 flex-1">
                  <m.span
                    className={`absolute top-0 flex h-full items-center rounded-[4px] px-1.5 ${b.tom}`}
                    style={{ left: `${b.inicio * 100}%`, width: `${b.larg * 100}%` }}
                    initial={reducedMotion ? false : { scaleX: 0, originX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={VISTA}
                    transition={{ duration: 0.65, delay: 0.2 + i * 0.14, ease: EASE.out }}
                  >
                    <span className="truncate text-[6.5px] font-medium text-ink/70">{b.pct}</span>
                  </m.span>
                </span>
              </div>
            ))}

            {/* Linha de hoje, atravessando as três barras. */}
            <m.span
              className="absolute bottom-0 top-0 w-px bg-ink/25"
              style={{ left: "calc(80px + 46%)" }}
              initial={reducedMotion ? false : { scaleY: 0, originY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={VISTA}
              transition={{ duration: 0.5, delay: 0.6, ease: EASE.out }}
            />
          </div>

          <m.p
            className="mt-3 border-t border-paper-border/60 pt-2.5 text-[9px] text-ink-muted"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={VISTA}
            transition={{ duration: 0.4, delay: 0.75 }}
          >
            Concluiu, <span className="font-medium text-ink">próximo avisado na hora</span>
          </m.p>
        </div>
      </div>
    </Reveal>
  );
}

/**
 * Cartão 3: Obras, em branco de papel, sem caixa interna: o cartão é a folha.
 *
 * O corpo junta as duas metades do módulo numa composição só: as colunas de
 * execução por frente à esquerda, e a conta da obra (o dinheiro que presta
 * contas) à direita. Colunas verticais de propósito: ao lado do gantt
 * horizontal de Projetos, o par não pode repetir a mesma forma.
 */
function CartaoObras() {
  const reducedMotion = useReducedMotion();
  const frentes = [
    { nome: "Fundação", pct: 100 },
    { nome: "Estrutura", pct: 62 },
    { nome: "Acabamento", pct: 8 },
  ];

  return (
    <Reveal variant="scale" delay={0.16} className="h-full">
      <div className="flex h-full flex-col rounded-[26px] border border-paper-border/80 bg-frame p-7">
        <CabecalhoCartao
          rotulo="Obras"
          titulo="A execução e a conta da obra"
          legenda="Cada frente com seu avanço, cada real prestando contas."
          href="/obra"
        />

        <div className="mt-6 flex flex-1 items-end justify-between gap-6">
          <div className="flex items-end gap-5 sm:gap-7">
            {frentes.map((f, i) => (
              <div key={f.nome} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] font-semibold tabular-nums text-ink">{f.pct}%</span>
                <div className="relative h-[88px] w-11 overflow-hidden rounded-md bg-paper-alt">
                  <m.span
                    className={`absolute inset-x-0 bottom-0 origin-bottom rounded-md ${
                      f.pct === 100 ? "bg-ink" : "bg-brand"
                    }`}
                    style={{ height: `${f.pct}%` }}
                    initial={reducedMotion ? false : { scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={VISTA}
                    transition={{ duration: 0.7, delay: 0.2 + i * 0.15, ease: EASE.out }}
                  />
                </div>
                <span className="text-[8.5px] text-ink-muted">{f.nome}</span>
              </div>
            ))}
          </div>

          <div className="min-w-0 pb-1">
            <p className="mb-1 text-[9px] uppercase tracking-wider text-ink-muted">Conta da obra</p>
            <p className="mb-2.5 text-[21px] font-semibold tabular-nums leading-none text-ink">
              R$ 45.700 <span className="text-[10px] font-normal text-ink-muted">em caixa</span>
            </p>
            <div className="flex flex-col gap-1 text-[10.5px]">
              <span className="flex items-center justify-between gap-4">
                <span className="text-ink-muted">Aportes</span>
                <span className="tabular-nums text-ink">R$ 120.000</span>
              </span>
              <span className="flex items-center justify-between gap-4">
                <span className="text-ink-muted">Gasto</span>
                <span className="tabular-nums text-ink">R$ 74.300</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/**
 * Cartão 4: Pilar Campo, o único escuro do bento: o canteiro é outro mundo,
 * e a cor diz isso antes do texto. O corpo mostra o registro do dia com as
 * fotos e a fila offline virando sincronizado, que é a promessa inteira do
 * módulo em uma cena.
 */
function CartaoCampo() {
  return (
    <Reveal variant="scale" delay={0.24} className="h-full">
      <div className="flex h-full flex-col rounded-[26px] bg-ink p-7">
        <CabecalhoCartao
          escuro
          rotulo="Pilar Campo"
          titulo="O canteiro registra pelo celular"
          legenda="Diário, fotos e medição. Sem sinal, fica na fila e sobe sozinho."
          href="/campo"
        />

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.09em] text-white/50">
              <WifiOff className="h-3 w-3" strokeWidth={2.2} />
              Sem sinal · na fila
            </span>
            <m.span
              className="flex items-center gap-1 text-[9.5px] font-medium text-brand"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={VISTA}
              transition={{ duration: 0.4, delay: 0.9 }}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} />
              Sincronizado às 7h32
            </m.span>
          </div>

          <div className="flex items-center gap-2.5">
            {[0, 1, 2].map((i) => (
              <m.span
                key={i}
                className="h-11 w-11 shrink-0 rounded-lg border border-white/10 bg-gradient-to-br from-white/20 to-white/5"
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={VISTA}
                transition={{ duration: 0.4, delay: 0.25 + i * 0.1, ease: EASE.out }}
              />
            ))}
            <div className="min-w-0">
              <p className="truncate text-[11px] font-medium text-white">Diário de hoje</p>
              <p className="text-[9.5px] text-white/45">3 fotos · frente Estrutura</p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/**
 * Cartão 5: Portal do cliente. O corpo é a experiência do cliente em
 * miniatura: a barra de endereço com o link (a promessa "é só um link"),
 * o andamento que ele vê, e o "visto às 9h14" que prova que ele acompanha
 * sozinho, sem cobrar relatório de ninguém.
 */
function CartaoPortal() {
  const reducedMotion = useReducedMotion();

  return (
    <Reveal variant="scale" delay={0.32} className="h-full">
      <div className="flex h-full flex-col rounded-[26px] bg-card-brand-soft p-7">
        <CabecalhoCartao
          rotulo="Portal do cliente"
          titulo="Seu cliente acompanha por um link"
          legenda="Andamento e parcelas, sem conta e sem app."
          href="/portal"
        />

        <div className="mt-6 rounded-2xl border border-paper-border/70 bg-frame p-4">
          <div className="mb-3.5 flex items-center gap-2 rounded-full bg-paper-alt px-3.5 py-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
            <span className="truncate text-[10.5px] text-ink-muted">pilar.app/portal/centro-cirurgico</span>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="relative h-[52px] w-[52px] shrink-0">
              <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
                <circle cx="22" cy="22" r="19" fill="none" stroke="hsl(var(--border-landing))" strokeWidth="5" />
                <m.circle
                  cx="22"
                  cy="22"
                  r="19"
                  fill="none"
                  stroke="hsl(var(--brand-accent))"
                  strokeWidth="5"
                  strokeLinecap="round"
                  pathLength={1}
                  initial={reducedMotion ? false : { pathLength: 0 }}
                  whileInView={{ pathLength: 0.72 }}
                  viewport={VISTA}
                  transition={{ duration: 1.1, delay: 0.2, ease: EASE.out }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums text-ink">
                72%
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-ink">Centro cirúrgico</p>
              <p className="text-[9.5px] text-ink-muted">Parcela 2 de 3 · R$ 42.800</p>
            </div>

            <div className="shrink-0 text-right">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-brand text-[9px] font-semibold text-ink ring-2 ring-frame">
                MA
              </span>
              <p className="mt-1 text-[8.5px] text-ink-muted">visto às 9h14</p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function BentoSection() {
  return (
    <section id="produto" className="w-full bg-paper px-5 md:px-10 pb-16 md:pb-32 scroll-mt-28">
      <div className="max-w-6xl mx-auto">
        <Reveal variant="up" className="max-w-2xl mb-8">
          <h2 className="text-[52px] max-[1100px]:text-[42px] max-[850px]:text-[29px] max-[420px]:text-[25px] font-medium tracking-[-0.035em] leading-[1.08] text-ink">
            Cada módulo resolve uma fase. <span className="italic text-ink/45">Juntos, fecham o ciclo.</span>
          </h2>
        </Reveal>

        {/* Bloco principal: Gestão alto à esquerda (o celular sangra a borda),
            Projetos e Obras empilhados à direita com o mesmo peso. Campo e
            Portal, módulos de apoio, fecham numa fileira baixa. */}
        <div className="grid gap-4 lg:grid-cols-[5fr_7fr]">
          <CartaoGestao />
          <div className="grid gap-4">
            <CartaoProjetos />
            <CartaoObras />
          </div>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <CartaoCampo />
          <CartaoPortal />
        </div>
      </div>
    </section>
  );
}
