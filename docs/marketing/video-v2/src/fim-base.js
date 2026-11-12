// Fechamento comum: logotipo em traço técnico + convite. tema "light" ou "dark".
import { tl, el, pos, scene, lockup, finalize, EXPO } from "./engine.js";

export function fechamento(t0, dur, { theme = "light", cta = "Veja os planos · link na bio", bg } = {}) {
  const F = scene("fim", t0, dur, { theme });
  if (bg) F.style.background = bg;
  const L = lockup(F, { x: 210, y: 660, w: 660, theme });
  L.draw(t0 + 0.1, { guides: false });
  const c = el("div", "", F);
  pos(c, 230, 960, 620, 100);
  Object.assign(c.style, { position: "absolute", borderRadius: "999px", background: theme === "dark" ? "#A4EC86" : "#1A1A1A", color: theme === "dark" ? "#1A1A1A" : "#fff", font: "600 36px Geist", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0 });
  c.textContent = cta;
  tl.fromTo(c, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.45, ease: EXPO }, t0 + 0.9);
  return F;
}

// Assinatura leve: o símbolo e o @ pequenos no canto, sem cena própria. É o fim padrão dos vídeos
// de conteúdo (educativo, humor, ASMR): o vídeo acaba no conteúdo e volta em loop, como fazem as
// contas de referência. O cartão de fechamento acima fica só para as peças de conversão (planos,
// comece aqui, contagem, novidades). Ver docs/marketing/08-direcao-criativa.md.
export function assinatura(S, t0, { x = 70, y = 1470, color = "var(--fg)", opacity = 0.9 } = {}) {
  const a = el("div", "", S);
  pos(a, x, y);
  Object.assign(a.style, { position: "absolute", display: "flex", alignItems: "center", gap: "16px", font: "600 30px Geist", letterSpacing: "-.01em", color, opacity: 0 });
  a.innerHTML = `<svg viewBox="0 0 27.6 22.6" width="40" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M.8 .8H26.8"/><path d="M2.8 4.8H24.8"/><path d="M6.8 7.8V21.8"/><path d="M13.8 7.8V21.8"/><path d="M20.8 7.8V21.8"/></svg><span>@pilarsoft.app</span>`;
  tl.to(a, { opacity, duration: 0.5 }, t0);
  return a;
}
