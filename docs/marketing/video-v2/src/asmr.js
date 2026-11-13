// ASMR do escritório organizado (9:16, 20 s, sem música: só cliques, teclas e o ar da sala).
// Close na tela real, câmera lenta, cursor que clica. Quase sem texto: o som é o conteúdo.
import { tl, W, el, pos, scene, cursor, cue, finalize, EXPO } from "./engine.js";
import { assinatura } from "./fim-base.js";

const DUR = 16.4;
const S = scene("asmr", 0, 16.4, { theme: "light" });
S.style.background = "#EDEDED";
const tag = el("div", "", S);
pos(tag, 70, 150, W - 140);
Object.assign(tag.style, { position: "absolute", font: "500 34px Inter", letterSpacing: ".04em", color: "#555" });
tag.innerHTML = `🎧 Com som. <span style="color:#999">Uma proposta virando projeto.</span>`;
// painéis em tela quase cheia, um por vez, com a câmera bem perto (close)
const PX = 20, PY = 260, PW = 1040, PH = 1360;
const frame = (r) => {
  const sc = Math.min(PW / r.w, PH / r.h);
  let tx = PW / 2 - (r.x + r.w / 2) * sc, ty = PH / 2 - (r.y + r.h / 2) * sc;
  tx = Math.min(0, Math.max(PW - 1440 * sc, tx));
  ty = Math.min(0, Math.max(PH - 900 * sc, ty));
  return { x: tx, y: ty, scale: sc };
};
const passos = [
  ["propostas", { x: 312, y: 330, w: 760, h: 380 }, { x: 312, y: 420, w: 520, h: 260 }, 0.2],
  ["projetos", { x: 560, y: 60, w: 600, h: 520 }, { x: 640, y: 180, w: 420, h: 360 }, 4.4],
  ["projeto", { x: 900, y: 120, w: 520, h: 360 }, { x: 1150, y: 180, w: 270, h: 200 }, 8.4],
  ["financeiro", { x: 300, y: 220, w: 760, h: 300 }, { x: 300, y: 230, w: 420, h: 220 }, 12.2],
];
const cur = cursor(S);
passos.forEach(([still, r0, r1, t], i) => {
  const p = el("div", "", S);
  pos(p, PX, PY, PW, PH);
  Object.assign(p.style, { position: "absolute", overflow: "hidden", borderRadius: "28px", background: "#fff", boxShadow: "0 40px 80px -40px rgba(0,0,0,.35)" });
  const img = el("img", "", p);
  img.src = `../stills/${still}.jpg`;
  Object.assign(img.style, { position: "absolute", left: 0, top: 0, width: "1440px", height: "900px", transformOrigin: "0 0" });
  const fim = i + 1 < passos.length ? passos[i + 1][3] : 16.4;
  tl.set(p, { opacity: 0 }, 0);
  tl.set(img, frame(r0), 0);
  tl.to(p, { opacity: 1, duration: 0.35 }, t);
  tl.to(img, { ...frame(r1), duration: 3.4, ease: "power1.inOut" }, t + 0.3);
  if (i + 1 < passos.length) tl.set(p, { opacity: 0 }, fim + 0.36);
  const cx = PX + PW / 2, cy = PY + PH / 2;
  cur.move(t + 1.0, cx + 60, cy + 40, 1.2, { x: cx + 300, y: cy + 420 });
  cur.click(t + 2.6, cx + 60, cy + 40);
  cue("type", t + 1.6, { dur: 0.6 });
  if (i) cue("shutter", t);
});
cur.hide(15.8);
assinatura(S, 0.2, { y: 208, color: "#555" });
finalize(DUR, { style: "foley" });
