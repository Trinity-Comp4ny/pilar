import { Link } from "react-router-dom";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight, WifiOff } from "lucide-react";
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
          <div className="flex items-center justify-between mb-2">
            <p className="text-[8.5px] font-medium text-ink">Funil de leads</p>
            <span className="text-[7px] text-ink-muted">12 ativos</span>
          </div>

          {[
            { nome: "Retrofit elétrico", valor: "R$ 84.000", etapa: "Em contato", dot: "bg-pipeline-contato" },
            { nome: "Centro cirúrgico", valor: "R$ 128.400", etapa: "Ganho", dot: "bg-status-done", ganho: true },
            { nome: "Gases medicinais", valor: "R$ 56.000", etapa: "Proposta", dot: "bg-chart-warning" },
          ].map((c, i) => (
            <m.div
              key={c.nome}
              className={`rounded-lg px-2 py-1.5 mb-1.5 border ${
                c.ganho ? "bg-white border-ink/15 shadow-sm" : "bg-paper-alt border-transparent"
              }`}
              initial={{ opacity: 0, x: -12 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VISTA}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.11, ease: EASE.out }}
            >
              <p className="text-[9px] text-ink leading-tight mb-1 truncate">{c.nome}</p>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  <span className="text-[7px] text-ink-muted">{c.etapa}</span>
                </span>
                <span className="text-[8px] font-medium text-ink tabular-nums">{c.valor}</span>
              </div>
            </m.div>
          ))}

          {/* O total sobe quando o lead entra em Ganho. */}
          <m.div
            className="mt-2 flex items-center justify-between rounded-lg bg-ink px-2 py-1.5"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VISTA}
            transition={{ duration: 0.45, delay: 0.55, ease: EASE.out }}
          >
            <span className="text-[7px] uppercase tracking-wider text-white/50">Valor no funil</span>
            <span className="text-[9px] font-semibold text-white tabular-nums">R$ 399.600</span>
          </m.div>
        </Celular>

        <Link
          to={`/${mo.slug}`}
          className="mt-8 inline-flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-ink group/l"
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

        <div className="rounded-2xl bg-frame border border-paper-border/70 p-4">
          {[
            ["Estrutural", "Entregue"],
            ["Climatização", "Em revisão"],
            ["Parcela 2 de 3", "R$ 42.800"],
          ].map(([k, v]) => (
            <div
              key={k}
              className="flex justify-between items-center text-[11.5px] py-1.5 border-b border-paper-border/50 last:border-0"
            >
              <span className="text-ink-muted">{k}</span>
              <span className="text-ink font-medium tabular-nums">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

export function BentoSection() {
  return (
    <section id="produto" className="w-full bg-paper px-6 md:px-10 pb-24 md:pb-32 scroll-mt-28">
      <div className="max-w-6xl mx-auto">
        <Reveal variant="up" className="max-w-2xl mb-10">
          <h2 className="text-[clamp(30px,4.2vw,52px)] font-medium tracking-[-0.035em] leading-[1.08] text-ink">
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
