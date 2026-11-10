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
