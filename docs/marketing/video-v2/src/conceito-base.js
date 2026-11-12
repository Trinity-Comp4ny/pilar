// Vídeos-conceito (9:16, 7 a 9 s, loop): a foto do post-conceito em movimento lento e uma ideia só.
// Sem cartão final (08-direcao-criativa.md): acaba no conteúdo e o Reels volta para o começo.
// Fotos em docs/marketing/posts/fotos/ (4:5); aqui cobrem a tela 9:16 pela altura.
import { tl, W, H, el, pos } from "./engine.js";

// foto de fundo em tela cheia, com aproximação lenta (Ken Burns). foco = ponto da foto (0..1) que fica no centro
export function foto(S, nome, { dur, de = 1.0, para = 1.08, foco = [0.5, 0.5], escurecer = 0 } = {}) {
  const box = el("div", "", S);
  pos(box, 0, 0, W, H);
  Object.assign(box.style, { position: "absolute", overflow: "hidden" });
  const img = el("img", "", box);
  img.src = `../../posts/fotos/${nome}.jpg`;
  const iw = (H * 1024) / 1280; // 1536
  const left = Math.min(0, Math.max(W - iw, W / 2 - foco[0] * iw));
  Object.assign(img.style, { position: "absolute", left: left + "px", top: 0, width: iw + "px", height: H + "px", transformOrigin: `${(W / 2 - left) / iw * 100}% ${foco[1] * 100}%` });
  tl.fromTo(img, { scale: de }, { scale: para, duration: dur, ease: "none", immediateRender: true }, 0);
  if (escurecer) {
    const v = el("div", "", box);
    Object.assign(v.style, { position: "absolute", inset: 0, background: `rgba(8,10,8,${escurecer})` });
  }
  return { box, img, left, k: H / 1280 };
}

// texto solto sobre a foto
export function frase(S, html, { x = 70, y, w = W - 140, size = 96, color = "#1A1A1A", weight = 600, align = "left", sombra = false } = {}) {
  const d = el("div", "", S);
  pos(d, x, y, w);
  Object.assign(d.style, { position: "absolute", font: `${weight} ${size}px/1.03 Geist`, letterSpacing: "-.045em", color, textAlign: align, opacity: 0, textShadow: sombra ? "0 2px 30px rgba(0,0,0,.4)" : "none" });
  d.innerHTML = html;
  return d;
}
export const entra = (n, t, { y = 30, dur = 0.55 } = {}) => tl.fromTo(n, { opacity: 0, y }, { opacity: 1, y: 0, duration: dur, ease: "expo.out" }, t);
