import { useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { EASE } from "../../lib/motion";
import { COLUNAS, FRASE, LEAD_HEROI, NAV, RASCUNHO, idx, moduloAtivo } from "./scene";

/* Todas as medidas aqui são em pixels do palco de 1120x680 (ver scene.ts):
   o HeroScene escala o conjunto por CSS, então nada precisa ser responsivo
   por dentro. */

const CONTENT_X = 26;
const COL_LARGURA = 209;
const COL_GAP = 12;
const LISTA_TOP = 96;
const colX = (i: number) => i * (COL_LARGURA + COL_GAP);

/* ── Moldura do app ──────────────────────────────────────────────────── */

export function BarraTopo() {
  return (
    <div className="h-11 flex items-center gap-2 px-4 border-b border-paper-border/70 bg-paper-alt/60">
      <span className="w-2.5 h-2.5 rounded-full bg-paper-border" />
      <span className="w-2.5 h-2.5 rounded-full bg-paper-border" />
      <span className="w-2.5 h-2.5 rounded-full bg-paper-border" />
      <span className="ml-3 px-3 py-1 rounded-md bg-white border border-paper-border/70 text-[10.5px] text-ink-muted tabular-nums">
        app.pilarsoft.com.br
      </span>
      <span className="ml-auto flex items-center gap-1.5">
        <span className="w-5 h-5 rounded-full bg-modulo-gestao" />
        <span className="w-5 h-5 rounded-full bg-modulo-projetos" />
      </span>
    </div>
  );
}

export function BarraLateral({ ato }: { ato: number }) {
  const ativo = moduloAtivo(ato);

  return (
    <div className="w-[196px] shrink-0 border-r border-paper-border/70 bg-paper-alt/40 py-4 px-3">
      <div className="flex items-center gap-2 px-2 mb-5">
        <span className="w-5 h-5 rounded bg-ink flex items-center justify-center">
          <span className="w-2 h-2.5 border-x border-t border-white/80" />
        </span>
        <span className="text-[12.5px] font-medium text-ink">Pilar</span>
      </div>

      {NAV.map((item) => {
        const selecionado = item.nome === ativo;
        return (
          <div key={item.nome} className="relative px-2 py-[7px] rounded-lg">
            {selecionado && (
              <m.span
                className="absolute inset-0 rounded-lg bg-white border border-paper-border/70"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.28, ease: EASE.out }}
              />
            )}
            <span
              className={`relative flex items-center gap-2 text-[11.5px] ${
                selecionado ? "text-ink font-medium" : "text-ink-muted"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  item.grupo === "obra" ? "bg-modulo-obra-strong/50" : "bg-modulo-gestao-strong/50"
                }`}
              />
              {item.nome}
            </span>
          </div>
        );
      })}

      <div className="mt-6 px-2 pt-4 border-t border-paper-border/60">
        <p className="text-[8.5px] uppercase tracking-[0.12em] text-ink-muted mb-2">Este mês</p>
        <p className="text-[15px] font-medium text-ink tabular-nums">R$ 412.900</p>
        <p className="text-[9.5px] text-modulo-gestao-strong">+18% sobre julho</p>
      </div>
    </div>
  );
}

/* ── Tela 1: funil de leads ──────────────────────────────────────────── */

function CartaoLead({ titulo, valor, className = "" }: { titulo: string; valor: string; className?: string }) {
  return (
    <div className={`rounded-lg bg-white border border-paper-border/70 px-2.5 py-2 shadow-sm ${className}`}>
      <p className="text-[10.5px] text-ink leading-tight mb-1">{titulo}</p>
      <p className="text-[9.5px] text-ink-muted tabular-nums">{valor}</p>
    </div>
  );
}

export function TelaFunil({ ato }: { ato: number }) {
  const moveu = ato >= idx("funil");

  return (
    <div className="relative h-full" style={{ padding: CONTENT_X }}>
      <p className="text-[8.5px] uppercase tracking-[0.14em] text-ink-muted">Gestão · Comercial</p>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[19px] font-medium text-ink tracking-tight">Funil de leads</h3>
        <span className="text-[10px] px-3 py-1.5 rounded-full bg-brand text-ink-on-brand font-medium">Novo lead</span>
      </div>

      <div className="relative" style={{ height: 420 }}>
        {COLUNAS.map((coluna, i) => {
          const total =
            coluna.cards.length +
            (coluna.nome === "Proposta" && !moveu ? 1 : 0) +
            (coluna.nome === "Ganho" && moveu ? 1 : 0);

          return (
            <div key={coluna.nome} className="absolute top-0" style={{ left: colX(i), width: COL_LARGURA }}>
              <div className="flex items-center gap-1.5 mb-2.5">
                <span className={`w-1.5 h-1.5 rounded-full ${coluna.cor}`} />
                <span className="text-[9px] uppercase tracking-[0.1em] text-ink-muted">{coluna.nome}</span>
                <m.span
                  key={`${coluna.nome}-${total}`}
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: EASE.out }}
                  className="ml-auto text-[9px] text-ink-muted tabular-nums"
                >
                  {total}
                </m.span>
              </div>

              <div className="flex flex-col gap-2 rounded-lg bg-paper-alt/50 border border-paper-border/40 p-2 min-h-[300px]">
                {/* Vaga reservada do lead que o agente move: sem ela, a coluna
                    "pula" quando o card sai de cima dela. */}
                {coluna.nome === "Proposta" && <span className="h-[46px] shrink-0" />}
                {coluna.cards.map((c) => (
                  <CartaoLead key={c.titulo} {...c} />
                ))}
              </div>
            </div>
          );
        })}

        {/* O lead herói vive fora das colunas para poder atravessar a tela. */}
        <m.div
          className="absolute z-10"
          style={{ top: LISTA_TOP - 54, width: COL_LARGURA - 16 }}
          animate={{ x: moveu ? colX(3) + 8 : colX(1) + 8, y: moveu ? [0, -26, 0] : 0 }}
          transition={{ duration: 0.85, ease: EASE.inOut, y: { duration: 0.85, times: [0, 0.5, 1] } }}
        >
          <m.div
            animate={{
              rotate: moveu ? [0, -2.5, 0] : 0,
              borderColor: moveu ? "hsl(var(--modulo-gestao-strong))" : "hsl(var(--border-landing) / 0.7)",
            }}
            transition={{ duration: 0.85, ease: EASE.inOut }}
            className="rounded-lg bg-white border px-2.5 py-2 shadow-[0_8px_22px_-10px_rgba(0,0,0,0.28)]"
          >
            <p className="text-[10.5px] text-ink leading-tight mb-1">{LEAD_HEROI.titulo}</p>
            <div className="flex items-center justify-between">
              <p className="text-[9.5px] text-ink-muted tabular-nums">{LEAD_HEROI.valor}</p>
              <m.span
                className="text-[8px] px-1.5 py-0.5 rounded-full bg-brand text-ink-on-brand font-medium"
                animate={{ opacity: moveu ? 1 : 0, scale: moveu ? 1 : 0.7 }}
                transition={{ duration: 0.3, delay: moveu ? 0.55 : 0 }}
              >
                Ganho
              </m.span>
            </div>
          </m.div>
        </m.div>
      </div>
    </div>
  );
}

/* ── Tela 2: financeiro ──────────────────────────────────────────────── */

function Contador({ alvo, prefixo = "", ligado }: { alvo: number; prefixo?: string; ligado: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
    if (!ligado) {
      el.textContent = `${prefixo}0`;
      return;
    }
    let raf = 0;
    const inicio = performance.now();
    const duracao = 1100;
    const tick = (agora: number) => {
      const p = Math.min(1, (agora - inicio) / duracao);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = `${prefixo}${fmt.format(Math.round(alvo * eased))}`;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [alvo, prefixo, ligado]);

  return <span ref={ref} className="tabular-nums" />;
}

const BARRAS = [38, 52, 44, 67, 58, 82];

export function TelaFinanceiro({ ato }: { ato: number }) {
  const ligado = ato >= idx("financeiro");

  return (
    <div className="h-full" style={{ padding: CONTENT_X }}>
      <p className="text-[8.5px] uppercase tracking-[0.14em] text-ink-muted">Gestão · Financeiro</p>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[19px] font-medium text-ink tracking-tight">Agosto de 2026</h3>
        <span className="text-[10px] px-2.5 py-1 rounded-full bg-paper-alt border border-paper-border/70 text-ink-muted">
          Competência
        </span>
      </div>

      <div className="flex gap-3 mb-5">
        {[
          { rotulo: "Recebido no mês", valor: 412900, tom: "text-modulo-gestao-strong" },
          { rotulo: "A receber", valor: 268300, tom: "text-ink" },
          { rotulo: "Saldo em conta", valor: 194450, tom: "text-ink" },
        ].map((k, i) => (
          <m.div
            key={k.rotulo}
            className="flex-1 rounded-xl bg-white border border-paper-border/70 px-3.5 py-3"
            animate={{ y: ligado ? 0 : 10, opacity: ligado ? 1 : 0 }}
            transition={{ duration: 0.45, delay: i * 0.08, ease: EASE.out }}
          >
            <p className="text-[9px] uppercase tracking-[0.1em] text-ink-muted mb-1.5">{k.rotulo}</p>
            <p className={`text-[21px] font-medium tracking-tight ${k.tom}`}>
              <Contador alvo={k.valor} prefixo="R$ " ligado={ligado} />
            </p>
          </m.div>
        ))}
      </div>

      <div className="rounded-xl bg-white border border-paper-border/70 p-4" style={{ height: 268 }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-medium text-ink">Entradas e saídas</p>
          <div className="flex items-center gap-3 text-[9px] text-ink-muted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-modulo-gestao-strong" /> Receita
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-paper-border" /> Despesa
            </span>
          </div>
        </div>

        <div className="flex items-end gap-5 h-[188px]">
          {BARRAS.map((altura, i) => (
            <div key={i} className="flex-1 flex flex-col justify-end gap-1.5 h-full">
              <m.span
                className="w-full rounded-t bg-modulo-gestao-strong origin-bottom"
                style={{ height: `${altura}%` }}
                animate={{ scaleY: ligado ? 1 : 0 }}
                transition={{ duration: 0.7, delay: 0.15 + i * 0.06, ease: EASE.out }}
              />
              <m.span
                className="w-full rounded-b bg-paper-border origin-top"
                style={{ height: `${altura * 0.42}%` }}
                animate={{ scaleY: ligado ? 1 : 0 }}
                transition={{ duration: 0.7, delay: 0.22 + i * 0.06, ease: EASE.out }}
              />
              <span className="text-[8.5px] text-ink-muted text-center">
                {["mar", "abr", "mai", "jun", "jul", "ago"][i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Tela 3: margem do projeto ───────────────────────────────────────── */

export function TelaProjeto({ ato }: { ato: number }) {
  const ligado = ato >= idx("projeto");

  return (
    <div className="h-full" style={{ padding: CONTENT_X }}>
      <p className="text-[8.5px] uppercase tracking-[0.14em] text-ink-muted">Projetos · Rentabilidade</p>
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[19px] font-medium text-ink tracking-tight">Climatização, centro cirúrgico</h3>
        <m.span
          className="text-[10px] px-2.5 py-1 rounded-full bg-brand text-ink-on-brand font-medium"
          animate={{ opacity: ligado ? 1 : 0, scale: ligado ? 1 : 0.8 }}
          transition={{ duration: 0.4, delay: 0.9, ease: EASE.out }}
        >
          Fechando no azul
        </m.span>
      </div>

      <div className="rounded-xl bg-white border border-paper-border/70 p-4 mb-3">
        <div className="flex items-baseline justify-between mb-3">
          <p className="text-[11px] font-medium text-ink">Margem prevista</p>
          <p className="text-[26px] font-medium text-modulo-gestao-strong tracking-tight tabular-nums">
            <Contador alvo={31} ligado={ligado} />
            ,4%
          </p>
        </div>
        <div className="h-2.5 rounded-full bg-paper-alt overflow-hidden">
          <m.span
            className="block h-full rounded-full bg-modulo-gestao-strong origin-left"
            animate={{ scaleX: ligado ? 0.314 : 0 }}
            transition={{ duration: 1.1, ease: EASE.out }}
            style={{ width: "100%" }}
          />
        </div>
        <div className="flex justify-between mt-2 text-[9px] text-ink-muted">
          <span>Meta do escritório: 25%</span>
          <span className="tabular-nums">Receita R$ 385.200 · Custo R$ 264.100</span>
        </div>
      </div>

      <div className="flex gap-3">
        {[
          ["Estrutural", "Entregue", "100%"],
          ["Elétrico", "Em revisão", "72%"],
          ["Climatização", "Em execução", "45%"],
        ].map(([nome, estado, pct], i) => (
          <m.div
            key={nome}
            className="flex-1 rounded-xl bg-white border border-paper-border/70 px-3.5 py-3"
            animate={{ y: ligado ? 0 : 12, opacity: ligado ? 1 : 0 }}
            transition={{ duration: 0.5, delay: 0.25 + i * 0.09, ease: EASE.out }}
          >
            <p className="text-[11px] font-medium text-ink mb-0.5">{nome}</p>
            <p className="text-[9.5px] text-ink-muted mb-2.5">{estado}</p>
            <div className="h-1.5 rounded-full bg-paper-alt overflow-hidden">
              <m.span
                className="block h-full rounded-full bg-modulo-projetos-strong origin-left"
                style={{ width: "100%" }}
                animate={{ scaleX: ligado ? parseInt(pct, 10) / 100 : 0 }}
                transition={{ duration: 0.9, delay: 0.35 + i * 0.09, ease: EASE.out }}
              />
            </div>
          </m.div>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-dashed border-paper-border px-3.5 py-3 flex items-center gap-2.5">
        <Sparkles className="w-3.5 h-3.5 text-modulo-gestao-strong shrink-0" strokeWidth={1.9} />
        <p className="text-[10.5px] text-ink-soft leading-snug">
          A parcela recebida hoje cobre o custo de projeto até setembro. Sobra de caixa prevista:{" "}
          <span className="text-ink font-medium tabular-nums">R$ 121.100</span>.
        </p>
      </div>
    </div>
  );
}

/* ── Copiloto e rascunho ─────────────────────────────────────────────── */

/**
 * Digitação caractere a caractere. Roda sozinha enquanto o ato é "digita", em
 * vez de derivar do relógio da cena: o relógio só publica marcos, e uma frase
 * de 60 caracteres precisa de 60 atualizações próprias.
 */
function useDigitacao(ligado: boolean, texto: string, msPorChar = 46) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!ligado) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setN(i);
      if (i >= texto.length) window.clearInterval(id);
    }, msPorChar);
    return () => window.clearInterval(id);
  }, [ligado, texto, msPorChar]);

  // Desligado devolve string vazia em vez de zerar `n` por efeito: o contador
  // fica obsoleto por um tique ao religar (~46ms), e em troca o reset não vira
  // um setState no corpo do efeito.
  return ligado ? texto.slice(0, n) : "";
}

export function BarraCopiloto({ ato }: { ato: number }) {
  const digitando = ato === idx("digita");
  const focado = ato >= idx("clicaCopiloto") && ato <= idx("rascunho");
  const cheio = ato > idx("digita") && ato < idx("funil");
  const parcial = useDigitacao(digitando, FRASE);
  const texto = cheio ? FRASE : parcial;

  return (
    <m.div
      className="absolute left-[236px] right-[40px] bottom-[26px] z-20 pointer-events-none"
      animate={{ y: focado ? -2 : 0 }}
      transition={{ duration: 0.3, ease: EASE.out }}
    >
      <m.div
        className="flex items-center gap-2.5 rounded-full bg-white border px-4 py-3"
        animate={{
          borderColor: focado ? "hsl(var(--brand-accent))" : "hsl(var(--border-landing) / 0.8)",
          boxShadow: focado
            ? "0 0 0 4px hsl(var(--brand-accent) / 0.22), 0 10px 34px -14px rgba(0,0,0,0.35)"
            : "0 10px 34px -14px rgba(0,0,0,0.35)",
        }}
        transition={{ duration: 0.35, ease: EASE.out }}
      >
        <Sparkles className="w-4 h-4 text-modulo-gestao-strong shrink-0" strokeWidth={1.9} />
        <span className="text-[12.5px] text-ink leading-none">
          {texto || <span className="text-ink-muted">Peça em português: recebi 128 mil do hospital</span>}
          {digitando && (
            <m.span
              className="inline-block w-[1.5px] h-[13px] align-middle ml-[1px] bg-ink"
              animate={{ opacity: [1, 0, 1] }}
              transition={{ duration: 0.9, repeat: Infinity }}
            />
          )}
        </span>
        <span className="ml-auto shrink-0 w-7 h-7 rounded-full bg-ink flex items-center justify-center">
          <span className="w-2 h-2 border-t-[1.5px] border-r-[1.5px] border-white rotate-[-45deg] -mt-[1px]" />
        </span>
      </m.div>
    </m.div>
  );
}

export function CartaoRascunho({ ato }: { ato: number }) {
  const reducedMotion = useReducedMotion();
  const pensando = ato === idx("pensa");
  const visivel = ato >= idx("rascunho") && ato < idx("funil");
  const aprovado = ato >= idx("confirma") && ato < idx("funil");

  return (
    <>
      <m.div
        className="absolute left-[252px] bottom-[86px] z-20 flex gap-1.5 rounded-full bg-white border border-paper-border/70 px-3 py-2 shadow-sm"
        animate={{ opacity: pensando ? 1 : 0, y: pensando ? 0 : 6 }}
        transition={{ duration: 0.25 }}
      >
        {[0, 1, 2].map((i) => (
          <m.span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-ink-muted"
            animate={{ y: [0, -3.5, 0], opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.14 }}
          />
        ))}
      </m.div>

      <m.div
        className="absolute right-[40px] bottom-[92px] w-[352px] z-20 pointer-events-none rounded-2xl bg-white border border-paper-border p-4 shadow-[0_22px_60px_-24px_rgba(0,0,0,0.4)]"
        animate={{
          opacity: visivel ? 1 : 0,
          y: visivel ? 0 : 22,
          scale: visivel ? 1 : 0.96,
        }}
        transition={{ type: "spring", stiffness: 240, damping: 26, mass: 0.8 }}
      >
        <div className="flex items-center gap-2 mb-3">
          <m.span
            className="w-1.5 h-1.5 rounded-full bg-modulo-gestao-strong"
            animate={reducedMotion ? undefined : { opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="text-[8.5px] uppercase tracking-[0.11em] text-modulo-gestao-strong">
            Rascunho, aguardando aprovação
          </span>
        </div>

        {RASCUNHO.map(([chave, valor], i) => (
          <m.div
            key={chave}
            className="flex justify-between items-center text-[11px] py-[5px] border-b border-paper-border/40 last:border-0"
            animate={{ opacity: visivel ? 1 : 0, x: visivel ? 0 : 8 }}
            transition={{ duration: 0.35, delay: visivel ? 0.18 + i * 0.13 : 0, ease: EASE.out }}
          >
            <span className="text-ink-muted">{chave}</span>
            <span className="text-ink font-medium tabular-nums">{valor}</span>
          </m.div>
        ))}

        <div className="flex gap-2 mt-3.5">
          <m.span
            className="flex-1 text-center text-[10.5px] py-1.5 rounded-full font-medium"
            animate={{
              backgroundColor: aprovado ? "hsl(var(--modulo-gestao-strong))" : "hsl(var(--brand-accent))",
              color: aprovado ? "#ffffff" : "hsl(var(--text-on-brand))",
            }}
            transition={{ duration: 0.3 }}
          >
            {aprovado ? "Gravado no financeiro" : "Confirmar"}
          </m.span>
          <span className="px-3 text-[10.5px] py-1.5 rounded-full border border-paper-border text-ink-muted">
            Editar
          </span>
        </div>
      </m.div>
    </>
  );
}

/* ── Cursor do agente ────────────────────────────────────────────────── */

export function CursorAgente({ ato, x, y, rotulo }: { ato: number; x: number; y: number; rotulo: string | null }) {
  const clicando = ato === idx("clicaCopiloto") || ato === idx("confirma");

  return (
    <m.div
      className="absolute top-0 left-0 z-30 pointer-events-none"
      animate={{ x, y }}
      transition={{ type: "spring", stiffness: 130, damping: 22, mass: 0.85 }}
    >
      <m.span
        className="absolute -top-3 -left-3 w-11 h-11 rounded-full bg-brand/35"
        animate={{ scale: clicando ? [1, 2.1, 1] : 1, opacity: clicando ? [0.65, 0, 0] : 0.28 }}
        transition={{ duration: 0.55, ease: EASE.out }}
      />

      <svg width="20" height="24" viewBox="0 0 20 24" fill="none" className="relative drop-shadow-md">
        <path d="M2 1.6 17.4 12.2 10.4 13 6.6 20.6 2 1.6Z" fill="hsl(var(--text-ink))" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>

      <m.span
        className="absolute left-[18px] top-[18px] whitespace-nowrap rounded-full bg-ink text-white text-[10px] font-medium px-2.5 py-1 shadow-md"
        animate={{ opacity: rotulo ? 1 : 0, scale: rotulo ? 1 : 0.85, x: rotulo ? 0 : -5 }}
        transition={{ duration: 0.28, ease: EASE.out }}
      >
        {rotulo ?? ""}
      </m.span>
    </m.div>
  );
}
