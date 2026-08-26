import { Link } from "react-router-dom";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight, Link2, WifiOff } from "lucide-react";
import { Reveal } from "./Reveal";
import { EASE } from "../lib/motion";
import { MODULOS } from "../lib/modules";

/**
 * Bento dos módulos, no formato da referência: cartões de altura desigual, uns
 * no verde cheio da marca e outros na lavagem clara, cada um com uma peça de
 * produto desenhada por dentro em vez de um ícone.
 *
 * Substitui a grade de três cartões iguais com lista de checks, que dizia tudo
 * no mesmo tom de voz e não mostrava nada.
 */

const VISTA = { once: true, amount: 0.35 } as const;

/** Celular dos cartões: moldura com ilha, barra de status e conteúdo por dentro. */
function Celular({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[196px]">
      <div className="rounded-[26px] border-[7px] border-ink bg-frame overflow-hidden shadow-[0_22px_50px_-20px_rgba(0,0,0,0.5)]">
        {/* Barra de status com a ilha, como num aparelho de verdade. */}
        <div className="relative h-6 bg-frame flex items-center justify-between px-3">
          <span className="text-[7px] font-medium text-ink/70 tabular-nums">9:41</span>
          <span className="absolute left-1/2 -translate-x-1/2 top-1 w-11 h-3 rounded-full bg-ink" />
          <span className="flex items-center gap-[3px]">
            <span className="w-[7px] h-[5px] rounded-[1px] bg-ink/60" />
            <span className="w-[9px] h-[5px] rounded-[1px] border border-ink/50" />
          </span>
        </div>
        <div className="px-2.5 pb-3">{children}</div>
      </div>
    </div>
  );
}

/** Cartão 1: o funil, no verde cheio. */
function CartaoGestao() {
  const mo = MODULOS[0];
  return (
    <Reveal variant="scale" className="h-full">
      <div className="h-full rounded-[26px] bg-card-brand p-7 md:p-9 flex flex-col justify-center">
        <h3 className="text-[26px] md:text-[30px] font-medium tracking-[-0.03em] leading-[1.1] text-ink text-center mb-2.5">
          Do lead ao dinheiro na conta
        </h3>
        <p className="text-[13.5px] text-ink/65 text-center leading-relaxed mb-7 max-w-[30ch] mx-auto">
          Funil, proposta no seu template, contrato e financeiro sem redigitar nada entre as etapas.
        </p>

        <Celular>
          {/* Cabeçalho da tela, como no app: título e ação. */}
          <div className="flex items-center justify-between pt-1 pb-2.5">
            <span className="text-[10px] font-semibold tracking-tight text-ink">Leads</span>
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-brand text-ink text-[9px] leading-none font-semibold">
              +
            </span>
          </div>

          {/* Duas métricas antes da lista: dá contexto ao que vem abaixo. */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            {[
              { r: "No funil", v: "R$ 399.600" },
              { r: "Fecham em 7d", v: "3" },
            ].map((k, i) => (
              <m.div
                key={k.r}
                className="rounded-lg bg-paper-alt px-2 py-1.5"
                initial={{ opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VISTA}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.08, ease: EASE.out }}
              >
                <span className="block text-[6.5px] uppercase tracking-wider text-ink-muted mb-[2px]">{k.r}</span>
                <span className="block text-[10px] font-semibold text-ink tabular-nums leading-none">{k.v}</span>
              </m.div>
            ))}
          </div>

          {[
            { nome: "Retrofit elétrico", cli: "Hospital Santa Rita", valor: "84.000", etapa: "Em contato", dot: "bg-pipeline-contato" },
            { nome: "Centro cirúrgico", cli: "Hospital Santa Rita", valor: "128.400", etapa: "Ganho", dot: "bg-status-done", ganho: true },
            { nome: "Gases medicinais", cli: "Clínica Vitta", valor: "56.000", etapa: "Proposta", dot: "bg-chart-warning" },
          ].map((c, i) => (
            <m.div
              key={c.nome}
              className={`relative rounded-lg px-2 py-1.5 mb-1.5 overflow-hidden ${
                c.ganho ? "bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.16)]" : "bg-paper-alt"
              }`}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VISTA}
              transition={{ duration: 0.5, delay: 0.25 + i * 0.12, ease: EASE.out }}
            >
              {/* Fio de cor da etapa na borda esquerda, como no cartão do app. */}
              <span className={`absolute left-0 inset-y-0 w-[2.5px] ${c.dot}`} />
              <p className="pl-1.5 text-[9px] font-medium text-ink leading-tight truncate">{c.nome}</p>
              <p className="pl-1.5 text-[7px] text-ink-muted truncate mb-1">{c.cli}</p>
              <div className="pl-1.5 flex items-center justify-between">
                <span className="text-[6.5px] uppercase tracking-wider text-ink-muted">{c.etapa}</span>
                <span className="text-[8.5px] font-semibold text-ink tabular-nums">R$ {c.valor}</span>
              </div>
            </m.div>
          ))}
        </Celular>

        <m.div
          className="mt-7 flex items-center justify-between rounded-xl bg-ink px-4 py-3"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VISTA}
          transition={{ duration: 0.5, delay: 0.65, ease: EASE.out }}
        >
          <span className="text-[9px] uppercase tracking-[0.12em] text-white/45">Fechado neste mês</span>
          <span className="text-[15px] font-semibold tabular-nums text-brand">R$ 128.400</span>
        </m.div>

        <Link
          to={`/${mo.slug}`}
          className="mt-5 inline-flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-ink group/l"
        >
          Ver Gestão
          <ArrowRight className="w-3.5 h-3.5 group-hover/l:translate-x-1 transition-transform" />
        </Link>
      </div>
    </Reveal>
  );
}

/** Cartão 2: cronograma, na lavagem clara e deitado. */
function CartaoProjetos() {
  const reducedMotion = useReducedMotion();
  const barras = [
    { nome: "Estrutural", inicio: 0, larg: 0.5, tom: "bg-modulo-projetos", pct: "100%" },
    { nome: "Elétrico", inicio: 0.18, larg: 0.46, tom: "bg-modulo-projetos", pct: "100%" },
    { nome: "Climatização", inicio: 0.4, larg: 0.52, tom: "bg-brand", pct: "45%" },
  ];

  return (
    <Reveal variant="scale" delay={0.08} className="h-full">
      <div className="h-full rounded-[26px] bg-card-brand-soft p-7 md:p-9 flex flex-col justify-between gap-8">
        <div>
          <h3 className="text-[24px] md:text-[28px] font-medium tracking-[-0.03em] leading-[1.12] text-ink mb-2.5">
            Disciplina, prazo e responsável
          </h3>
          <p className="text-[13.5px] text-ink/60 leading-relaxed max-w-[38ch]">
            Projeto não é uma tarefa: é um conjunto de disciplinas com gente e data em cada uma. Concluiu, o próximo já
            sabe.
          </p>
        </div>

        <div className="rounded-2xl bg-frame border border-paper-border/70 p-4">
          {/* Régua de meses: sem ela as barras não significam prazo. */}
          <div className="flex gap-2 mb-2.5 pl-[80px]">
            {["ago", "set", "out", "nov"].map((mes) => (
              <span key={mes} className="flex-1 text-[7.5px] uppercase tracking-wider text-ink-muted text-center">
                {mes}
              </span>
            ))}
          </div>

          <div className="relative">
            {barras.map((b, i) => (
              <div key={b.nome} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
                <span className="text-[9px] text-ink-soft w-[74px] shrink-0 truncate">{b.nome}</span>
                <span className="relative flex-1 h-3.5">
                  <m.span
                    className={`absolute top-0 h-full rounded-[4px] flex items-center px-1.5 ${b.tom}`}
                    style={{ left: `${b.inicio * 100}%`, width: `${b.larg * 100}%` }}
                    initial={reducedMotion ? false : { scaleX: 0, originX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={VISTA}
                    transition={{ duration: 0.65, delay: 0.2 + i * 0.14, ease: EASE.out }}
                  >
                    <span className="text-[6.5px] font-medium text-ink/70 truncate">{b.pct}</span>
                  </m.span>
                </span>
              </div>
            ))}

            {/* Linha de hoje, atravessando as três barras. */}
            <m.span
              className="absolute top-0 bottom-0 w-px bg-ink/25"
              style={{ left: "calc(80px + 46%)" }}
              initial={reducedMotion ? false : { scaleY: 0, originY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={VISTA}
              transition={{ duration: 0.5, delay: 0.6, ease: EASE.out }}
            />
          </div>

          <m.p
            className="mt-3 pt-2.5 border-t border-paper-border/60 text-[9px] text-ink-muted"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={VISTA}
            transition={{ duration: 0.4, delay: 0.75 }}
          >
            Elétrico concluiu: <span className="text-ink font-medium">Climatização foi avisada</span>
          </m.p>
        </div>
      </div>
    </Reveal>
  );
}

/** Cartão 3: o canteiro offline, verde cheio e baixo. */
function CartaoObra() {
  const reducedMotion = useReducedMotion();
  return (
    <Reveal variant="scale" delay={0.16} className="h-full">
      <div className="h-full rounded-[26px] bg-card-brand p-7 md:p-9 flex flex-col justify-between gap-7">
        <div>
          <h3 className="text-[24px] md:text-[28px] font-medium tracking-[-0.03em] leading-[1.12] text-ink mb-2.5">
            O canteiro alimenta o escritório
          </h3>
          <p className="text-[13.5px] text-ink/65 leading-relaxed max-w-[36ch]">
            Diário preenchido no celular, sem sinal e sem e-mail. Sobe sozinho quando a rede volta.
          </p>
        </div>

        <div className="rounded-2xl bg-frame/90 backdrop-blur-sm border border-white/60 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] text-ink-soft">
              <WifiOff className="w-3 h-3" strokeWidth={2.4} />
              Sem sinal
            </p>
            {/* A fila esvazia: o contador cai enquanto os itens são marcados. */}
            <m.span
              className="text-[9px] text-ink-muted tabular-nums"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={VISTA}
              transition={{ duration: 0.3 }}
            >
              3 na fila
            </m.span>
          </div>

          {[
            { label: "Registro do dia", detalhe: "Clima, efetivo, atividade" },
            { label: "3 fotos", detalhe: "Alvenaria, fachada norte" },
            { label: "Medição", detalhe: "62 m² executados" },
          ].map((f, i) => (
            <m.div
              key={f.label}
              className="flex items-start gap-2.5 mb-2.5 last:mb-0"
              initial={reducedMotion ? false : { opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VISTA}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.12, ease: EASE.out }}
            >
              {/* O quadrado se preenche e o traço do check é desenhado. */}
              <m.span
                className="w-4 h-4 rounded-[5px] shrink-0 flex items-center justify-center mt-[1px]"
                initial={reducedMotion ? false : { backgroundColor: "rgba(0,0,0,0.06)" }}
                whileInView={{ backgroundColor: "hsl(var(--positive-strong))" }}
                viewport={VISTA}
                transition={{ duration: 0.3, delay: 0.5 + i * 0.22, ease: EASE.out }}
              >
                <svg viewBox="0 0 12 12" className="w-2.5 h-2.5" fill="none">
                  <m.path
                    d="M2.5 6.2 4.8 8.5 9.5 3.8"
                    stroke="#fff"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={reducedMotion ? false : { pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={VISTA}
                    transition={{ duration: 0.28, delay: 0.6 + i * 0.22, ease: EASE.out }}
                  />
                </svg>
              </m.span>
              <span className="min-w-0">
                <span className="block text-[10.5px] text-ink leading-tight">{f.label}</span>
                <span className="block text-[8.5px] text-ink-muted truncate">{f.detalhe}</span>
              </span>
            </m.div>
          ))}

          <m.p
            className="mt-3 pt-2.5 border-t border-black/5 text-[9px] text-ink-muted"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={VISTA}
            transition={{ duration: 0.4, delay: 1.2 }}
          >
            Sincronizado <span className="text-ink font-medium">assim que a rede voltou</span>
          </m.p>
        </div>
      </div>
    </Reveal>
  );
}

/** Cartão 4: portal do cliente, claro e estreito. */
function CartaoPortal() {
  const reducedMotion = useReducedMotion();

  return (
    <Reveal variant="scale" delay={0.24} className="h-full">
      <div className="h-full rounded-[26px] bg-card-brand-soft p-7 md:p-9 flex flex-col justify-between gap-7">
        <div>
          <h3 className="text-[24px] md:text-[28px] font-medium tracking-[-0.03em] leading-[1.12] text-ink mb-2.5">
            Seu cliente acompanha sozinho
          </h3>
          <p className="text-[13.5px] text-ink/60 leading-relaxed max-w-[34ch]">
            Um portal, duas visões: quem contratou projeto vê disciplina e entrega, quem contratou obra vê prestação de
            contas.
          </p>
        </div>

        <div className="rounded-2xl bg-frame border border-paper-border/70 overflow-hidden">
          {/* Barra de link: é assim que o cliente chega, sem conta e sem app.
              Deliberadamente diferente da lista de checks do canteiro. */}
          <div className="flex items-center gap-2 border-b border-paper-border/60 bg-paper-alt/60 px-3 py-2">
            <Link2 className="w-3 h-3 text-ink-muted shrink-0" strokeWidth={1.8} />
            <span className="text-[8.5px] text-ink-muted truncate">pilarsoft.com.br/portal/santa-rita</span>
            <span className="ml-auto text-[7px] uppercase tracking-wider text-ink-muted shrink-0">Só leitura</span>
          </div>

          <div className="flex items-center gap-4 p-4">
            {/* Anel de progresso: uma leitura só, à distância. */}
            <div className="relative w-[62px] h-[62px] shrink-0">
              <svg viewBox="0 0 44 44" className="w-full h-full -rotate-90">
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
              <span className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-ink tabular-nums">
                72%
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[10.5px] font-medium text-ink mb-2">Climatização, centro cirúrgico</p>
              {[
                { d: "Estrutural", e: "Entregue", ok: true },
                { d: "Elétrico", e: "Entregue", ok: true },
                { d: "Climatização", e: "Em revisão", ok: false },
              ].map((l, i) => (
                <m.div
                  key={l.d}
                  className="flex items-center justify-between gap-2 py-[3px]"
                  initial={reducedMotion ? false : { opacity: 0, x: 8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={VISTA}
                  transition={{ duration: 0.38, delay: 0.35 + i * 0.1, ease: EASE.out }}
                >
                  <span className="text-[9px] text-ink-soft truncate">{l.d}</span>
                  <span
                    className={`shrink-0 rounded-full px-1.5 py-[1px] text-[7px] uppercase tracking-wider ${
                      l.ok ? "bg-brand text-ink" : "bg-paper-alt text-ink-muted"
                    }`}
                  >
                    {l.e}
                  </span>
                </m.div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-paper-border/60 px-4 py-2.5">
            <span className="text-[8.5px] text-ink-muted">Parcela 2 de 3</span>
            <span className="text-[10px] font-semibold text-ink tabular-nums">R$ 42.800</span>
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
        <Reveal variant="up" className="max-w-2xl mb-10">
          <h2 className="text-[52px] max-[1100px]:text-[42px] max-[850px]:text-[29px] max-[420px]:text-[25px] font-medium tracking-[-0.035em] leading-[1.08] text-ink">
            Cada módulo resolve uma fase.{" "}
            <span className="italic text-ink/45">Juntos, fecham o ciclo.</span>
          </h2>
        </Reveal>

        {/* Alturas desiguais de propósito: é o que separa um bento de uma grade. */}
        <div className="grid md:grid-cols-2 lg:grid-cols-[1fr_1.25fr] gap-4">
          <div className="lg:row-span-2">
            <CartaoGestao />
          </div>
          <CartaoProjetos />
          <div className="grid sm:grid-cols-2 gap-4">
            <CartaoObra />
            <CartaoPortal />
          </div>
        </div>
      </div>
    </section>
  );
}
