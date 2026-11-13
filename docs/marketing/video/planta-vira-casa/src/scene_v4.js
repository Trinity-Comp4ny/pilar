// ================= OBRA v2 =================
const RIDGE = 4.4, BASE_H = 0.2, BEAM_Y0 = 2.55;
const KP = (RIDGE - WALL_H) / 4.625; // inclinação do telhado
const columns = [[0,0,.25],[3.6,0,.25],[5.6,0,.25],[9,0,.25],[0,4.2,.25],[3.6,4.2,.2],[5.6,4.2,.2],[9,4.2,.25],[3.6,6.3,.2],
  [0,8.1,.25],[9,9.75,.25],[0,12,.25],[3.75,12,.25],[6.1,12,.25],[9,12,.25]];

const clamp = (v, a=0, b=1) => Math.min(b, Math.max(a, v));
const lin = (t, a, b) => clamp((t - a) / (b - a));
const easeIO = (x) => x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x + 2, 3) / 2;
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
const backOut = (x) => { const c1 = 1.7, c3 = c1 + 1; return 1 + c3*Math.pow(x-1,3) + c1*Math.pow(x-1,2); };
const lerp = (a, b, k) => a + (b - a) * k;

// ---------- RENDERER + PÓS ----------
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const renderer = new THREE.WebGLRenderer({ antialias:false, preserveDrawingBuffer:true });
renderer.setSize(W, H_PX); renderer.setPixelRatio(1);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.82;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x15110e);
scene.fog = new THREE.Fog(0x15110e, 50, 95);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
const camera = new THREE.PerspectiveCamera(36, W / H_PX, 0.3, 200);

const hemi = new THREE.HemisphereLight(0xfff6ea, 0x3a3128, 0.55); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1dd, 2.6);
sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.015; sun.shadow.radius = 3;
Object.assign(sun.shadow.camera, { left:-15, right:15, top:15, bottom:-15, near:1, far:70 });
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xbcd4ff, 0.35); fill.position.set(12, 8, -6); scene.add(fill);

const rt = new THREE.WebGLRenderTarget(W, H_PX, { type: THREE.HalfFloatType, samples: 4 });
const composer = new EffectComposer(renderer, rt);
composer.setSize(W, H_PX);
composer.addPass(new RenderPass(scene, camera));
const bokeh = new BokehPass(scene, camera, { focus: 30, aperture: 0.0016, maxblur: 0.006 });
composer.addPass(bokeh);
const bloom = new UnrealBloomPass(new THREE.Vector2(W/2, H_PX/2), 0.3, 0.5, 1.05);
composer.addPass(bloom);
const grade = new ShaderPass({
  uniforms: { tDiffuse:{ value:null }, uTime:{ value:0 }, uVig:{ value:0.9 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + uTime*13.1) * 43758.5453); }
    void main(){ vec4 c = texture2D(tDiffuse, vUv); vec2 d = vUv - .5; d.y *= 1.25;
      float v = smoothstep(.95, .25, length(d)); c.rgb *= mix(1., v, uVig);
      c.rgb += (h(vUv*vec2(1080.,1920.)) - .5) * .018; gl_FragColor = c; }`,
});
composer.addPass(grade);
composer.addPass(new OutputPass());

// ---------- TEXTURAS PROCEDURAIS ----------
const canvasTex = (w, h, draw, rep) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (rep) t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; return t; };
const noiseFill = (g, w, h, base, amp, n, size=2) => { g.fillStyle = base; g.fillRect(0,0,w,h);
  for (let i = 0; i < n; i++) { const v = (rnd() - 0.5) * amp; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(rnd()*w, rnd()*h, size + rnd()*size, size + rnd()*size); } };
const concreteTex = canvasTex(512, 512, (g,w,h) => { noiseFill(g,w,h,'#a7a39c',0.16,9000,2); for (let i=0;i<60;i++){ g.fillStyle='rgba(60,55,50,0.25)'; g.beginPath(); g.arc(rnd()*w,rnd()*h,1+rnd()*2.5,0,7); g.fill(); } }, [1,1]);
const blockTex = canvasTex(256, 128, (g,w,h) => { noiseFill(g,w,h,'#c26a3e',0.22,2500,2); g.strokeStyle='rgba(90,40,20,0.35)'; g.lineWidth=3; g.strokeRect(2,2,w-4,h-4); }, [1,1]);
const plasterTex = canvasTex(512, 512, (g,w,h) => noiseFill(g,w,h,'#f1ece3',0.06,14000,1.5), [3,3]);
const woodTex2 = canvasTex(512, 128, (g,w,h) => { g.fillStyle='#b98757'; g.fillRect(0,0,w,h); for (let i=0;i<40;i++){ g.strokeStyle=`rgba(90,55,30,${0.15+rnd()*0.25})`; g.lineWidth=1+rnd()*2; const y=rnd()*h; g.beginPath(); g.moveTo(0,y); for(let x=0;x<=w;x+=16) g.lineTo(x,y+Math.sin(x*0.02+i)*3); g.stroke(); } }, [1,1]);
const tileTex = canvasTex(256, 256, (g,w,h) => {
  // telha colonial: canais ao longo do caimento (eixo x da textura) e fiadas sobrepostas
  for (let y = 0; y < h; y++) { const p = Math.sin((y / h) * Math.PI * 2); const v = 0.62 + 0.38 * p;
    g.fillStyle = `rgb(${(178*v)|0},${(82*v)|0},${(48*v)|0})`; g.fillRect(0, y, w, 1); }
  const grd = g.createLinearGradient(0,0,w,0); grd.addColorStop(0,'rgba(30,10,5,0.55)'); grd.addColorStop(0.12,'rgba(30,10,5,0)'); grd.addColorStop(1,'rgba(255,220,190,0.08)');
  g.fillStyle = grd; g.fillRect(0,0,w,h);
  for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(${rnd()>0.5?255:0},${rnd()>0.5?200:0},0,${rnd()*0.06})`; g.fillRect(rnd()*w, rnd()*h, 2, 2); }
});
const grassTex = canvasTex(512, 512, (g,w,h) => { g.fillStyle='#4f7a37'; g.fillRect(0,0,w,h);
  for (let i=0;i<26000;i++){ const v=rnd(); g.fillStyle=`rgba(${(60+v*70)|0},${(100+v*70)|0},${(35+v*30)|0},0.55)`; g.fillRect(rnd()*w,rnd()*h,1.5,3+rnd()*3); } }, [5,6]);

const M = {
  concrete: new THREE.MeshStandardMaterial({ map: concreteTex, color:0xffffff, roughness:0.95 }),
  freshConcrete: new THREE.MeshStandardMaterial({ map: concreteTex, color:0x9a968f, roughness:0.75 }),
  steel: new THREE.MeshStandardMaterial({ color:0x5a4a40, metalness:0.75, roughness:0.45 }),
  block: new THREE.MeshStandardMaterial({ map: blockTex, roughness:0.9 }),
  plaster: new THREE.MeshStandardMaterial({ map: plasterTex, color:0xfffaf2, roughness:0.88 }),
  wood: new THREE.MeshStandardMaterial({ map: woodTex2, roughness:0.75 }),
  fascia: new THREE.MeshStandardMaterial({ color:0xf7f4ee, roughness:0.6 }),
};

// mesa de madeira
{
  const t = canvasTex(2048, 2048, (g) => { g.fillStyle = '#4a3324'; g.fillRect(0,0,2048,2048);
    for (let i = 0; i < 520; i++) { const y = rnd()*2048; g.strokeStyle = `rgba(${30+rnd()*40},${18+rnd()*20},${10+rnd()*10},${0.25+rnd()*0.35})`; g.lineWidth = 1 + rnd()*4;
      g.beginPath(); g.moveTo(0,y); for (let x = 0; x <= 2048; x += 32) g.lineTo(x, y + Math.sin(x*0.01 + i)*6); g.stroke(); } });
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(70, 70), new THREE.MeshStandardMaterial({ map:t, roughness:0.7, envMapIntensity:0.12 }));
  desk.rotation.x = -Math.PI/2; desk.position.y = -0.03; desk.receiveShadow = true; scene.add(desk);
}
// papel = Imagem 1 (com pilares desenhados)
const planTex = planTexture();
{
  const g = planTex.image.getContext('2d'); const cx = (x) => (x + 3) * S, cz = (z) => (z + 4) * S;
  for (const [x, z, s] of columns) { g.fillStyle = '#0d0f11'; g.fillRect(cx(x - s/2), cz(z - s/2), s*S, s*S);
    g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx(x-s/2), cz(z-s/2)); g.lineTo(cx(x+s/2), cz(z+s/2)); g.moveTo(cx(x+s/2), cz(z-s/2)); g.lineTo(cx(x-s/2), cz(z+s/2)); g.stroke(); }
  planTex.needsUpdate = true;
}
const paperSide = new THREE.MeshStandardMaterial({ color:0xeeeae2 });
const paper = new THREE.Mesh(new THREE.BoxGeometry(15, 0.02, 20), [paperSide, paperSide, new THREE.MeshStandardMaterial({ map: planTex, color:0xe9e6e0, roughness:0.95, envMapIntensity:0.12 }), paperSide, paperSide, paperSide]);
paper.position.y = -0.01; paper.receiveShadow = true; scene.add(paper);
{ // lápis + escalímetro
  const pencil = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 6, 6), new THREE.MeshStandardMaterial({ color:0xe3b23c, roughness:0.5 })); body.rotation.z = Math.PI/2; pencil.add(body);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 6), new THREE.MeshStandardMaterial({ color:0xe9d2b0 })); tip.rotation.z = -Math.PI/2; tip.position.x = 3.35; pencil.add(tip);
  const lead = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.2, 6), new THREE.MeshStandardMaterial({ color:0x222222 })); lead.rotation.z = -Math.PI/2; lead.position.x = 3.62; pencil.add(lead);
  pencil.traverse(m => { m.castShadow = true; }); pencil.position.set(9.6, 0.16, 6.5); pencil.rotation.y = 0.9; scene.add(pencil);
  const ruler = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 9), new THREE.MeshStandardMaterial({ color:0xf2f2f0, roughness:0.4 }));
  ruler.position.set(-9.4, 0.05, -3); ruler.rotation.y = 0.15; ruler.castShadow = true; scene.add(ruler);
}

const unitBox = new THREE.BoxGeometry(1,1,1);
const mkBox = (mat, cast = true) => { const m = new THREE.Mesh(unitBox, mat); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; };
const wallThk = (w) => w.axis === 'x' ? w.z[1]-w.z[0] : w.x[1]-w.x[0];
const wallLo = (w) => w.axis === 'x' ? w.x[0] : w.z[0], wallHi = (w) => w.axis === 'x' ? w.x[1] : w.z[1];
const wallMid = (w) => w.axis === 'x' ? (w.z[0]+w.z[1])/2 : (w.x[0]+w.x[1])/2;
// posiciona caixa ao longo da parede: a0..a1 no eixo, y0..y1, espessura th
const placeAlong = (m, w, a0, a1, y0, y1, th) => {
  const L = Math.max(0.0001, a1 - a0), hgt = Math.max(0.0001, y1 - y0), c = (a0 + a1) / 2;
  if (w.axis === 'x') { m.position.set(PX(c), (y0+y1)/2, PZ(wallMid(w))); m.scale.set(L, hgt, th); }
  else { m.position.set(PX(wallMid(w)), (y0+y1)/2, PZ(c)); m.scale.set(th, hgt, L); }
};
const colsOnWall = (w) => columns.filter(([x, z]) => w.axis === 'x' ? Math.abs(z - (w.z[0]+w.z[1])/2) < 0.05 && x >= w.x[0]-0.2 && x <= w.x[1]+0.2
  : Math.abs(x - (w.x[0]+w.x[1])/2) < 0.05 && z >= w.z[0]-0.2 && z <= w.z[1]+0.2).map(([x, z, s]) => (w.axis === 'x' ? x : z));

// ---------- 1. LINHAS DE LUZ ----------
const GLOW = new THREE.Color(0x3d8bff);
const glowObjs = walls.map((w, i) => {
  const mat = new THREE.MeshBasicMaterial({ color:GLOW, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
  const halo = new THREE.MeshBasicMaterial({ color:GLOW, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
  const a = new THREE.Mesh(unitBox, mat), b = new THREE.Mesh(unitBox, halo); scene.add(a); scene.add(b);
  return { w, i, a, b, mat, halo };
});
const colGlow = columns.map(([x, z, s], j) => { const mat = new THREE.MeshBasicMaterial({ color:0x7fb2ff, transparent:true, opacity:0, blending:THREE.AdditiveBlending, depthWrite:false });
  const m = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 24), mat); m.rotation.x = -Math.PI/2; m.position.set(PX(x), 0.02, PZ(z)); scene.add(m); return { m, mat, j }; });

// ---------- 2. BALDRAME ----------
const baldrames = walls.map((w, i) => ({ w, i, m: mkBox(M.concrete) }));

// ---------- 3. PILARES: armadura + concreto ----------
const barGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 5);
const bars = new THREE.InstancedMesh(barGeo, M.steel, columns.length * 4 + walls.length * 4); bars.castShadow = true;
const stirrups = new THREE.InstancedMesh(unitBox, M.steel, 6000); stirrups.castShadow = false;
scene.add(bars); scene.add(stirrups);
const colObjs = columns.map(([x, z, s], j) => ({ x, z, s, j, conc: mkBox(M.freshConcrete), form: null }));
const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
const setInst = (im, idx, px, py, pz, sx, sy, sz, rot) => { tmpP.set(px, py, pz); tmpS.set(sx, sy, sz); if (rot) tmpQ.setFromEuler(rot); else tmpQ.identity(); tmpM.compose(tmpP, tmpQ, tmpS); im.setMatrixAt(idx, tmpM); };
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
const Z90 = new THREE.Euler(0, 0, Math.PI/2), X90 = new THREE.Euler(Math.PI/2, 0, 0);

// ---------- 4. ALVENARIA (blocos cerâmicos, fiada por fiada) ----------
const COURSES = 12, CH = (BEAM_Y0 - BASE_H) / COURSES, BL = 0.4;
const blockList = []; const vergas = [];
walls.forEach((w, wi) => {
  const lo = wallLo(w), hi = wallHi(w), th = wallThk(w) - 0.05, cols = colsOnWall(w);
  const colIv = columns.filter(([x, z]) => cols.includes(w.axis === 'x' ? x : z) && (w.axis === 'x' ? Math.abs(z - (w.z[0]+w.z[1])/2) < 0.05 : Math.abs(x - (w.x[0]+w.x[1])/2) < 0.05))
    .map(([x, z, s]) => { const c = w.axis === 'x' ? x : z; return [c - s/2, c + s/2]; });
  const fillCourse = (y0, y1, ivs, c, gable) => {
    // ivs: intervalos excluídos; preencher [lo,hi]
    const ex = ivs.slice().sort((a,b) => a[0]-b[0]); const free = []; let cur = lo;
    for (const [a, b] of ex) { if (a > cur) free.push([cur, Math.min(a, hi)]); cur = Math.max(cur, b); }
    if (cur < hi) free.push([cur, hi]);
    const off = (c % 2) * BL / 2;
    for (const [a, b] of free) {
      const k0 = Math.floor((a - lo + off) / BL), k1 = Math.ceil((b - lo + off) / BL);
      for (let k = k0; k < k1; k++) { const s0 = Math.max(a, lo - off + k*BL), s1 = Math.min(b, lo - off + (k+1)*BL);
        if (s1 - s0 < 0.06) continue;
        const along = (w.dir > 0 ? (s0 - lo) : (hi - s1)) / (hi - lo);
        blockList.push({ w, wi, a0: s0 + 0.005, a1: s1 - 0.005, y0: y0 + 0.005, y1: y1 - 0.005, th, c, along, gable }); }
    }
  };
  for (let c = 0; c < COURSES; c++) {
    const y0 = BASE_H + c*CH, y1 = y0 + CH; const ivs = colIv.slice();
    for (const o of w.open) { const ob = o.type === 'win' ? o.sill : 0; if (y1 > ob + 0.001 && y0 < o.head - 0.001) ivs.push([o.s, o.e]); }
    fillCourse(y0, y1, ivs, c, false);
  }
  // vergas e contravergas (concreto) nos vãos
  for (const o of w.open) {
    const cTop = Math.ceil((o.head - BASE_H) / CH - 1e-6); const vy1 = BASE_H + cTop * CH;
    const ext = 0.2; vergas.push({ w, wi, a0: Math.max(lo, o.s - ext), a1: Math.min(hi, o.e + ext), y0: o.head, y1: Math.max(vy1, o.head + 0.08), th: th + 0.01, c: cTop - 1, m: mkBox(M.concrete) });
    if (o.type === 'win') { const cB = Math.floor((o.sill - BASE_H) / CH + 1e-6); const sy0 = BASE_H + cB * CH;
      if (o.sill - sy0 > 0.02) vergas.push({ w, wi, a0: o.s, a1: o.e, y0: sy0, y1: o.sill, th: th + 0.01, c: cB, m: mkBox(M.concrete) }); }
  }
  // oitões (empena) nas paredes de topo e frente
  if (w.id === 'topo' || w.id === 'frente') {
    for (let c = 0; c < 8; c++) { const y0 = WALL_H + c*0.2, y1 = y0 + 0.2; const hw = (RIDGE - y1) / (RIDGE - WALL_H) * 4.625; if (hw < 0.15) continue;
      fillCourse(y0, y1, [[lo, 4.5 - hw], [4.5 + hw, hi]], c, true); }
  }
});
const blocks = new THREE.InstancedMesh(unitBox, M.block, blockList.length); blocks.castShadow = blocks.receiveShadow = true; scene.add(blocks);
{ const col = new THREE.Color(); blockList.forEach((b, i) => { const v = 0.82 + rnd()*0.3; col.setRGB(v, v*(0.93 + rnd()*0.08), v*(0.9 + rnd()*0.1)); blocks.setColorAt(i, col); }); }
blockList.forEach((b) => { b.t0 = b.gable ? 5.55 + b.c*0.09 + b.along*0.15 + (b.w.id === 'frente' ? 0.05 : 0)
  : 2.75 + b.c*0.185 + b.along*0.28 + b.wi*0.025; });

// ---------- 5. VIGAS (cinta) ----------
const beams = walls.map((w, i) => ({ w, i, m: mkBox(M.freshConcrete) }));

// ---------- 6. REBOCO ----------
const plasterPieces = [];
walls.forEach((w, i) => {
  const th = wallThk(w) + 0.04;
  for (const s of solidSegments(w)) plasterPieces.push({ w, i, a0:s.s, a1:s.e, y0:BASE_H, y1:WALL_H, th, m: mkBox(M.plaster) });
  for (const o of w.open) { if (o.type === 'win') plasterPieces.push({ w, i, a0:o.s, a1:o.e, y0:BASE_H, y1:o.sill, th, m: mkBox(M.plaster) });
    plasterPieces.push({ w, i, a0:o.s, a1:o.e, y0:o.head, y1:WALL_H, th, m: mkBox(M.plaster) }); }
});
const gables = ['topo', 'frente'].map((id) => { const w = walls.find(v => v.id === id);
  const sh = new THREE.Shape(); sh.moveTo(-4.645, 0); sh.lineTo(4.645, 0); sh.lineTo(0, RIDGE - WALL_H - 0.01); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: wallThk(w) + 0.04, bevelEnabled:false }); geo.translate(0, 0, -(wallThk(w) + 0.04)/2);
  const m = new THREE.Mesh(geo, M.plaster); m.castShadow = m.receiveShadow = true; m.position.set(PX(4.5), WALL_H, PZ(wallMid(w))); m.visible = false; scene.add(m); return { m, id }; });
// peitoris de granito
const sills = []; walls.forEach((w) => w.open.forEach((o) => { if (o.type !== 'win') return; const m = mkBox(new THREE.MeshStandardMaterial({ color:0x55524f, roughness:0.35 }));
  placeAlong(m, w, o.s - 0.05, o.e + 0.05, o.sill - 0.03, o.sill, wallThk(w) + 0.12); m.visible = false; sills.push(m); }));

// ---------- 7. ESQUADRIAS ----------
const glassMat = new THREE.MeshPhysicalMaterial({ color:0x8fb4d0, metalness:0.0, roughness:0.04, transparent:true, opacity:0, envMapIntensity:1.6, emissive:0xffb060, emissiveIntensity:0 });
const frameMat = new THREE.MeshStandardMaterial({ color:0x24272a, roughness:0.35, metalness:0.6 });
const doorMat = new THREE.MeshStandardMaterial({ map: woodTex2, color:0xb07a4c, roughness:0.55 });
const openings = [];
walls.forEach((w) => w.open.forEach((o) => {
  const r = segRect(w, o.s, o.e); const g = new THREE.Group(); const len = o.e - o.s;
  if (o.type === 'win') {
    const hgt = o.head - o.sill;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(len, hgt, 0.02), glassMat); glass.position.y = o.sill + hgt/2; g.add(glass);
    const fr = (wx, hy, px, py) => { const m = new THREE.Mesh(new THREE.BoxGeometry(wx, hy, 0.06), frameMat); m.position.set(px, py, 0); m.castShadow = true; g.add(m); };
    fr(len, 0.05, 0, o.sill + 0.025); fr(len, 0.05, 0, o.head - 0.025); fr(0.05, hgt, -len/2 + 0.025, o.sill + hgt/2); fr(0.05, hgt, len/2 - 0.025, o.sill + hgt/2);
    if (len > 1.5) fr(0.04, hgt, 0, o.sill + hgt/2);
    g.position.set(PX((r.x0+r.x1)/2), 0, PZ((r.z0+r.z1)/2)); if (w.axis === 'z') g.rotation.y = Math.PI/2;
  } else {
    const d = doorGeom(w, o);
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.045, o.head - BASE_H - 0.02, len - 0.04), doorMat); leaf.castShadow = true;
    leaf.position.set(PX((d.hx + d.lx)/2) + (w.axis === 'x' ? (o.hinge === 's' ? 0.03 : -0.03) : 0), BASE_H + (o.head - BASE_H - 0.02)/2, PZ((d.hz + d.lz)/2));
    if (w.axis === 'z') leaf.rotation.y = Math.PI/2; g.add(leaf);
  }
  g.visible = false; scene.add(g); openings.push({ g, w, o });
}));

// ---------- 8. PISOS + MÓVEIS ----------
const woodFloor = canvasTex(512, 512, (g) => { for (let i = 0; i < 16; i++) { const v = 190 + rnd()*30; g.fillStyle = `rgb(${v},${v*0.76|0},${v*0.54|0})`; g.fillRect(0, i*32, 512, 32);
  g.fillStyle = 'rgba(80,50,30,0.35)'; g.fillRect(0, i*32, 512, 2); g.fillRect((rnd()*512)|0, i*32, 2, 32); } });
const tileFloor = canvasTex(256, 256, (g) => { g.fillStyle = '#e6e3de'; g.fillRect(0,0,256,256); g.strokeStyle = '#b9b5ae'; g.lineWidth = 3; for (let i = 0; i <= 256; i += 64) { g.beginPath(); g.moveTo(i,0); g.lineTo(i,256); g.moveTo(0,i); g.lineTo(256,i); g.stroke(); } });
const floors = [];
const addFloor = (x, z, tex, delay) => { const t = tex.clone(); t.needsUpdate = true; t.repeat.set((x[1]-x[0]) / (tex === woodFloor ? 2.4 : 1.6), (z[1]-z[0]) / (tex === woodFloor ? 2.4 : 1.6));
  const m = new THREE.Mesh(new THREE.BoxGeometry(x[1]-x[0], 0.04, z[1]-z[0]), new THREE.MeshStandardMaterial({ map:t, roughness:0.55 }));
  m.position.set(PX((x[0]+x[1])/2), BASE_H - 0.02, PZ((z[0]+z[1])/2)); m.receiveShadow = true; m.visible = false; scene.add(m); floors.push({ m, delay }); };
// contrapiso (concreto) que sobe até o nível do baldrame antes do piso
const subfloor = mkBox(M.concrete, false); subfloor.visible = false;
addFloor(rooms[0].x, rooms[0].z, woodFloor, 0); addFloor(rooms[1].x, rooms[1].z, tileFloor, 0.08); addFloor(rooms[2].x, rooms[2].z, woodFloor, 0.16); addFloor(socialFloor.x, socialFloor.z, woodFloor, 0.24);
const furnObjs = furniture.map((f, k) => {
  const g = new THREE.Group(); const w = f.x[1]-f.x[0], d = f.z[1]-f.z[0];
  const mk = (sx, sy, sz, px, py, pz, color) => { const m = new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color, roughness:0.7 })); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); m.castShadow = m.receiveShadow = true; g.add(m); };
  if (f.kind === 'bed') { mk(w, 0.3, d, 0, 0.15, 0, 0x8c6a4f); mk(w-0.06, 0.22, d-0.1, 0, 0.41, 0.03, f.color); mk(w-0.3, 0.12, 0.42, 0, 0.58, -d/2+0.33, 0xffffff); mk(w, 1.0, 0.08, 0, 0.5, -d/2+0.04, 0x6b5240); mk(w-0.04, 0.05, d*0.55, 0, 0.545, d*0.2, 0x9aa7b4); }
  else if (f.kind === 'sofa') { mk(w, f.h, d, 0, f.h/2, 0, f.color); mk(0.22, 0.85, d, -w/2+0.11, 0.425, 0, f.color); mk(w, 0.62, 0.18, 0, 0.31, -d/2+0.09, f.color); mk(w, 0.62, 0.18, 0, 0.31, d/2-0.09, f.color); }
  else { mk(w, f.h, d, 0, f.h/2, 0, f.color); if (f.top) mk(w+0.02, 0.04, d+0.02, 0, f.h+0.02, 0, f.top); }
  g.position.set(PX((f.x[0]+f.x[1])/2), BASE_H, PZ((f.z[0]+f.z[1])/2)); g.scale.y = 0.001; g.visible = false; scene.add(g); return { g, k };
});

// ---------- 9. TELHADO: tesouras, terças, telhas ----------
const roofTopY = (dx) => WALL_H + 0.15 + KP * (4.625 - Math.abs(dx)); // topo dos caibros; dx = distância ao eixo da cumeeira
const EAVE = 5.225, Z0 = -0.125 - 0.45, Z1 = 12.125 + 0.45;
const beamBetween = (g, x1, y1, x2, y2, wdt, dep, mat) => { const m = new THREE.Mesh(unitBox, mat); const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
  m.scale.set(L, dep, wdt); m.position.set((x1+x2)/2, (y1+y2)/2, 0); m.rotation.z = Math.atan2(dy, dx); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
const trusses = [];
for (let k = 0; k <= 12; k++) {
  const zz = k === 0 ? 0.2 : k === 12 ? 11.8 : k; const g = new THREE.Group();
  const ey = roofTopY(EAVE) - 0.075, ry = roofTopY(0) - 0.075;
  beamBetween(g, -EAVE, ey, 0, ry, 0.06, 0.15, M.wood); beamBetween(g, EAVE, ey, 0, ry, 0.06, 0.15, M.wood);
  if (k > 0 && k < 12) {
    beamBetween(g, -4.625, WALL_H + 0.04, 4.625, WALL_H + 0.04, 0.06, 0.08, M.wood);
    beamBetween(g, 0, WALL_H + 0.08, 0, ry - 0.06, 0.06, 0.1, M.wood);
    for (const sgn of [-1, 1]) beamBetween(g, 0, WALL_H + 0.25, sgn * 2.4, roofTopY(2.4) - 0.14, 0.05, 0.08, M.wood);
  }
  g.position.set(PX(4.5), 0, PZ(zz)); g.visible = false; scene.add(g); trusses.push({ g, k });
}
const purlins = [];
for (const sgn of [-1, 1]) for (const dx of [0.15, 1.4, 2.7, 4.0, 5.1]) { const m = mkBox(M.wood); purlins.push({ m, sgn, dx }); m.visible = false; }
const THETA = Math.atan(KP), SLOPE_L = EAVE / Math.cos(THETA), NSTRIP = 10, STRIP_W = SLOPE_L / NSTRIP;
const tileMat = new THREE.MeshStandardMaterial({ map: tileTex, bumpMap: tileTex, bumpScale: 2.5, roughness:0.7, color:0xffffff });
tileMat.map.repeat.set(STRIP_W / 0.42, (Z1 - Z0) / 0.2); tileMat.map.wrapS = tileMat.map.wrapT = THREE.RepeatWrapping;
const strips = [];
for (const sgn of [-1, 1]) for (let r = 0; r < NSTRIP; r++) {
  const sc = (r + 0.5) * STRIP_W, dx = EAVE - sc * Math.cos(THETA), y = roofTopY(dx) + 0.06 + 0.035;
  const m = new THREE.Mesh(new THREE.BoxGeometry(STRIP_W + 0.06, 0.07, Z1 - Z0), [M.fascia, M.fascia, tileMat, M.fascia, tileMat, tileMat]);
  m.castShadow = m.receiveShadow = true; m.rotation.z = sgn < 0 ? THETA : -THETA;
  m.userData.base = new THREE.Vector3(PX(4.5 + sgn * dx), y, PZ((Z0 + Z1)/2 + 6) - 6 + 0); m.position.copy(m.userData.base); m.visible = false; scene.add(m); strips.push({ m, sgn, r });
}
const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, Z1 - Z0, 10, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color:0xa4502c, roughness:0.7 }));
ridge.rotation.x = Math.PI/2; ridge.rotation.y = Math.PI/2; ridge.position.set(PX(4.5), roofTopY(0) + 0.1, PZ((Z0+Z1)/2)); ridge.castShadow = true; ridge.visible = false; scene.add(ridge);
const fascias = [];
for (const sgn of [-1, 1]) { const m = mkBox(M.fascia); m.position.set(PX(4.5 + sgn * (EAVE + 0.03)), roofTopY(EAVE) + 0.02, PZ((Z0+Z1)/2)); m.scale.set(0.04, 0.24, Z1 - Z0); m.visible = false; fascias.push(m); }
for (const zz of [Z0, Z1]) for (const sgn of [-1, 1]) { const g = new THREE.Group(); beamBetween(g, sgn * (EAVE + 0.05), roofTopY(EAVE) + 0.02, 0, roofTopY(0) + 0.05, 0.04, 0.24, M.fascia);
  g.position.set(PX(4.5), 0, PZ(zz)); g.visible = false; scene.add(g); fascias.push(g); }

// ---------- 10. PAISAGISMO ----------
const lawnShape = new THREE.Shape(); { const w = 6.7, z0 = -8.6, z1 = 7.1, r = 1.2;
  lawnShape.moveTo(-w + r, z0); lawnShape.lineTo(w - r, z0); lawnShape.quadraticCurveTo(w, z0, w, z0 + r); lawnShape.lineTo(w, z1 - r); lawnShape.quadraticCurveTo(w, z1, w - r, z1);
  lawnShape.lineTo(-w + r, z1); lawnShape.quadraticCurveTo(-w, z1, -w, z1 - r); lawnShape.lineTo(-w, z0 + r); lawnShape.quadraticCurveTo(-w, z0, -w + r, z0); }
const lawnGeo = new THREE.ShapeGeometry(lawnShape); lawnGeo.rotateX(Math.PI/2);
{ const uv = lawnGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 13.4, uv.getY(i) / 15.7); }
const lawn = new THREE.Mesh(lawnGeo, new THREE.MeshStandardMaterial({ map: grassTex, roughness:0.95, side:THREE.DoubleSide })); lawn.receiveShadow = true; lawn.position.y = 0.006; lawn.visible = false; scene.add(lawn);
const walk = []; // calçada perimetral
for (const [x0, x1, z0, z1] of [[-0.8, 9.8, -0.8, -0.125], [-0.8, 9.8, 12.125, 12.8], [-0.8, -0.125, -0.125, 12.125], [9.125, 9.8, -0.125, 12.125], [3.7, 5.1, 12.8, 13.1]]) {
  const m = mkBox(new THREE.MeshStandardMaterial({ map: concreteTex, color:0xd8d4cc, roughness:0.9 }), false); m.position.set(PX((x0+x1)/2), 0.025, PZ((z0+z1)/2)); m.scale.set(x1-x0, 0.05, z1-z0); m.visible = false; walk.push(m); }
const greens = [0x4e7d3a, 0x5f8f45, 0x3f6b30, 0x6e9c4f];
const mkTree = (x, z, s, k) => { const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.5, 7), new THREE.MeshStandardMaterial({ color:0x5e4130, roughness:0.9 })); trunk.position.y = 0.75; trunk.castShadow = true; g.add(trunk);
  for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + rnd()*0.35, 1), new THREE.MeshStandardMaterial({ color: greens[(i + k) % 4], roughness:0.85, flatShading:true }));
    c.position.set((rnd()-0.5)*1.0, 1.7 + rnd()*0.9, (rnd()-0.5)*1.0); c.castShadow = true; g.add(c); }
  g.position.set(x, 0, z); g.scale.setScalar(0.001); g.visible = false; scene.add(g); return { g, s, k }; };
const trees = [[-5.7, -7.4, 1.1], [5.8, -6.8, 0.9], [5.9, 1.5, 1.15], [-5.9, 3.0, 0.85], [-5.6, -2.2, 0.7]].map(([x, z, s], k) => mkTree(x, z, s, k));
const bushes = [[-3.6, 7.2], [-2.6, 7.3], [1.6, 7.2], [2.6, 7.3], [3.6, 7.2], [-5.4, 6.3], [5.4, 6.4], [-5.3, -4.9], [5.4, -3.8]].map(([x, z], k) => {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), new THREE.MeshStandardMaterial({ color: greens[k % 4], roughness:0.9, flatShading:true }));
  m.position.set(x, 0.25, z); m.scale.set(1, 0.75, 1); m.castShadow = true; m.visible = false; scene.add(m); return { m, k }; });
// luzes internas
const lamps = [[1.8, 2.2], [7.3, 2.2], [6.3, 8.0], [1.8, 7.0]].map(([x, z]) => { const l = new THREE.PointLight(0xffb469, 0, 9, 1.6); l.position.set(PX(x), 2.3, PZ(z)); scene.add(l); return l; });

scene.traverse((o) => { if (o.material && !Array.isArray(o.material) && o.material.envMapIntensity === 1 && o.material !== glassMat) o.material.envMapIntensity = 0.35; });
M.steel.envMapIntensity = 1.0; frameMat.envMapIntensity = 1.0;

// ---------- GRUA (sobe do papel, opera o telhado, desce para o papel) ----------
const craneMat = new THREE.MeshStandardMaterial({ color:0xf0b11a, roughness:0.45, metalness:0.35 });
const craneDark = new THREE.MeshStandardMaterial({ color:0x2a2c2e, roughness:0.5, metalness:0.4 });
const CB = new THREE.Vector3(-6.4, 0, -1.6), MH = 8.6, MS = 0.38;
const crane = new THREE.Group(); crane.position.copy(CB); scene.add(crane);
const latticeParts = [];
const strut = (parent, a, b, w, mat = craneMat) => { const m = new THREE.Mesh(unitBox, mat); const d = new THREE.Vector3().subVectors(b, a); const L = d.length();
  m.position.copy(a).addScaledVector(d, 0.5); m.scale.set(w, L, w); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), d.normalize()); m.castShadow = true; parent.add(m); return m; };
// mastro treliçado
for (let y = 0; y < MH; y += 0.5) { const h = MS/2, v = (x, yy, z) => new THREE.Vector3(x, yy, z);
  for (const [x, z] of [[-h,-h],[h,-h],[h,h],[-h,h]]) strut(crane, v(x, y, z), v(x, y + 0.5, z), 0.045);
  strut(crane, v(-h, y, -h), v(h, y + 0.5, -h), 0.022); strut(crane, v(h, y, h), v(-h, y + 0.5, h), 0.022);
  strut(crane, v(-h, y, h), v(-h, y + 0.5, -h), 0.022); strut(crane, v(h, y, -h), v(h, y + 0.5, h), 0.022); }
const slew = new THREE.Group(); slew.position.y = MH; crane.add(slew);
{ const v = (x, y, z) => new THREE.Vector3(x, y, z);
  // lança (12 m) e contralança (3,6 m)
  for (let x = -3.6; x < 12; x += 0.6) { strut(slew, v(x, 0, -0.2), v(x + 0.6, 0, -0.2), 0.04); strut(slew, v(x, 0, 0.2), v(x + 0.6, 0, 0.2), 0.04);
    if (x >= 0) { const top = 0.55 * (1 - x / 13); strut(slew, v(x, top, 0), v(x + 0.6, 0.55 * (1 - (x + 0.6) / 13), 0), 0.035); strut(slew, v(x, 0, -0.2), v(x + 0.3, top, 0), 0.02); strut(slew, v(x + 0.6, 0, 0.2), v(x + 0.3, top, 0), 0.02); } }
  const peak = v(0, 2.0, 0); strut(slew, v(0, 0, 0), peak, 0.08); strut(slew, peak, v(11.5, 0.05, 0), 0.015, craneDark); strut(slew, peak, v(-3.5, 0.05, 0), 0.015, craneDark);
  const cab = new THREE.Mesh(unitBox, craneMat); cab.scale.set(0.5, 0.45, 0.45); cab.position.set(0.35, -0.3, 0.4); cab.castShadow = true; slew.add(cab);
  const cw = new THREE.Mesh(unitBox, M.concrete); cw.scale.set(1.0, 0.7, 0.6); cw.position.set(-3.0, -0.25, 0); cw.castShadow = true; slew.add(cw);
}
const trolley = new THREE.Group(); slew.add(trolley);
{ const t = new THREE.Mesh(unitBox, craneDark); t.scale.set(0.35, 0.12, 0.45); t.position.y = -0.08; trolley.add(t); }
const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1, 4), craneDark); trolley.add(cable);
const hook = new THREE.Group(); trolley.add(hook);
{ const hb = new THREE.Mesh(unitBox, craneMat); hb.scale.set(0.18, 0.22, 0.12); hook.add(hb); hb.castShadow = true;
  const load = new THREE.Group(); load.position.y = -0.55; hook.add(load); hook.userData.load = load;
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(unitBox, M.wood); b.scale.set(3.2, 0.08, 0.12); b.position.set(0, -i * 0.085, (i % 2) * 0.13 - 0.06); b.castShadow = true; load.add(b); }
  for (const sx of [-1, 1]) strut(hook, new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(sx * 1.3, -0.5, 0), 0.008, craneDark); }

// ---------- ANDAIMES (sobem do papel junto da alvenaria e descem antes do reboco) ----------
const scafTube = new THREE.MeshStandardMaterial({ color:0x9aa3ab, roughness:0.35, metalness:0.8 });
const scaffold = new THREE.Group(); scene.add(scaffold);
{ const ring = (off) => [[-off, -off], [9 + off, -off], [9 + off, 12 + off], [-off, 12 + off]];
  const tube = (a, b, w = 0.035) => strut(scaffold, a, b, w, scafTube);
  const v = (x, y, z) => new THREE.Vector3(PX(x), y, PZ(z));
  const runs = [];
  for (const off of [0.5, 1.05]) { const r = ring(off); for (let e = 0; e < 4; e++) { const [x0, z0] = r[e], [x1, z1] = r[(e + 1) % 4]; runs.push({ off, x0, z0, x1, z1 }); } }
  for (const R of runs) { const L = Math.hypot(R.x1 - R.x0, R.z1 - R.z0), n = Math.max(1, Math.round(L / 1.6));
    for (let i = 0; i <= n; i++) { const x = R.x0 + (R.x1 - R.x0) * i / n, z = R.z0 + (R.z1 - R.z0) * i / n; tube(v(x, 0, z), v(x, 3.1, z));
      if (i < n) { const xn = R.x0 + (R.x1 - R.x0) * (i + 1) / n, zn = R.z0 + (R.z1 - R.z0) * (i + 1) / n;
        for (const y of [1.05, 2.05, 3.05]) tube(v(x, y, z), v(xn, y, zn), 0.028);
        if (R.off > 1) tube(v(x, 0.1, z), v(xn, 2.05, zn), 0.022);
        if (R.off < 1) for (const y of [1.08, 2.08]) { const dx = R.x1 - R.x0, dz = R.z1 - R.z0, ln = Math.hypot(dx, dz), nx = -dz / ln, nz = dx / ln;
          const sgn = ((x + nx) - 4.5) * nx + ((z + nz) - 6) * nz > 0 ? 1 : -1; const cx = (x + xn) / 2 + nx * sgn * 0.275, cz = (z + zn) / 2 + nz * sgn * 0.275;
          const p = new THREE.Mesh(unitBox, M.wood); p.position.set(PX(cx), y, PZ(cz)); p.scale.set(Math.abs(dx) > 0.01 ? L / n : 0.55, 0.035, Math.abs(dz) > 0.01 ? L / n : 0.55); p.castShadow = true; scaffold.add(p); } } } }
}

// ---------- POEIRA ----------
const dustTex = canvasTex(128, 128, (g) => { const gr = g.createRadialGradient(64,64,0,64,64,64); gr.addColorStop(0,'rgba(235,225,210,0.9)'); gr.addColorStop(0.5,'rgba(220,210,195,0.35)'); gr.addColorStop(1,'rgba(220,210,195,0)'); g.fillStyle = gr; g.fillRect(0,0,128,128); });
const puffs = [];
const addPuff = (t0, x, y, z, size = 0.8) => { for (let i = 0; i < 3; i++) { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent:true, depthWrite:false, opacity:0, color:0xe8dccb }));
  m.userData = { t0: t0 + i * 0.04, x: x + (rnd() - 0.5) * size * 0.8, y, z: z + (rnd() - 0.5) * size * 0.8, size: size * (0.7 + rnd() * 0.6), drift: (rnd() - 0.5) * 0.4 }; m.visible = false; scene.add(m); puffs.push(m); } };
baldrames.forEach((b) => { const w = b.w, lo = wallLo(w), hi = wallHi(w); for (let k = 0; k < 3; k++) { const a = lo + (hi - lo) * (k + 0.5) / 3;
  const [x, z] = w.axis === 'x' ? [PX(a), PZ(wallMid(w))] : [PX(wallMid(w)), PZ(a)]; addPuff(1.55 + b.i * 0.09 + k * 0.05, x, 0.1, z, 0.9); } });
colObjs.forEach((c) => addPuff(2.7 + c.j * 0.06, PX(c.x), 0.15, PZ(c.z), 0.7));
addPuff(2.85, CB.x, 0.1, CB.z, 1.6); addPuff(3.3, PX(4.5), 0.1, PZ(-0.8), 1.2); addPuff(3.3, PX(4.5), 0.1, PZ(12.8), 1.2);
addPuff(6.95, PX(4.5), 3.0, PZ(6), 1.4);
for (let r = 0; r < NSTRIP; r += 3) for (const sgn of [-1, 1]) addPuff(7.85 + r * 0.075 + 0.25, PX(4.5 + sgn * (EAVE - (r + 0.5) * STRIP_W)), roofTopY(EAVE - (r + 0.5) * STRIP_W) + 0.2, PZ(6), 0.9);

// eventos para a trilha sonora
window.EVENTS = {
  blocks: blockList.map(b => +(b.t0 + 0.2).toFixed(3)),
  baldrame: baldrames.map(b => +(1.6 + b.i * 0.09).toFixed(3)),
  rebar: colObjs.map(c => +(1.9 + c.j * 0.06).toFixed(3)),
  pour: [2.35, 5.3], cols: colObjs.map(c => +(2.9 + c.j * 0.06).toFixed(3)),
  trusses: trusses.map(tr => +(7.3 + tr.k * 0.06).toFixed(3)),
  tiles: strips.map(s => +(7.85 + s.r * 0.075 + (s.sgn > 0 ? 0.04 : 0) + 0.25).toFixed(3)),
  crane: [2.2, 8.5], scaffold: [3.0, 6.0], windows: [6.95], lights: [8.9], grass: [8.55],
};

// ================= VARIAÇÕES v4: laje, chuva, raio-X das disciplinas =================
const LAJE = Q.get('laje') === '1';
const RS = +(Q.get('rs') || 1);

// ---------- LAJE (alternativa ao telhado) ----------
const laje = { props: [], panels: [], mesh: null, slab: null, parapet: [] };
if (LAJE) {
  const propMat = new THREE.MeshStandardMaterial({ color:0x8f989f, roughness:0.4, metalness:0.7 });
  for (let x = 1.0; x < 9; x += 1.6) for (let z = 1.0; z < 12; z += 1.6) { const m = mkBox(propMat); m.position.set(PX(x), 0, PZ(z)); m.visible = false; laje.props.push({ m, x, z }); }
  const ply = new THREE.MeshStandardMaterial({ color:0xc9955f, roughness:0.8 });
  for (let r = 0; r < 6; r++) { const z0 = -0.125 + r * (12.25 / 6); const m = mkBox(ply); m.position.set(PX(4.5), WALL_H + 0.01, PZ(z0 + 12.25 / 12)); m.scale.set(9.25, 0.02, 12.25 / 6 - 0.02); m.visible = false; laje.panels.push({ m, r }); }
  laje.mesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 4), M.steel, 80); scene.add(laje.mesh);
  laje.slab = mkBox(M.freshConcrete); laje.slab.visible = false;
  const par = [[-0.125, 9.125, -0.125, 0.0], [-0.125, 9.125, 12.0, 12.125], [-0.125, 0.0, 0.0, 12.0], [9.0, 9.125, 0.0, 12.0]];
  for (const [x0, x1, z0, z1] of par) { const m = mkBox(M.plaster); m.position.set(PX((x0+x1)/2), 0, PZ((z0+z1)/2)); m.scale.set(Math.max(x1-x0, 0.125), 1, Math.max(z1-z0, 0.125)); m.visible = false; laje.parapet.push(m); }
}
function lajeUpdate(t) {
  trusses.forEach(x => x.g.visible = false); purlins.forEach(p => p.m.visible = false); strips.forEach(s => s.m.visible = false);
  ridge.visible = false; fascias.forEach(f => f.visible = false); gables.forEach(g => g.m.visible = false);
  hook.userData.load.visible = false;
  for (const p of laje.props) { const k = easeOut(lin(t, 6.95 + (p.x + p.z) * 0.01, 7.3 + (p.x + p.z) * 0.01)); p.m.visible = k > 0 && t < 8.7; const h = (WALL_H - BASE_H) * k; p.m.position.y = BASE_H + h / 2; p.m.scale.set(0.05, Math.max(0.001, h), 0.05); }
  for (const p of laje.panels) { const k = lin(t, 7.3 + p.r * 0.07, 7.6 + p.r * 0.07); p.m.visible = k > 0; p.m.position.y = WALL_H + 0.01 + (1 - easeOut(k)) * 1.5; }
  const km = easeIO(lin(t, 7.8, 8.15)); let bi = 0;
  for (let x = 0.15; x < 9; x += 0.3) { if (km > 0) { const L = 12.1 * km; setInst(laje.mesh, bi, PX(x), WALL_H + 0.05, PZ(0) + L/2, 1, L, 1, X90); } else laje.mesh.setMatrixAt(bi, HIDE); bi++; }
  for (let z = 0.2; z < 12 && bi < 80; z += 0.3) { if (km > 0) { const L = 9 * km; setInst(laje.mesh, bi, PX(0) + L/2, WALL_H + 0.07, PZ(z), 1, L, 1, Z90); } else laje.mesh.setMatrixAt(bi, HIDE); bi++; }
  laje.mesh.instanceMatrix.needsUpdate = true; laje.mesh.visible = t < 8.75;
  const kc = easeIO(lin(t, 8.15, 8.6)); laje.slab.visible = kc > 0; const Lz = 12.25 * kc;
  laje.slab.position.set(PX(4.5), WALL_H + 0.08, PZ(12.125) - Lz/2); laje.slab.scale.set(9.25, 0.14, Math.max(0.001, Lz));
  const kp = easeOut(lin(t, 8.55, 8.85)); for (const m of laje.parapet) { m.visible = kp > 0; const h = 0.55 * kp; m.position.y = WALL_H + 0.15 + h/2; m.scale.y = Math.max(0.001, h); }
}

// ---------- CHUVA ----------
const RAIN_N = 5000; const rainPos = new Float32Array(RAIN_N * 6); const rainSeed = [];
for (let i = 0; i < RAIN_N; i++) rainSeed.push([(rnd() - 0.5) * 22, rnd() * 16, (rnd() - 0.5) * 26, 9 + rnd() * 5]);
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color:0xc5d8ea, transparent:true, opacity:0, depthWrite:false });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; scene.add(rain); rain.visible = false;
function rainUpdate(k, time) {
  rain.visible = k > 0.001; if (!rain.visible) return;
  for (let i = 0; i < RAIN_N; i++) { const [x, y0, z, v] = rainSeed[i]; const y = ((y0 - v * time) % 16 + 16) % 16;
    rainPos.set([x, y, z, x + 0.03, y + 0.45, z + 0.02], i * 6); }
  rainGeo.attributes.position.needsUpdate = true; rainMat.opacity = 0.42 * k;
  sun.intensity *= (1 - 0.8 * k); hemi.intensity *= (1 - 0.45 * k); hemi.color.setRGB(lerp(1, 0.7, k), lerp(0.96, 0.78, k), lerp(0.92, 0.9, k));
  scene.background.setRGB(lerp(0.082, 0.05, k), lerp(0.067, 0.055, k), lerp(0.055, 0.06, k));
  M.concrete.roughness = lerp(0.95, 0.35, k); paper.material[2].roughness = lerp(0.95, 0.55, k);
}

// ---------- RAIO-X: disciplinas ----------
const ghostMat = new THREE.MeshStandardMaterial({ color:0xf3f1ec, transparent:true, opacity:1, depthWrite:false, roughness:0.8 });
const archObjs = [];
const pushArch = (o) => o.traverse(m => { if (m.isMesh) { m.userData.orig = m.material; archObjs.push(m); } });
plasterPieces.forEach(p => pushArch(p.m)); gables.forEach(g => pushArch(g.m)); strips.forEach(s => pushArch(s.m)); pushArch(ridge);
fascias.forEach(f => pushArch(f)); sills.forEach(s => pushArch(s)); openings.forEach(o => pushArch(o.g)); floors.forEach(f => pushArch(f.m)); pushArch(subfloor);
const pipeGroups = {};
const mkLayer = (name, color, r, paths, extras = []) => {
  const mat = new THREE.MeshStandardMaterial({ color, roughness:0.35, metalness:0.2, emissive:color, emissiveIntensity:0.6 });
  const segs = [];
  for (const path of paths) { let acc = 0; for (let i = 0; i < path.length - 1; i++) { const a = new THREE.Vector3(PX(path[i][0]), path[i][1], PZ(path[i][2])), b = new THREE.Vector3(PX(path[i+1][0]), path[i+1][1], PZ(path[i+1][2]));
    const L = a.distanceTo(b); const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 1, 8), mat); m.castShadow = true; m.visible = false; scene.add(m);
    segs.push({ m, a, b, L, s0: acc }); acc += L; }
    segs.filter(s => s.pathTotal === undefined).forEach(s => s.pathTotal = acc); }
  const ex = extras.map(([kind, x, y, z, s]) => { const m = kind === 'lamp' ? new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), new THREE.MeshStandardMaterial({ color:0xfff3c4, emissive:0xffe08a, emissiveIntensity:2.2 }))
      : kind === 'tank' ? new THREE.Mesh(new THREE.CylinderGeometry(s, s * 0.9, s * 1.3, 18), new THREE.MeshStandardMaterial({ color:0x2f6fd0, roughness:0.5 }))
      : new THREE.Mesh(unitBox, new THREE.MeshStandardMaterial({ color, roughness:0.5 }));
    if (kind === 'box') m.scale.set(s, s * 1.3, s * 0.4); if (kind === 'pit') m.scale.set(s, s * 0.5, s);
    m.position.set(PX(x), y, PZ(z)); m.visible = false; m.castShadow = true; scene.add(m); return m; });
  pipeGroups[name] = { segs, ex, mat };
};
const CEIL = 2.6;
mkLayer('eletrico', 0xf2c230, 0.045, [
  [[5.3, 1.5, 11.75], [5.3, CEIL, 11.75], [5.3, CEIL, 8.0], [6.3, CEIL, 8.0]],
  [[5.3, CEIL, 8.0], [5.3, CEIL, 7.0], [1.8, CEIL, 7.0]],
  [[5.3, CEIL, 7.0], [5.3, CEIL, 4.6], [1.8, CEIL, 4.6], [1.8, CEIL, 2.2]],
  [[5.3, CEIL, 4.6], [7.3, CEIL, 4.6], [7.3, CEIL, 2.2]],
  [[5.3, CEIL, 4.6], [4.6, CEIL, 4.6], [4.6, CEIL, 2.2]],
  [[6.3, CEIL, 8.0], [8.7, CEIL, 8.0], [8.7, CEIL, 10.4], [8.7, 0.3, 10.4]],
  [[1.8, CEIL, 2.2], [0.3, CEIL, 2.2], [0.3, CEIL, 3.4], [0.3, 0.3, 3.4]],
  [[7.3, CEIL, 2.2], [8.7, CEIL, 2.2], [8.7, CEIL, 3.4], [8.7, 0.3, 3.4]],
  [[1.8, CEIL, 7.0], [0.3, CEIL, 7.0], [0.3, 1.1, 7.0]],
  [[4.6, CEIL, 2.2], [5.4, CEIL, 2.2], [5.4, CEIL, 0.3], [5.4, 1.1, 0.3]],
], [['box', 5.3, 1.5, 11.75, 0.35], ['lamp', 6.3, CEIL - 0.08, 8.0, 0.11], ['lamp', 1.8, CEIL - 0.08, 7.0, 0.11], ['lamp', 1.8, CEIL - 0.08, 2.2, 0.11], ['lamp', 7.3, CEIL - 0.08, 2.2, 0.11], ['lamp', 4.6, CEIL - 0.08, 2.2, 0.11]]);
mkLayer('hidraulico', 0x2f80ff, 0.06, [
  [[4.6, 3.0, 2.0], [4.6, CEIL - 0.1, 2.0], [4.1, CEIL - 0.1, 2.0], [4.1, CEIL - 0.1, 0.4], [4.1, 0.5, 0.4]],
  [[4.6, CEIL - 0.1, 2.0], [5.1, CEIL - 0.1, 2.0], [5.1, CEIL - 0.1, 0.4], [5.1, 0.9, 0.4]],
  [[4.6, CEIL - 0.1, 2.0], [4.6, CEIL - 0.1, 5.2], [0.4, CEIL - 0.1, 5.2], [0.4, CEIL - 0.1, 6.2], [0.4, 0.95, 6.2]],
  [[8.3, 0.05, 13.4], [8.3, 0.05, 12.4], [8.3, CEIL - 0.1, 12.4], [8.3, CEIL - 0.1, 11.6], [4.6, CEIL - 0.1, 11.6], [4.6, CEIL - 0.1, 5.2]],
], [['tank', 4.6, 3.35, 2.0, 0.5], ['box', 8.3, 0.3, 13.6, 0.35]]);
mkLayer('sanitario', 0x8d7b68, 0.085, [
  [[4.1, 0.22, 0.6], [3.0, 0.22, 0.6], [3.0, 0.22, 13.3]],
  [[5.1, 0.22, 0.45], [5.1, 0.22, 1.0], [3.0, 0.22, 1.0]],
  [[0.45, 0.22, 6.5], [3.0, 0.22, 6.5]],
  [[3.0, 0.22, 0.6], [3.0, 4.6, 0.6]],
], [['pit', 3.0, 0.15, 13.6, 0.6]]);

function layerGrow(name, k, dim = 1) {
  const g = pipeGroups[name]; g.mat.opacity = dim; g.mat.transparent = dim < 1;
  for (const s of g.segs) { const len = k * s.pathTotal - s.s0; if (len <= 0) { s.m.visible = false; continue; }
    const L = Math.min(s.L, len); const dir = new THREE.Vector3().subVectors(s.b, s.a).normalize(); const end = s.a.clone().addScaledVector(dir, L);
    s.m.visible = true; s.m.position.copy(s.a).add(end).multiplyScalar(0.5); s.m.scale.set(1, L, 1); s.m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir); }
  for (const m of g.ex) m.visible = k > 0.95;
}
function ghost(op) {
  for (const m of archObjs) { if (op >= 0.999) { m.material = m.userData.orig; } else { m.material = ghostMat; } }
  ghostMat.opacity = op;
}
// linha do tempo do raio-X (xt em segundos)
function xrayBefore(xt) {
  const toGhost = easeIO(lin(xt, 2.0, 2.8)), back = easeIO(lin(xt, 11.4, 12.2));
  ghost(lerp(lerp(1, 0.07, toGhost), 0.2, back));
  const roofOff = easeIO(lin(xt, 4.0, 4.4)) * (1 - easeIO(lin(xt, 11.4, 12.2)));
  trusses.forEach(x => x.g.visible = roofOff < 0.5); purlins.forEach(p => p.m.visible = roofOff < 0.5);
  for (const a of archObjs) if (strips.some(s => s.m === a) || a === ridge) a.visible = roofOff < 0.5;
  lamps.forEach(l => l.intensity = 0); glassMat.emissiveIntensity = 0;
  layerGrow('eletrico', easeIO(lin(xt, 4.3, 6.1)));
  layerGrow('hidraulico', easeIO(lin(xt, 6.7, 8.5)));
  layerGrow('sanitario', easeIO(lin(xt, 9.1, 10.7)));
  blocks.visible = toGhost < 0.5;
}

// ---------- CÂMERA (keyframes suaves) ----------
// [t, polar, azimute, raio, alvoX, alvoY, alvoZ]
const KEYS = [
  [0.0, 0.002, 0.00, 47, 0, 0.0, 1.6],
  [0.9, 0.06,  0.05, 41, 0, 0.0, 1.3],
  [2.3, 0.86,  0.55, 25, 0, 0.6, 0.6],
  [3.8, 1.04,  0.05, 21.5, 0, 1.0, 0.6],
  [5.3, 0.98, -0.85, 24, 0, 1.3, 0.0],
  [6.8, 0.78, -1.25, 30, 0, 1.8, 0.0],
  [8.4, 0.98, -0.80, 37, 0, 2.0, 0.3],
  [10.0, 1.13, -0.40, 44, 0, 1.8, 0.7],
  [12.6, 1.15, -0.28, 41.5, 0, 1.8, 0.7],
];
function camAt(t) {
  let i = 0; while (i < KEYS.length - 2 && t > KEYS[i+1][0]) i++;
  const k0 = KEYS[Math.max(0, i-1)], k1 = KEYS[i], k2 = KEYS[i+1], k3 = KEYS[Math.min(KEYS.length-1, i+2)];
  const u = clamp((t - k1[0]) / (k2[0] - k1[0])); const dt = k2[0] - k1[0];
  const out = [];
  for (let c = 1; c < 7; c++) {
    const m1 = (k2[c] - k0[c]) / (k2[0] - k0[0] || 1) * dt * (i === 0 ? 0 : 1);
    const m2 = (k3[c] - k1[c]) / (k3[0] - k1[0] || 1) * dt * (i + 2 >= KEYS.length ? 0 : 1);
    const u2 = u*u, u3 = u2*u;
    out.push((2*u3 - 3*u2 + 1)*k1[c] + (u3 - 2*u2 + u)*m1 + (-2*u3 + 3*u2)*k2[c] + (u3 - u2)*m2);
  }
  return out;
}

// ---------- LINHA DO TEMPO ----------
function render(t, o = {}) {
  // 1. traço luminoso + marcação dos pilares
  for (const o of glowObjs) {
    const tp = easeIO(lin(t, 0.6 + o.i*0.12, 1.05 + o.i*0.12)); const w = o.w, lo = wallLo(w), hi = wallHi(w);
    const start = w.dir > 0 ? lo : hi, cur = start + w.dir * (hi - lo) * tp;
    const fade = 1 - lin(t, 2.0 + o.i*0.05, 2.9 + o.i*0.05);
    placeAlong(o.a, w, Math.min(start, cur), Math.max(start, cur), 0.006, 0.02, wallThk(w) + 0.04);
    placeAlong(o.b, w, Math.min(start, cur) - 0.15, Math.max(start, cur) + 0.15, 0.004, 0.008, wallThk(w) + 0.6);
    o.mat.opacity = tp > 0 ? fade : 0; o.haloMat = o.halo; o.halo.opacity = tp > 0 ? 0.3 * fade : 0; o.a.visible = o.b.visible = tp > 0 && fade > 0;
  }
  for (const c of colGlow) { const k = lin(t, 1.3 + c.j*0.04, 1.6 + c.j*0.04); const f = 1 - lin(t, 2.4, 3.0); c.mat.opacity = k * f * 0.9; c.m.scale.setScalar(1 + 0.6 * (1 - k)); c.m.visible = k > 0 && f > 0; }
  // 2. baldrame sobe do traço
  for (const b of baldrames) { const k = easeOut(lin(t, 1.25 + b.i*0.09, 1.75 + b.i*0.09)); b.m.visible = k > 0;
    const ext = b.w.axis === 'x' ? 0 : 0; placeAlong(b.m, b.w, wallLo(b.w) - 0.03, wallHi(b.w) + 0.03, 0, Math.max(0.001, BASE_H * k), wallThk(b.w) + 0.08); }
  // 3. pilares: armadura e concreto
  let bi = 0, si = 0;
  for (const c of colObjs) {
    const kc = easeOut(lin(t, 1.85 + c.j*0.06, 2.35 + c.j*0.06)); const hc = (WALL_H - 0.02) * kc; const inset = c.s/2 - 0.035;
    for (const [ox, oz] of [[-1,-1],[1,-1],[1,1],[-1,1]]) { if (kc > 0) setInst(bars, bi, PX(c.x) + ox*inset, hc/2, PZ(c.z) + oz*inset, 1, Math.max(0.001, hc), 1); else bars.setMatrixAt(bi, HIDE); bi++; }
    for (let y = 0.1; y < WALL_H - 0.05; y += 0.15) { const vis = kc > 0 && y < hc;
      for (let e = 0; e < 4; e++) { if (!vis) { stirrups.setMatrixAt(si++, HIDE); continue; } const L = inset*2 + 0.02;
        if (e < 2) setInst(stirrups, si++, PX(c.x), y, PZ(c.z) + (e ? inset : -inset), L, 0.012, 0.012); else setInst(stirrups, si++, PX(c.x) + (e === 3 ? inset : -inset), y, PZ(c.z), 0.012, 0.012, L); } }
    const kk = easeIO(lin(t, 2.35 + c.j*0.06, 2.95 + c.j*0.06)); c.conc.visible = kk > 0;
    c.conc.position.set(PX(c.x), (BEAM_Y0 * kk)/2, PZ(c.z)); c.conc.scale.set(c.s, Math.max(0.001, BEAM_Y0 * kk), c.s);
  }
  // armadura das vigas (4 barras correndo ao longo da parede) + estribos
  for (const b of beams) { const w = b.w, lo = wallLo(w) - 0.1, hi = wallHi(w) + 0.1, L = hi - lo;
    const kr = easeIO(lin(t, 4.9 + b.i*0.05, 5.35 + b.i*0.05)); const start = w.dir > 0 ? lo : hi, cur = start + w.dir * L * kr; const a0 = Math.min(start, cur), a1 = Math.max(start, cur);
    const inset = wallThk(w)/2 - 0.04;
    for (const [oy, ot] of [[0.04,-1],[0.04,1],[0.21,-1],[0.21,1]]) { if (kr <= 0) { bars.setMatrixAt(bi++, HIDE); continue; }
      const c = (a0 + a1)/2, len = Math.max(0.001, a1 - a0);
      if (w.axis === 'x') setInst(bars, bi++, PX(c), BEAM_Y0 + oy, PZ(wallMid(w)) + ot*inset, 1, len, 1, Z90); else setInst(bars, bi++, PX(wallMid(w)) + ot*inset, BEAM_Y0 + oy, PZ(c), 1, len, 1, X90); }
    for (let a = lo + 0.1; a < hi; a += 0.25) { const vis = kr > 0 && a >= a0 && a <= a1 && t < 6.5;
      if (!vis) { stirrups.setMatrixAt(si++, HIDE); stirrups.setMatrixAt(si++, HIDE); continue; }
      for (const oy of [0.04, 0.21]) { if (w.axis === 'x') setInst(stirrups, si++, PX(a), BEAM_Y0 + oy, PZ(wallMid(w)), 0.012, 0.012, inset*2); else setInst(stirrups, si++, PX(wallMid(w)), BEAM_Y0 + oy, PZ(a), inset*2, 0.012, 0.012); } }
    const kb = easeIO(lin(t, 5.3 + b.i*0.05, 5.8 + b.i*0.05)); const cs = w.dir > 0 ? lo : hi, cc = cs + w.dir * L * kb;
    b.m.visible = kb > 0; placeAlong(b.m, w, Math.min(cs, cc), Math.max(cs, cc), BEAM_Y0, WALL_H, wallThk(w) - 0.02);
  }
  while (bi < bars.count) bars.setMatrixAt(bi++, HIDE); while (si < stirrups.count) stirrups.setMatrixAt(si++, HIDE);
  bars.instanceMatrix.needsUpdate = true; stirrups.instanceMatrix.needsUpdate = true;
  // 4. alvenaria: cada bloco cai no lugar
  blockList.forEach((b, i) => { const k = (LAJE && b.gable) ? 0 : lin(t, b.t0, b.t0 + 0.22); if (k <= 0) { blocks.setMatrixAt(i, HIDE); return; }
    const drop = (1 - easeOut(k)) * 0.9; const sq = 1 + 0.12 * Math.sin(Math.PI * clamp((k - 0.7) / 0.3));
    tmpQ.identity(); const L = b.a1 - b.a0, h = (b.y1 - b.y0), c = (b.a0 + b.a1) / 2, y = (b.y0 + b.y1)/2 + drop;
    if (b.w.axis === 'x') { tmpP.set(PX(c), y, PZ(wallMid(b.w))); tmpS.set(L, h / sq, b.th * sq); } else { tmpP.set(PX(wallMid(b.w)), y, PZ(c)); tmpS.set(b.th * sq, h / sq, L); }
    tmpM.compose(tmpP, tmpQ, tmpS); blocks.setMatrixAt(i, tmpM); });
  blocks.instanceMatrix.needsUpdate = true;
  for (const v of vergas) { const t0 = 2.75 + v.c*0.185 + 0.2 + v.wi*0.025; const k = easeOut(lin(t, t0, t0 + 0.25)); v.m.visible = k > 0; placeAlong(v.m, v.w, v.a0, v.a1, v.y0 + (1-k)*0.6, v.y1 + (1-k)*0.6, v.th); }
  // 5/6. reboco sobe cobrindo a estrutura
  for (const p of plasterPieces) { const k = easeIO(lin(t, 6.15 + p.i*0.05, 6.85 + p.i*0.05)); const top = BASE_H + (WALL_H - BASE_H) * k;
    const t1 = Math.min(top, p.y1); if (t1 <= p.y0 + 0.001) { p.m.visible = false; continue; } p.m.visible = true; placeAlong(p.m, p.w, p.a0, p.a1, p.y0, t1, p.th); }
  for (const g of gables) { const k = easeIO(lin(t, 6.75 + (g.id === 'frente' ? 0.1 : 0), 7.15 + (g.id === 'frente' ? 0.1 : 0))); g.m.visible = k > 0; g.m.scale.y = Math.max(0.001, k); }
  for (const s of sills) s.visible = t > 6.9;
  // 7. esquadrias
  const ko = easeOut(lin(t, 6.9, 7.4));
  for (const o of openings) { o.g.visible = ko > 0; o.g.position.y = (1 - ko) * 1.2; }
  glassMat.opacity = 0.38 * ko;
  // 8. contrapiso, piso, móveis
  { const k = easeOut(lin(t, 5.4, 5.8)); subfloor.visible = k > 0; subfloor.position.set(PX(4.5), (BASE_H - 0.04) * k / 2, PZ(6)); subfloor.scale.set(8.75, Math.max(0.001, (BASE_H - 0.04) * k), 11.75); }
  for (const f of floors) f.m.visible = t > 5.8 + f.delay;
  for (const f of furnObjs) { const k = lin(t, 5.95 + f.k*0.06, 6.45 + f.k*0.06); f.g.visible = k > 0; f.g.scale.y = Math.max(0.001, easeOut(k)); }
  // 9. telhado
  for (const tr of trusses) { const t0 = 7.0 + tr.k*0.06; const k = lin(t, t0, t0 + 0.35); tr.g.visible = k > 0; tr.g.position.y = (1 - easeOut(k)) * 2.5; tr.g.rotation.z = (1 - easeOut(k)) * 0.25 * (tr.k % 2 ? 1 : -1); }
  for (const p of purlins) { const k = easeIO(lin(t, 7.6 + p.dx*0.03, 7.95 + p.dx*0.03)); p.m.visible = k > 0; const L = (Z1 - Z0) * k;
    p.m.position.set(PX(4.5 + p.sgn * p.dx), roofTopY(p.dx) + 0.03, PZ(Z0) + L/2); p.m.scale.set(0.05, 0.06, Math.max(0.001, L)); }
  for (const s of strips) { const t0 = 7.85 + s.r*0.075 + (s.sgn > 0 ? 0.04 : 0); const k = lin(t, t0, t0 + 0.28); s.m.visible = k > 0;
    const off = (1 - easeOut(k)) * 1.6; s.m.position.set(s.m.userData.base.x + s.sgn * off * 0.3, s.m.userData.base.y + off, s.m.userData.base.z); }
  ridge.visible = t > 8.75; for (const f of fascias) f.visible = t > 8.7;
  if (LAJE) lajeUpdate(t);
  // 10. paisagismo + luz
  { const k = easeOut(lin(t, 8.55, 9.3)); lawn.visible = k > 0; lawn.scale.set(Math.max(0.001, k), 1, Math.max(0.001, k)); for (const m of walk) m.visible = t > 8.6; }
  for (const tr of trees) { const k = lin(t, 8.75 + tr.k*0.1, 9.3 + tr.k*0.1); tr.g.visible = k > 0; tr.g.scale.setScalar(Math.max(0.001, easeOut(k) * tr.s)); }
  for (const b of bushes) { const k = lin(t, 8.8 + b.k*0.05, 9.2 + b.k*0.05); b.m.visible = k > 0; b.m.scale.set(Math.max(0.001,easeOut(k)), 0.75 * Math.max(0.001,easeOut(k)), Math.max(0.001,easeOut(k))); }
  const kl = easeIO(lin(t, 8.9, 9.8)); lamps.forEach(l => l.intensity = 7 * kl); glassMat.emissiveIntensity = 0.55 * kl;
  // sol: do meio da tarde ao pôr do sol
  const ks = easeIO(lin(t, 5.5, 10));
  sun.position.set(lerp(-11, -15, ks), lerp(18, 9.5, ks), lerp(9, 13, ks)); sun.color.setHSL(lerp(0.09, 0.075, ks), lerp(0.6, 0.85, ks), lerp(0.93, 0.72, ks));
  sun.intensity = lerp(2.7, 3.0, ks); hemi.intensity = lerp(0.6, 0.38, ks);
  // grua
  { const up = easeOut(lin(t, 2.2, 3.0)), down = easeIO(lin(t, 8.45, 9.1));
    crane.position.y = -(MH + 2.6) * (1 - up) - (MH + 2.6) * down; crane.visible = up > 0 && down < 1;
    const A0 = 1.25, AH = -0.245;
    let ang = A0 + 0.25 * Math.sin(t * 0.9);
    const toHouse = easeIO(lin(t, 5.9, 6.6)), away = easeIO(lin(t, 7.8, 8.4));
    ang = lerp(ang, AH, toHouse); ang = lerp(ang, A0 + 0.25 * Math.sin(t * 0.9), away); slew.rotation.y = ang;
    trolley.position.x = lerp(3.0, 6.6, easeIO(lin(t, 6.0, 6.6)));
    const len = 0.8 + (MH - 4.2) * easeIO(lin(t, 6.55, 7.05)) - (MH - 4.2) * easeIO(lin(t, 7.25, 7.7));
    cable.scale.y = len; cable.position.y = -len / 2; hook.position.y = -len; hook.userData.load.visible = t < 7.08;
    hook.rotation.z = 0.04 * Math.sin(t * 3.1) * (1 - lin(t, 6.9, 7.05)); }
  // andaimes
  scaffold.position.y = -3.4 * (1 - easeOut(lin(t, 3.0, 3.6))) - 3.4 * easeIO(lin(t, 5.85, 6.2)); scaffold.visible = t > 3.0 && t < 6.2;
  // concreto molhado secando
  { const k = lin(t, 3.0, 7.5); M.freshConcrete.roughness = lerp(0.28, 0.92, k); M.freshConcrete.color.setRGB(lerp(0.62, 0.86, k), lerp(0.6, 0.84, k), lerp(0.57, 0.8, k)); }
  // poeira
  for (const p of puffs) { const u = p.userData, a = t - u.t0; if (a < 0 || a > 1.1) { p.visible = false; continue; }
    p.visible = true; const q = a / 1.1; p.material.opacity = 0.42 * Math.pow(1 - q, 1.5); const sc = u.size * (0.5 + 1.3 * easeOut(q));
    p.scale.set(sc, sc * 0.7, 1); p.position.set(u.x + u.drift * a, u.y + 0.35 * a, u.z); }

  if (o.rain !== undefined) rainUpdate(o.rain, o.rainTime ?? t); else rain.visible = false;
  if (o.xt !== undefined) xrayBefore(o.xt);
  // câmera
  let [polar, az, radius, tx, ty, tz] = o.cam || camAt(o.camT ?? t); polar = Math.max(0.002, polar); radius *= RS;
  const target = new THREE.Vector3(tx, ty, tz);
  camera.position.set(tx + radius * Math.sin(polar) * Math.sin(az), ty + radius * Math.cos(polar), tz + radius * Math.sin(polar) * Math.cos(az));
  camera.up.set(0, 1, 0); camera.lookAt(target);
  bokeh.uniforms.focus.value = camera.position.distanceTo(target);
  bokeh.uniforms.aperture.value = lerp(0.0004, 0.0016, clamp((polar - 0.1) / 0.7));
  grade.uniforms.uTime.value = t;
  composer.render();
}
window.render = render;
window.grab = (t, q = 0.93, o = {}) => { render(t, o); return renderer.domElement.toDataURL('image/jpeg', q); };
window.ready = true;
