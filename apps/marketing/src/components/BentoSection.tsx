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

/**
 * Celular dos cartões, desenhado à mão em CSS: sem lib de mockup nenhuma,
 * porque isso é trabalho de traço, não de dependência. A moldura é um
 * gradiente escuro (titânio, não um `border` chapado), com botões saindo pra
 * fora da borda e uma ilha dinâmica de verdade (pílula preta com a lente),
 * não um retângulo arredondado centralizado.
 *
 * Aceita um `flutuante`, um cartão que estoura a borda inferior do aparelho,
 * no truque visual da referência (React Bits): dá peso ao conjunto sem custar
 * uma linha de texto a mais.
 */
function Celular({ children, flutuante }: { children: React.ReactNode; flutuante?: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-[256px] pb-8">
      {/* Botões laterais: saem da moldura, não vivem dentro dela. */}
      <span className="absolute -left-[2px] top-[58px] h-6 w-[3px] rounded-l-[2px] bg-gradient-to-r from-black/50 to-[#1c1c1e]" />
      <span className="absolute -left-[2px] top-[92px] h-9 w-[3px] rounded-l-[2px] bg-gradient-to-r from-black/50 to-[#1c1c1e]" />
      <span className="absolute -left-[2px] top-[136px] h-9 w-[3px] rounded-l-[2px] bg-gradient-to-r from-black/50 to-[#1c1c1e]" />
      <span className="absolute -right-[2px] top-[88px] h-14 w-[3px] rounded-r-[2px] bg-gradient-to-l from-black/50 to-[#1c1c1e]" />

      <div
        className="rounded-[34px] p-[9px] shadow-[0_28px_60px_-20px_rgba(0,0,0,0.55)]"
        style={{ background: "linear-gradient(155deg, #48484a, #0a0a0a 45%, #000)" }}
      >
        <div className="relative rounded-[25px] bg-frame overflow-hidden">
          {/* Barra de status: horário à esquerda, sinal/wifi/bateria à direita. */}
          <div className="relative flex items-center justify-between h-9 px-4">
            <span className="text-[9.5px] font-semibold text-ink tabular-nums">9:41</span>
            <span className="flex items-center gap-[3px]">
              <span className="flex items-end gap-[1.5px] h-[7px]">
                <span className="w-[2px] h-[3px] rounded-[0.5px] bg-ink/65" />
                <span className="w-[2px] h-[4.5px] rounded-[0.5px] bg-ink/65" />
                <span className="w-[2px] h-[6px] rounded-[0.5px] bg-ink/65" />
                <span className="w-[2px] h-[7px] rounded-[0.5px] bg-ink" />
              </span>
              <span className="relative w-[15px] h-[7px] rounded-[2.5px] border border-ink/55 flex items-center p-[1px]">
                <span className="block w-full h-full bg-ink/80 rounded-[1px]" />
                <span className="absolute -right-[2px] top-1/2 -translate-y-1/2 h-[3px] w-[1.5px] rounded-r-[1px] bg-ink/55" />
              </span>
            </span>
          </div>

          {/* Ilha dinâmica: pílula preta com a lente da câmera, não um bloco
              genérico. É o detalhe que faz o mock parecer um aparelho de
              verdade em vez de um retângulo com cantos redondos. */}
          <span className="absolute left-1/2 -translate-x-1/2 top-[7px] flex h-[22px] w-[86px] items-center justify-end rounded-full bg-black pr-[5px]">
            <span className="h-[7px] w-[7px] rounded-full bg-[#161618] ring-1 ring-white/10" />
          </span>

          <div className="px-3.5 pb-5 pt-1.5">{children}</div>
        </div>
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

/**
 * Cartões 3, 4 e 5: Obras, Pilar Campo e Portal do cliente, lado a lado.
 *
 * Antes, Obras não tinha nenhum cartão próprio: o único cartão marcado
 * "Obras · Pilar Campo" mostrava só a lista de checklist do canteiro (que é
 * conteúdo de Pilar Campo, não de Obras) e o link ia pra /campo. O módulo
 * Obras em si, do lado do escritório (frentes de serviço, conta da obra),
 * ficava só no nome, sem nenhuma forma representando ele.
 *
 * Cada um é compacto de propósito: três cartões estreitos lado a lado pedem
 * um elemento gráfico só, não um telefone inteiro.
 */

/** Cartão compacto: rótulo, título curto, legenda, um gráfico, link. */
function CartaoModulo({
  rotulo,
  titulo,
  legenda,
  claro,
  href,
  linkLabel,
  delay,
  children,
}: {
  rotulo: string;
  titulo: string;
  legenda: string;
  claro?: boolean;
  href: string;
  linkLabel: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <Reveal variant="scale" delay={delay} className="h-full">
      <div
        className={`h-full rounded-[24px] p-6 flex flex-col gap-5 ${claro ? "bg-card-brand-soft" : "bg-card-brand"}`}
      >
        <div>
          <p className="text-[9px] uppercase tracking-[0.14em] text-ink/50 mb-1.5">{rotulo}</p>
          <h3 className="text-[17px] font-medium tracking-[-0.02em] leading-[1.2] text-ink mb-1.5">{titulo}</h3>
          <p className="text-[11.5px] text-ink/60 leading-snug">{legenda}</p>
        </div>

        {children}

        <Link
          to={href}
          className="mt-auto pt-1 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink group/l"
        >
          {linkLabel}
          <ArrowRight className="w-3 h-3 group-hover/l:translate-x-1 transition-transform" />
        </Link>
      </div>
    </Reveal>
  );
}

/** Cartão 3: Obras, visão do escritório, frentes de serviço. */
function CartaoObras() {
  const reducedMotion = useReducedMotion();
  const frentes = [
    { nome: "Fundação", pct: 100 },
    { nome: "Estrutura", pct: 62 },
    { nome: "Acabamento", pct: 8 },
  ];

  return (
    <CartaoModulo
      rotulo="Obras"
      titulo="Cada frente, sob controle"
      legenda="Fundação, estrutura, acabamento: sua barra."
      href="/obra"
      linkLabel="Ver Obras"
      delay={0.16}
    >
      <div className="rounded-2xl bg-frame/90 backdrop-blur-sm border border-white/60 p-3.5">
        {frentes.map((f, i) => (
          <div key={f.nome} className="mb-2.5 last:mb-0">
            <div className="flex justify-between text-[9.5px] mb-1">
              <span className="text-ink-soft">{f.nome}</span>
              <span className="text-ink-muted tabular-nums">{f.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-paper-alt overflow-hidden">
              <m.span
                className={`block h-full rounded-full origin-left ${f.pct === 100 ? "bg-ink" : "bg-brand"}`}
                initial={reducedMotion ? false : { scaleX: 0 }}
                whileInView={{ scaleX: f.pct / 100 }}
                viewport={VISTA}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.15, ease: EASE.out }}
              />
            </div>
          </div>
        ))}
      </div>
    </CartaoModulo>
  );
}

/** Cartão 4: Pilar Campo, o registro do canteiro em si. */
function CartaoCampo() {
  const reducedMotion = useReducedMotion();

  return (
    <CartaoModulo
      rotulo="Pilar Campo"
      titulo="O canteiro registra, sem sinal"
      legenda="Sobe sozinho quando a rede volta."
      href="/campo"
      linkLabel="Ver Pilar Campo"
      delay={0.24}
    >
      <div className="rounded-2xl bg-frame/90 backdrop-blur-sm border border-white/60 p-3.5">
        <p className="flex items-center gap-1.5 text-[8.5px] uppercase tracking-[0.09em] text-ink-soft mb-2.5">
          <WifiOff className="w-2.5 h-2.5" strokeWidth={2.4} />
          Sem sinal, na fila
        </p>
        {["Registro do dia", "3 fotos"].map((label, i) => (
          <m.div
            key={label}
            className="flex items-center gap-2 mb-2 last:mb-0"
            initial={reducedMotion ? false : { opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={VISTA}
            transition={{ duration: 0.4, delay: 0.15 + i * 0.12, ease: EASE.out }}
          >
            <m.span
              className="w-3.5 h-3.5 rounded-[4px] shrink-0 flex items-center justify-center"
              initial={reducedMotion ? false : { backgroundColor: "rgba(0,0,0,0.06)" }}
              whileInView={{ backgroundColor: "hsl(var(--positive-strong))" }}
              viewport={VISTA}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.22, ease: EASE.out }}
            >
              <svg viewBox="0 0 12 12" className="w-2 h-2" fill="none">
                <m.path
                  d="M2.5 6.2 4.8 8.5 9.5 3.8"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reducedMotion ? false : { pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={VISTA}
                  transition={{ duration: 0.28, delay: 0.6 + i * 0.22, ease: EASE.out }}
                />
              </svg>
            </m.span>
            <span className="text-[10px] text-ink">{label}</span>
          </m.div>
        ))}
      </div>
    </CartaoModulo>
  );
}

/** Cartão 5: portal do cliente, o anel de progresso à distância. */
function CartaoPortal() {
  const reducedMotion = useReducedMotion();

  return (
    <CartaoModulo
      rotulo="Portal do cliente"
      titulo="Seu cliente acompanha sozinho"
      legenda="Sem conta, sem app: só um link."
      claro
      href="/portal"
      linkLabel="Ver Portal do cliente"
      delay={0.32}
    >
      <div className="rounded-2xl bg-frame border border-paper-border/70 p-3.5 flex items-center gap-3">
        <div className="relative w-[52px] h-[52px] shrink-0">
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
          <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-ink tabular-nums">
            72%
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium text-ink truncate">Centro cirúrgico</p>
          <p className="text-[9px] text-ink-muted">Parcela 2 de 3</p>
          <p className="text-[11px] font-semibold text-ink tabular-nums">R$ 42.800</p>
        </div>
      </div>
    </CartaoModulo>
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

        {/* Alturas desiguais de propósito: é o que separa um bento de uma grade.
            Cinco módulos: Gestão em destaque à esquerda, Projetos em cima à
            direita, e Obras/Campo/Portal numa fileira compacta embaixo. */}
        <div className="grid md:grid-cols-2 lg:grid-cols-[1fr_1.25fr] gap-4">
          <div className="lg:row-span-2">
            <CartaoGestao />
          </div>
          <CartaoProjetos />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <CartaoObras />
            <CartaoCampo />
            <CartaoPortal />
          </div>
        </div>
      </div>
    </section>
  );
}
