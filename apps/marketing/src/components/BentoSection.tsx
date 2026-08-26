import { Link } from "react-router-dom";
import { m, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, WifiOff } from "lucide-react";
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

/** Celular usado nos cartões, com o conteúdo passado por dentro. */
function Celular({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[184px] rounded-[24px] border-[6px] border-ink bg-frame overflow-hidden shadow-[0_18px_40px_-18px_rgba(0,0,0,0.45)]">
      <div className="h-4 bg-ink flex items-center justify-center">
        <span className="w-10 h-1 rounded-full bg-white/25" />
      </div>
      <div className="p-2.5">{children}</div>
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
          <p className="text-[8px] uppercase tracking-[0.1em] text-ink-muted mb-1.5">Funil de leads</p>
          {[
            ["Retrofit elétrico", "R$ 84.000", false],
            ["Centro cirúrgico", "R$ 128.400", true],
            ["Gases medicinais", "R$ 56.000", false],
          ].map(([nome, valor, ganho], i) => (
            <m.div
              key={nome as string}
              className={`rounded-lg px-2 py-1.5 mb-1.5 border ${
                ganho ? "bg-card-brand-soft border-modulo-gestao-strong" : "bg-paper-alt border-transparent"
              }`}
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={VISTA}
              transition={{ duration: 0.45, delay: 0.15 + i * 0.1, ease: EASE.out }}
            >
              <p className="text-[9.5px] text-ink leading-tight">{nome as string}</p>
              <p className="text-[8.5px] text-ink-muted tabular-nums">{valor as string}</p>
            </m.div>
          ))}
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
    { nome: "Estrutural", inicio: 0, larg: 0.52 },
    { nome: "Elétrico", inicio: 0.2, larg: 0.5 },
    { nome: "Climatização", inicio: 0.42, larg: 0.48 },
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
          {barras.map((b, i) => (
            <div key={b.nome} className="flex items-center gap-3 mb-2.5 last:mb-0">
              <span className="text-[10px] text-ink-muted w-[74px] shrink-0 truncate">{b.nome}</span>
              <span className="relative flex-1 h-2.5 rounded-full bg-paper-alt overflow-hidden">
                <m.span
                  className="absolute h-full rounded-full bg-modulo-projetos-strong origin-left"
                  style={{ left: `${b.inicio * 100}%`, width: `${b.larg * 100}%` }}
                  initial={reducedMotion ? false : { scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  viewport={VISTA}
                  transition={{ duration: 0.75, delay: 0.2 + i * 0.13, ease: EASE.out }}
                />
              </span>
            </div>
          ))}
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

        <div className="rounded-2xl bg-frame/85 backdrop-blur-sm border border-white/50 p-4">
          <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] text-modulo-obra-strong mb-2.5">
            <WifiOff className="w-3 h-3" strokeWidth={2.4} />
            Sem sinal, na fila
          </p>
          {[
            ["Registro do dia", true],
            ["3 fotos", true],
            ["Medição, 62 m²", false],
          ].map(([label, pronto], i) => (
            <m.div
              key={label as string}
              className="flex items-center gap-2 text-[11.5px] text-ink-soft mb-1.5 last:mb-0"
              animate={reducedMotion ? undefined : { opacity: [0.5, 1, 1] }}
              transition={{ duration: 5, repeat: Infinity, delay: i * 0.45, times: [0, 0.35, 1] }}
            >
              <span
                className={`w-3 h-3 rounded-[4px] shrink-0 flex items-center justify-center ${
                  pronto ? "bg-modulo-gestao-strong" : "border border-paper-border"
                }`}
              >
                {pronto ? <Check className="w-2 h-2 text-white" strokeWidth={4} /> : null}
              </span>
              {label as string}
            </m.div>
          ))}
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
            <span className="italic text-modulo-gestao-strong">Juntos, fecham o ciclo.</span>
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
