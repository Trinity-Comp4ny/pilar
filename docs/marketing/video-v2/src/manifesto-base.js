// Modelo do Manifesto: tipografia cinética em tela cheia (9:16, 15 s, trilha cinematográfica).
// Inspiração: filmes de marca com uma palavra por batida (Apple, Nike). Sem janela, sem cartão:
// a palavra é a imagem. O fundo troca a cada frase (preto, verde, papel), nunca mais de 1 vez
// por segundo (brand/motion.md §6: nada pisca mais de 3 vezes por segundo).
import { tl, W, H, el, pos, scene, lockup, cue, finalize, EXPO } from "./engine.js";

const B = 0.6; // uma batida a 100 BPM

export function manifestoVideo({ frases, virada, viradaDestaque, fecho = "Gestão com agentes de IA para escritórios de engenharia e arquitetura." }) {
const DUR = 15;

const stage = document.getElementById("stage");
const grain = el("canvas", "", stage);
grain.id = "grain";
grain.width = W / 3;
grain.height = H / 3;
grain.style.zIndex = 90;

// grade técnica no fundo: linhas finas que deslizam devagar
const grid = (parent, color) => {
  const g = el("div", "layer", parent);
  g.style.backgroundImage = `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`;
  g.style.backgroundSize = "90px 90px";
  return g;
};

// uma frase = três palavras, cada uma numa batida, gigante e centralizada
const frase = (t0, words, { bg, fg, accent = null, size = 230 }) => {
  const s = scene("f" + t0, t0, t0 + words.length * B + B * 0.9);
  s.style.background = bg;
  const g = grid(s, fg === "#1A1A1A" ? "rgba(26,26,26,.06)" : "rgba(255,255,255,.06)");
  tl.fromTo(g, { y: 0 }, { y: 90, duration: words.length * B + 1, ease: "none" }, t0);
  words.forEach((w, i) => {
    const d = el("div", "", s);
    Object.assign(d.style, { position: "absolute", left: "0", right: "0", top: 760 + i * (size * 0.95) - ((words.length - 1) * size * 0.95) / 2 + "px", textAlign: "center", font: `600 ${size}px/0.95 Geist`, letterSpacing: "-.055em", color: w === accent ? (bg === "#0C0E0C" ? "#A4EC86" : "#1A1A1A") : fg, fontStyle: w === accent ? "italic" : "normal" });
    // verde só como texto sobre o escuro; no claro e no verde, a palavra vai numa pílula (brand/color.md)
    if (w === accent && bg === "#F7F7F7") d.innerHTML = `<span style="background:#A4EC86;border-radius:.16em;padding:0 .1em">${w}</span>`;
    else if (w === accent && bg === "#A4EC86") d.innerHTML = `<span style="background:#1A1A1A;color:#A4EC86;border-radius:.16em;padding:0 .1em">${w}</span>`;
    else d.textContent = w;
    const t = t0 + i * B;
    if (t === 0) return; // a primeira palavra já está no primeiro quadro (capa e scroll)
    tl.fromTo(d, { opacity: 0, scale: 1.12, filter: "blur(14px)" }, { opacity: 1, scale: 1, filter: "blur(0px)", duration: 0.32, ease: EXPO }, t);
    cue("thud", t);
  });
  return s;
};

frases.forEach((f, i) => frase(i * 2.4, f.words, f));

// virada: uma frase só, maior, no preto
{
  const t0 = 7.2;
  const s = scene("metodo", t0, 10.2);
  s.style.background = "#0C0E0C";
  const a = el("div", "", s);
  Object.assign(a.style, { position: "absolute", left: 0, right: 0, top: "650px", textAlign: "center", font: "500 120px/1 Geist", letterSpacing: "-.04em", color: "rgba(255,255,255,.55)" });
  a.textContent = virada;
  const b = el("div", "", s);
  Object.assign(b.style, { position: "absolute", left: 0, right: 0, top: "800px", textAlign: "center", font: "600 120px/1 Geist", letterSpacing: "-.04em", color: "#fff" });
  b.innerHTML = viradaDestaque.replace(/\*(.+?)\*/, '<span style="background:#A4EC86;color:#1A1A1A;border-radius:.2em;padding:0 .14em;font-style:italic">$1</span>');
  tl.fromTo(a, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, t0 + 0.1);
  tl.fromTo(b, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, t0 + 1.0);
  cue("braam", t0 + 1.0);
}

// fecho: a marca em traço técnico sobre o papel
{
  const t0 = 10.2;
  const s = scene("fim", t0, DUR);
  s.style.background = "#F7F7F7";
  const g = grid(s, "rgba(26,26,26,.05)");
  const L = lockup(s, { x: 210, y: 700, w: 660, theme: "light" });
  L.draw(t0 + 0.1);
  const t = el("div", "", s);
  Object.assign(t.style, { position: "absolute", left: "60px", right: "60px", top: "980px", textAlign: "center", font: "500 52px/1.2 Geist", letterSpacing: "-.03em", color: "#1A1A1A", opacity: 0 });
  t.textContent = fecho;
  tl.fromTo(t, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: EXPO }, t0 + 1.6);
  const c = el("div", "", s);
  pos(c, 230, 1200, 620, 100);
  Object.assign(c.style, { position: "absolute", borderRadius: "999px", background: "#1A1A1A", color: "#fff", font: "600 36px Geist", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0 });
  c.textContent = "Veja os planos · link na bio";
  tl.fromTo(c, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: EXPO }, t0 + 2.2);
}

finalize(DUR, { style: "cinematic", hits: [8.2, 10.2], end: 10.4 });
}
