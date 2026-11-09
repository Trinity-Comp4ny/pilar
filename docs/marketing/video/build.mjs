// Builds one HyperFrames project per cut from cuts.mjs: voiceover (edge-tts pt-BR), music bed,
// audio mix and index.html (scenes, takes with camera moves, captions), all from one timeline.
// Usage: node build.mjs <cutId|all>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { CUTS } from './cuts.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const REPO = path.resolve(ROOT, '../../..');
const TTS = process.env.EDGE_TTS || path.join(ROOT, '.venv/bin/edge-tts');
const VOICE = 'pt-BR-AntonioNeural';
const TAKE_W = 1440;
const TAKE_H = 900;

const run = (cmd, args) => execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
const dur = (f) => parseFloat(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]));
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const r3 = (n) => Math.round(n * 1000) / 1000;

// ---------------------------------------------------------------- shared assets
function prepareShared() {
  const S = path.join(ROOT, 'shared');
  fs.mkdirSync(path.join(S, 'takes'), { recursive: true });
  // takes padded by cloning the last frame, so a scene longer than its take holds still
  for (const f of fs.readdirSync(path.join(ROOT, 'takes')).filter((n) => n.endsWith('.mp4'))) {
    const out = path.join(S, 'takes', f);
    if (fs.existsSync(out)) continue;
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', path.join(ROOT, 'takes', f), '-vf', 'tpad=stop_mode=clone:stop_duration=12',
      '-c:v', 'libx264', '-crf', '17', '-preset', 'medium', '-pix_fmt', 'yuv420p', out]);
  }
  // original music bed: slow maj7 pad + soft arpeggio, 16 s loop
  const music = path.join(S, 'bed.wav');
  if (!fs.existsSync(music)) {
    const raw = path.join(S, 'bed-raw.wav');
    run('python3', [path.join(ROOT, 'music.py'), raw]);
    run('ffmpeg', ['-loglevel', 'error', '-y', '-i', raw, '-af', 'lowpass=f=2400,aecho=0.8:0.7:120|260:0.25|0.15,volume=1.6', '-ac', '2', music]);
  }
  return S;
}

function tts(text, file) {
  if (fs.existsSync(file)) return;
  run(TTS, ['--voice', VOICE, '--rate=+4%', '--text', text, '--write-media', file]);
}

// ---------------------------------------------------------------- timeline
function plan(cut, voDir) {
  let t = 0;
  let n = 0;
  const lines = [];
  const scenes = cut.scenes.map((sc, i) => {
    const start = t;
    let cursor = start + (sc.lead ?? 0.35);
    const vo = (sc.vo || []).map((text) => {
      const id = `l${String(++n).padStart(2, '0')}`;
      const file = path.join(voDir, `${id}.mp3`);
      tts(text, file);
      const d = dur(file);
      const line = { id, text, file, start: r3(cursor), dur: r3(d) };
      cursor += d + (sc.gap ?? 0.28);
      lines.push(line);
      return line;
    });
    const spoken = cursor - start + (sc.tail ?? 0.3);
    const d = r3(Math.max(sc.min ?? 0, spoken));
    t += d;
    return { ...sc, i, start: r3(start), dur: d, vo };
  });
  return { scenes, lines, total: r3(t) };
}

// split a voice line into caption chunks of up to maxWords, timed by character share
function chunks(line, maxWords) {
  const words = line.text.split(/\s+/);
  const groups = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    if (cur.length >= maxWords || /[.,:?!]$/.test(w) && cur.length >= Math.ceil(maxWords / 2)) { groups.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) groups.push(cur.join(' '));
  const total = groups.reduce((a, g) => a + g.length, 0);
  let t = line.start;
  return groups.map((g) => { const d = (line.dur * g.length) / total; const c = { text: g, start: r3(t), dur: r3(d) }; t += d; return c; });
}

// ---------------------------------------------------------------- audio mix
function mix(cut, p, outDir, S) {
  const out = path.join(outDir, 'assets', 'mix.wav');
  const inputs = ['-stream_loop', '-1', '-i', path.join(S, 'bed.wav')];
  const parts = [];
  p.lines.forEach((l, k) => {
    inputs.push('-i', l.file);
    const ms = Math.round(l.start * 1000);
    parts.push(`[${k + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms}[v${k}]`);
  });
  const T = p.total;
  const voMix = `${p.lines.map((_, k) => `[v${k}]`).join('')}amix=inputs=${p.lines.length}:normalize=0,apad=whole_dur=${T}[vo]`;
  const fade = Math.max(0, T - 2.2);
  const graph = [
    ...parts,
    voMix,
    '[vo]asplit=2[vo1][vo2]',
    `[0:a]atrim=0:${T},volume=${cut.musicGain ?? 0.55},afade=t=in:d=1.2,afade=t=out:st=${fade}:d=2[bed]`,
    '[bed][vo1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[duck]',
    '[duck][vo2]amix=inputs=2:normalize=0,loudnorm=I=-15:TP=-1.5:LRA=11[out]',
  ].join(';');
  run('ffmpeg', ['-loglevel', 'error', '-y', ...inputs, '-filter_complex', graph, '-map', '[out]', '-t', String(T), '-ar', '48000', out]);
}

// ---------------------------------------------------------------- html
function layout(cut) {
  if (cut.w > cut.h) {
    return { vp: { x: 210, y: 92, w: 1500, h: 937.5 }, chrome: 34, cap: { y: 966, size: 38, words: 9 }, title: 92, hookY: null };
  }
  return { vp: { x: 40, y: 540, w: 1000, h: 640 }, chrome: 30, cap: { y: 1214, size: 50, words: 5 }, title: 104, hookY: 230, vertical: true };
}

// camera: focus {cx, cy, w} in take CSS px -> transform of the 1440x900 video inside the viewport
function cam(L, f) {
  const fw = L.vertical ? (f.vw ?? Math.round(f.w * 0.6)) : f.w;
  const z = L.vp.w / fw;
  let x = L.vp.w / 2 - f.cx * z;
  let y = L.vp.h / 2 - f.cy * z;
  // keep the take covering the viewport
  x = Math.min(0, Math.max(L.vp.w - TAKE_W * z, x));
  y = Math.min(0, Math.max(L.vp.h - TAKE_H * z, y));
  return { x: r3(x), y: r3(y), scale: r3(z) };
}

function words(text, cls = '') {
  // *word* marks the green pill word (italic); punctuation right after the pill sticks to it
  const out = [];
  for (const part of text.split(/(\*[^*]+\*)/).filter(Boolean)) {
    if (part.startsWith('*')) { out.push(`<span class="w pillw ${cls}"><span class="pill"></span><i>${esc(part.slice(1, -1))}</i></span>`); continue; }
    const m = part.match(/^([.,:;?!]+)(.*)$/s);
    if (m && out.length) { out[out.length - 1] = `<span class="nw">${out[out.length - 1]}<span class="w punct">${esc(m[1])}</span></span>`; }
    const rest = m && out.length ? m[2] : part;
    for (const w of rest.split(/\s+/).filter(Boolean)) out.push(`<span class="w ${cls}">${esc(w)}</span>`);
  }
  return out.join(' ').replace(/<span class="w ">\|<\/span>/g, '<br/>');
}

function html(cut, p) {
  const L = layout(cut);
  const V = cut.w < cut.h;
  const el = [];
  const js = [];
  const ease = 'expo.out';
  let videoN = 0;

  for (const sc of p.scenes) {
    const S = sc.start;
    const id = `s${sc.i}`;
    if (sc.type === 'title') {
      const lines = sc.lines.map((ln, k) => `<div class="tl ${sc.big ? 'big' : ''}" id="${id}l${k}">${words(ln)}</div>`).join('');
      const kicker = sc.kicker ? `<div class="kicker" id="${id}k">${esc(sc.kicker)}</div>` : '';
      el.push(`<section id="${id}" class="clip layer center ${sc.ink ? 'ink' : ''}" data-start="${S}" data-duration="${sc.dur}" data-track-index="1">${kicker}${lines}</section>`);
      if (sc.kicker) js.push(`tl.fromTo('#${id}k',{opacity:0,y:20},{opacity:1,y:0,duration:0.5,ease:'${ease}',immediateRender:false},${S + 0.1});`);
      sc.lines.forEach((_, k) => {
        const at = S + 0.15 + (sc.lineAt?.[k] ?? k * (sc.step ?? 0.55));
        js.push(`tl.fromTo('#${id}l${k} .w',{opacity:0,y:34},{opacity:1,y:0,duration:0.6,stagger:0.06,ease:'${ease}',immediateRender:false},${r3(at)});`);
        if (sc.lines[k].includes('*')) js.push(`tl.fromTo('#${id}l${k} .pill',{scaleX:0},{scaleX:1,duration:0.4,ease:'quint.out',immediateRender:false},${r3(at + 0.5)});`);
      });
    }
    if (sc.type === 'take') {
      const vp = L.vp;
      const vid = `v${++videoN}`;
      const focus = sc.focus || [{ at: 0, cx: 720, cy: 450, w: 1440 }];
      const hook = sc.hook && V ? `<div class="hook" id="${id}h">${words(sc.hook)}</div>` : '';
      const label = sc.label ? `<div class="label" id="${id}lb"><span class="lk">${esc(sc.label[0])}</span><span class="lt">${esc(sc.label[1])}</span></div>` : '';
      el.push(`<section id="${id}" class="clip layer" data-start="${S}" data-duration="${sc.dur}" data-track-index="1">
        ${hook}
        <div class="chrome" style="left:${vp.x}px;top:${vp.y - L.chrome}px;width:${vp.w}px;height:${L.chrome}px"><i></i><i></i><i></i><span>app.pilarsoft.com.br</span></div>
        <div class="frame" style="left:${vp.x}px;top:${vp.y}px;width:${vp.w}px;height:${vp.h}px"></div>
        ${label}
      </section>`);
      el.push(`<video id="${vid}" class="tv" src="assets/takes/${sc.take}.mp4" muted playsinline data-start="${S}" data-duration="${sc.dur}" data-media-start="${sc.from ?? 0.3}" data-track-index="2"></video>`);
      const c0 = cam(L, focus[0]);
      js.push(`tl.set('#${vid}',{x:${c0.x},y:${c0.y},scale:${c0.scale},transformOrigin:'0 0'},0);`);
      js.push(`tl.fromTo('#${vid}',{opacity:0},{opacity:1,duration:0.35,ease:'none',immediateRender:false},${S});`);
      focus.slice(1).forEach((f) => {
        const c = cam(L, f);
        js.push(`tl.to('#${vid}',{x:${c.x},y:${c.y},scale:${c.scale},duration:${f.d ?? 1.1},ease:'power3.inOut'},${r3(S + f.at)});`);
      });
      if (hook) {
        js.push(`tl.fromTo('#${id}h .w',{opacity:0,y:30},{opacity:1,y:0,duration:0.55,stagger:0.05,ease:'${ease}',immediateRender:false},${r3(S + 0.05)});`);
        if (sc.hook.includes('*')) js.push(`tl.fromTo('#${id}h .pill',{scaleX:0},{scaleX:1,duration:0.4,ease:'quint.out',immediateRender:false},${r3(S + 0.5)});`);
      }
      if (label) js.push(`tl.fromTo('#${id}lb',{opacity:0,y:16},{opacity:1,y:0,duration:0.5,ease:'${ease}',immediateRender:false},${r3(S + (sc.labelAt ?? 0.6))});`);
    }
    if (sc.type === 'end') {
      el.push(`<section id="${id}" class="clip layer center" data-start="${S}" data-duration="${sc.dur}" data-track-index="1">
        <svg id="${id}m" class="mark" viewBox="0 0 110.4 90.4" fill="none" stroke="#1A1A1A" stroke-width="6.4" stroke-linecap="round">
          <path d="M3.2 3.2H107.2"/><path d="M11.2 19.2H99.2" stroke-opacity="0.85"/><path class="fl" d="M25.2 31.2V87.2"/><path class="fl" d="M45.2 31.2V87.2"/><path class="fl" d="M65.2 31.2V87.2"/><path class="fl" d="M85.2 31.2V87.2"/>
        </svg>
        <img id="${id}w" class="wordmark" src="assets/img/wordmark.svg" />
        <div class="tag" id="${id}t">${words(sc.tagline)}</div>
        <div class="cta" id="${id}c">${esc(sc.cta)}</div>
        <div class="url" id="${id}u">${esc(sc.url)}</div>
      </section>`);
      js.push(`tl.fromTo('#${id}m path',{strokeDasharray:120,strokeDashoffset:120},{strokeDashoffset:0,duration:0.55,stagger:0.07,ease:'quint.out',immediateRender:false},${r3(S + 0.1)});`);
      js.push(`tl.to('#${id}m .fl',{stroke:'#366B1F',duration:0.3,stagger:0.12},${r3(S + 1.0)});`);
      js.push(`tl.fromTo('#${id}w',{opacity:0,y:14},{opacity:1,y:0,duration:0.5,ease:'${ease}',immediateRender:false},${r3(S + 0.55)});`);
      js.push(`tl.fromTo('#${id}t .w',{opacity:0,y:26},{opacity:1,y:0,duration:0.55,stagger:0.05,ease:'${ease}',immediateRender:false},${r3(S + 0.9)});`);
      js.push(`tl.fromTo('#${id}t .pill',{scaleX:0},{scaleX:1,duration:0.4,ease:'quint.out',immediateRender:false},${r3(S + 1.5)});`);
      js.push(`tl.fromTo(['#${id}c','#${id}u'],{opacity:0,y:16},{opacity:1,y:0,duration:0.5,stagger:0.12,ease:'${ease}',immediateRender:false},${r3(S + 1.7)});`);
    }
  }

  // captions: one track, one element per chunk
  const caps = [];
  p.lines.forEach((l) => chunks(l, L.cap.words).forEach((c) => caps.push(c)));
  const capEl = caps.map((c, k) => `<div id="c${k}" class="clip cap" data-start="${c.start}" data-duration="${c.dur}" data-track-index="3"><span>${esc(c.text)}</span></div>`).join('\n');

  const W = cut.w;
  const H = cut.h;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=${W}, height=${H}" />
<script src="assets/gsap.min.js"></script>
<style>
@font-face { font-family: "Geist"; src: url("assets/fonts/geist-variable.woff2") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "Geist"; src: url("assets/fonts/geist-variable-italic.woff2") format("woff2"); font-weight: 100 900; font-style: italic; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${W}px; height: ${H}px; overflow: hidden; background: #FCFCFC; }
#root { position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Geist", sans-serif; color: #1A1A1A; -webkit-font-smoothing: antialiased; }
.bg { position: absolute; inset: 0; background-color: #FCFCFC; background-image: radial-gradient(rgba(26,26,26,0.09) 1.6px, transparent 1.6px); background-size: 30px 30px; }
.layer { position: absolute; inset: 0; z-index: 3; }
.center { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 0 ${V ? 90 : 160}px ${V ? 520 : 0}px; }
.ink { background: #1A1A1A; color: #FFFFFF; }
.w { display: inline-block; position: relative; }
.pillw { padding: 0 0.16em; margin: 0 0.04em; }
.pillw i { position: relative; font-style: italic; }
.punct { margin-left: 0.04em; }
.nw { display: inline-block; white-space: nowrap; }
.pill { position: absolute; inset: 0.04em 0 -0.02em 0; background: #A4EC86; border-radius: 0.28em; transform-origin: 0 50%; }
.ink .pillw i { color: #1A1A1A; }
.tl { font-size: ${L.title}px; font-weight: 500; letter-spacing: -0.035em; line-height: 1.12; margin: ${V ? 10 : 4}px 0; }
.tl.big { font-size: ${V ? 230 : 220}px; font-weight: 500; letter-spacing: -0.05em; line-height: 1; }
.kicker { font-size: ${V ? 34 : 28}px; font-weight: 500; letter-spacing: 0.08em; text-transform: uppercase; color: #5F6572; margin-bottom: 28px; }
.ink .kicker { color: #A4EC86; }
.hook { position: absolute; left: 90px; right: 90px; top: ${L.hookY ?? 0}px; font-size: 76px; font-weight: 500; letter-spacing: -0.035em; line-height: 1.1; text-align: left; }
.chrome { position: absolute; background: #EDEDED; border: 1px solid #D9D9D9; border-bottom: none; border-radius: 14px 14px 0 0; display: flex; align-items: center; gap: 8px; padding: 0 16px; }
.chrome i { width: 11px; height: 11px; border-radius: 50%; background: #D1D5DB; }
.chrome span { margin-left: 14px; font-size: ${V ? 17 : 15}px; color: #5F6572; }
.frame { position: absolute; border: 1px solid #D9D9D9; border-radius: 0 0 14px 14px; z-index: 5; }
#vp { position: absolute; left: ${L.vp.x}px; top: ${L.vp.y}px; width: ${L.vp.w}px; height: ${L.vp.h}px; overflow: hidden; border-radius: 0 0 14px 14px; z-index: 1; }
.tv { position: absolute; left: 0; top: 0; width: ${TAKE_W}px; height: ${TAKE_H}px; opacity: 0; }
.label { position: absolute; z-index: 6; left: ${V ? 60 : L.vp.x + 36}px; top: ${V ? L.vp.y + L.vp.h - 130 : L.vp.y + 30}px; background: #1A1A1A; color: #fff; border-radius: 16px; padding: ${V ? '18px 26px' : '16px 24px'}; display: flex; flex-direction: column; gap: 6px; text-align: left; max-width: ${V ? 900 : 760}px; }
.label .lk { font-size: ${V ? 24 : 18}px; letter-spacing: 0.08em; text-transform: uppercase; color: #A4EC86; font-weight: 500; }
.label .lt { font-size: ${V ? 40 : 34}px; font-weight: 500; letter-spacing: -0.02em; line-height: 1.15; }
.cap { position: absolute; left: 0; right: 0; top: ${L.cap.y}px; display: flex; justify-content: center; z-index: 9; }
.cap span { background: rgba(26,26,26,0.86); color: #fff; font-size: ${L.cap.size}px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2; padding: 10px 22px; border-radius: 12px; max-width: ${V ? 940 : 1500}px; text-align: center; }
.mark { width: ${V ? 200 : 170}px; height: auto; overflow: visible; }
.wordmark { height: ${V ? 70 : 58}px; margin-top: 30px; }
.tag { margin-top: 48px; font-size: ${V ? 70 : 64}px; font-weight: 500; letter-spacing: -0.035em; line-height: 1.12; }
.cta { margin-top: 48px; background: #A4EC86; color: #1A1A1A; font-size: ${V ? 40 : 32}px; font-weight: 500; padding: 18px 36px; border-radius: 999px; }
.url { margin-top: 22px; font-size: ${V ? 32 : 26}px; color: #5F6572; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${p.total}" data-width="${W}" data-height="${H}">
<div class="bg"></div>
<div id="vp">
${el.filter((e) => e.startsWith('<video')).join('\n')}
</div>
${el.filter((e) => !e.startsWith('<video')).join('\n')}
${capEl}
<audio id="mix" src="assets/mix.wav" data-start="0" data-duration="${p.total}" data-track-index="5" data-volume="1"></audio>
</div>
<script>
const tl = gsap.timeline({ paused: true });
${js.join('\n')}
tl.set({}, {}, ${p.total});
window.__timelines = window.__timelines || {};
window.__timelines['main'] = tl;
</script>
</body>
</html>
`;
}

// ---------------------------------------------------------------- main
function build(cut) {
  const S = prepareShared();
  const out = path.join(ROOT, 'cuts', cut.id);
  const A = path.join(out, 'assets');
  for (const d of ['takes', 'fonts', 'img', 'vo']) fs.mkdirSync(path.join(A, d), { recursive: true });
  const used = new Set(cut.scenes.filter((s) => s.type === 'take').map((s) => s.take));
  for (const t of used) fs.copyFileSync(path.join(S, 'takes', `${t}.mp4`), path.join(A, 'takes', `${t}.mp4`));
  for (const f of ['geist-variable.woff2', 'geist-variable-italic.woff2']) fs.copyFileSync(path.join(REPO, 'apps/marketing/public/fonts', f), path.join(A, 'fonts', f));
  fs.copyFileSync(path.join(REPO, 'brand/assets/logo/pilar-wordmark-ink.svg'), path.join(A, 'img', 'wordmark.svg'));
  fs.copyFileSync(path.join(ROOT, 'vendor/node_modules/gsap/dist/gsap.min.js'), path.join(A, 'gsap.min.js'));
  fs.writeFileSync(path.join(out, 'hyperframes.json'), JSON.stringify({ $schema: 'https://hyperframes.heygen.com/schema/hyperframes.json', paths: { blocks: 'compositions', components: 'compositions/components', assets: 'assets' }, media: { autoProxy: true } }, null, 2));
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ id: `pilar-${cut.id}`, name: cut.name }));
  const p = plan(cut, path.join(A, 'vo'));
  mix(cut, p, out, S);
  fs.writeFileSync(path.join(out, 'index.html'), html(cut, p));
  // subtitles for the platforms that take an .srt
  const ts = (s) => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000); const m = Math.floor(ms / 60000) % 60; const sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  fs.writeFileSync(path.join(out, `${cut.id}.srt`), p.lines.map((l, k) => `${k + 1}\n${ts(l.start)} --> ${ts(l.start + l.dur)}\n${l.text}\n`).join('\n'));
  console.log(`${cut.id}: ${p.total}s, ${p.scenes.length} scenes, ${p.lines.length} lines`);
}

const arg = process.argv[2] || 'all';
for (const cut of CUTS.filter((c) => arg === 'all' || c.id === arg)) build(cut);
