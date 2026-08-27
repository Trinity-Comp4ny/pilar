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

/**
 * Celular dos cartões: moldura com ilha, barra de status e conteúdo por
 * dentro. Aceita um `flutuante`, um cartão que estoura a borda inferior do
 * aparelho, no truque visual da referência (React Bits): dá peso ao conjunto
 * sem custar uma linha de texto a mais.
 */
function Celular({ children, flutuante }: { children: React.ReactNode; flutuante?: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[256px] pb-8">
      <div className="rounded-[30px] border-[8px] border-ink bg-frame overflow-hidden shadow-[0_26px_58px_-20px_rgba(0,0,0,0.5)]">
        {/* Barra de status com a ilha, como num aparelho de verdade. */}
        <div className="relative h-7 bg-frame flex items-center justify-between px-3.5">
          <span className="text-[8px] font-medium text-ink/70 tabular-nums">9:41</span>
          <span className="absolute left-1/2 -translate-x-1/2 top-1.5 w-12 h-3.5 rounded-full bg-ink" />
          <span className="flex items-center gap-[3px]">
            <span className="w-2 h-[6px] rounded-[1px] bg-ink/60" />
            <span className="w-2.5 h-[6px] rounded-[1px] border border-ink/50" />
          </span>
        </div>
        <div className="px-3 pb-5">{children}</div>
      </div>

      {flutuante && (
        <m.div
          className="absolute inset-x-3 -bottom-1"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VISTA}
          transition={{ duration: 0.5, delay: 0.55, ease: EASE.out }}
        >
          {flutuante}
        </m.div>
      )}
    </div>
  );
}

/**
 * Cartão 1: o funil, no verde cheio.
 *
 * A versão anterior tinha uma lista de 3 leads com nome do cliente dentro do
 * celular e, embaixo dele, uma cadeia de 4 passos em texto para preencher o
 * verde sobrando. As duas coisas iam contra a referência: menos densidade
 * dentro da tela, e o espaço embaixo se resolve com forma, não com parágrafo.
 * Agora o celular mostra só 2 cartões, maiores, e um cartão escuro estoura a
 * borda de baixo do aparelho com o número que fecha a história.
 */
function CartaoGestao() {
  const mo = MODULOS[0];
  return (
    <Reveal variant="scale" className="h-full">
      <div className="h-full rounded-[26px] bg-card-brand p-7 md:p-9 flex flex-col justify-center">
        <p className="text-center text-[10px] uppercase tracking-[0.16em] text-ink/50 mb-2">Gestão</p>
        <h3 className="text-[26px] md:text-[30px] font-medium tracking-[-0.03em] leading-[1.1] text-ink text-center mb-2.5">
          Do lead ao dinheiro na conta
        </h3>
        <p className="text-[13.5px] text-ink/65 text-center leading-relaxed mb-8">Sem redigitar nada entre as etapas.</p>

        <Celular
          flutuante={
            <div className="rounded-xl bg-ink px-4 py-3 shadow-[0_16px_32px_-10px_rgba(0,0,0,0.5)] flex items-center justify-between">
              <span className="text-[9px] uppercase tracking-wider text-white/45">Fechado</span>
              <span className="text-[14.5px] font-semibold text-brand tabular-nums">R$ 128.400</span>
            </div>
          }
        >
          <div className="flex items-center justify-between pt-1.5 pb-3.5">
            <span className="text-[12.5px] font-semibold tracking-tight text-ink">Leads</span>
            <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-brand text-ink text-[10px] leading-none font-semibold">
              +
            </span>
          </div>

          {[
            { nome: "Retrofit elétrico", valor: "84.000", etapa: "Em contato", dot: "bg-pipeline-contato" },
            { nome: "Centro cirúrgico", valor: "128.400", etapa: "Ganho", dot: "bg-status-done", ganho: true },
            { nome: "Fotovoltaico", valor: "71.200", etapa: "Negociação", dot: "bg-brand" },
          ].map((c, i) => (
            <m.div
              key={c.nome}
              className={`relative rounded-lg px-3 py-3 mb-2.5 overflow-hidden ${
                c.ganho ? "bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.16)]" : "bg-paper-alt"
              }`}
              initial={{ opacity: 0, x: -14 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VISTA}
              transition={{ duration: 0.5, delay: 0.25 + i * 0.14, ease: EASE.out }}
            >
              <span className={`absolute left-0 inset-y-0 w-[3px] ${c.dot}`} />
              <p className="pl-1.5 text-[12px] font-medium text-ink leading-tight mb-2">{c.nome}</p>
              <div className="pl-1.5 flex items-center justify-between">
                <span className="text-[7.5px] uppercase tracking-wider text-ink-muted">{c.etapa}</span>
                <span className="text-[10.5px] font-semibold text-ink tabular-nums">R$ {c.valor}</span>
              </div>
            </m.div>
          ))}
        </Celular>

        <Link
          to={`/${mo.slug}`}
          className="mt-4 inline-flex items-center justify-center gap-1.5 text-[13.5px] font-medium text-ink group/l"
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
      <div className="h-full rounded-[26px] bg-card-brand-soft p-7 md:p-9 flex flex-col gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/50 mb-2">Projetos</p>
          <h3 className="text-[24px] md:text-[28px] font-medium tracking-[-0.03em] leading-[1.12] text-ink mb-2.5">
            Disciplina, prazo e responsável
          </h3>
          <p className="text-[13.5px] text-ink/60 leading-relaxed">Concluiu uma disciplina, o próximo já sabe.</p>
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
            Concluiu, <span className="text-ink font-medium">próximo avisado na hora</span>
          </m.p>
        </div>

        <Link
          to="/projetos"
          className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink group/l"
        >
          Ver Projetos
          <ArrowRight className="w-3.5 h-3.5 group-hover/l:translate-x-1 transition-transform" />
        </Link>
      </div>
    </Reveal>
  );
}

/** Cartão 3: o canteiro offline, verde cheio e baixo. */
function CartaoObra() {
  const reducedMotion = useReducedMotion();
  return (
    <Reveal variant="scale" delay={0.16} className="h-full">
      <div className="h-full rounded-[26px] bg-card-brand p-7 md:p-9 flex flex-col gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/50 mb-2">Obras · Pilar Campo</p>
          <h3 className="text-[24px] md:text-[28px] font-medium tracking-[-0.03em] leading-[1.12] text-ink mb-2.5">
            O canteiro alimenta o escritório
          </h3>
          <p className="text-[13.5px] text-ink/65 leading-relaxed">Sem sinal e sem e-mail, sobe sozinho depois.</p>
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

          {/* Dois itens, maiores, em vez de três com legenda embaixo de cada
              um: o quadrado que se preenche já é a forma, não precisa de mais
              texto explicando. */}
          {["Registro do dia", "3 fotos"].map((label, i) => (
            <m.div
              key={label}
              className="flex items-center gap-2.5 mb-2.5 last:mb-0"
              initial={reducedMotion ? false : { opacity: 0, x: -8 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VISTA}
              transition={{ duration: 0.4, delay: 0.15 + i * 0.12, ease: EASE.out }}
            >
              <m.span
                className="w-4 h-4 rounded-[5px] shrink-0 flex items-center justify-center"
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
              <span className="text-[11px] text-ink">{label}</span>
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

        <Link
          to="/campo"
          className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink group/l"
        >
          Ver Pilar Campo
          <ArrowRight className="w-3.5 h-3.5 group-hover/l:translate-x-1 transition-transform" />
        </Link>
      </div>
    </Reveal>
  );
}

/** Cartão 4: portal do cliente, claro e estreito. */
function CartaoPortal() {
  const reducedMotion = useReducedMotion();

  return (
    <Reveal variant="scale" delay={0.24} className="h-full">
      <div className="h-full rounded-[26px] bg-card-brand-soft p-7 md:p-9 flex flex-col gap-6">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-ink/50 mb-2">Portal do cliente</p>
          <h3 className="text-[24px] md:text-[28px] font-medium tracking-[-0.03em] leading-[1.12] text-ink mb-2.5">
            Seu cliente acompanha sozinho
          </h3>
          <p className="text-[13.5px] text-ink/60 leading-relaxed">Sem conta, sem app: só um link.</p>
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

        <Link
          to="/portal"
          className="mt-auto pt-2 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-ink group/l"
        >
          Ver Portal do cliente
          <ArrowRight className="w-3.5 h-3.5 group-hover/l:translate-x-1 transition-transform" />
        </Link>
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
