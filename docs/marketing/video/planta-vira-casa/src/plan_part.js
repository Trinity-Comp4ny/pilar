// ---------- RNG determinístico ----------
let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

// ---------- TEXTURA DA PLANTA (Imagem 1) ----------
function planTexture() {
  const c = document.createElement('canvas'); c.width = 15*S; c.height = 20*S;
  const g = c.getContext('2d');
  const cx = (x) => (x + 3) * S, cz = (z) => (z + 4) * S;
  // papel
  g.fillStyle = '#f7f5f0'; g.fillRect(0,0,c.width,c.height);
  for (let i = 0; i < 26000; i++) { const v = 225 + rnd()*30; g.fillStyle = `rgba(${v},${v-4},${v-12},0.25)`; g.fillRect(rnd()*c.width, rnd()*c.height, 2, 2); }
  // malha fina
  g.strokeStyle = 'rgba(70,110,160,0.10)'; g.lineWidth = 2;
  for (let x = 0; x <= 15; x += 0.5) { g.beginPath(); g.moveTo(x*S,0); g.lineTo(x*S,c.height); g.stroke(); }
  for (let z = 0; z <= 20; z += 0.5) { g.beginPath(); g.moveTo(0,z*S); g.lineTo(c.width,z*S); g.stroke(); }
  // margem do desenho
  g.strokeStyle = '#2a2d31'; g.lineWidth = 6; g.strokeRect(0.5*S, 0.5*S, 14*S, 19*S);
  g.lineWidth = 2; g.strokeRect(0.62*S, 0.62*S, 13.76*S, 18.76*S);

  // móveis (traço fino)
  g.strokeStyle = 'rgba(40,44,50,0.55)'; g.lineWidth = 3;
  for (const f of furniture) {
    g.strokeRect(cx(f.x[0]), cz(f.z[0]), (f.x[1]-f.x[0])*S, (f.z[1]-f.z[0])*S);
    if (f.kind === 'bed') { g.strokeRect(cx(f.x[0]+0.15), cz(f.z[0]+0.12), (f.x[1]-f.x[0]-0.3)*S, 0.45*S); }
    if (f.kind === 'sofa') { g.beginPath(); g.moveTo(cx(f.x[0]+0.22), cz(f.z[0])); g.lineTo(cx(f.x[0]+0.22), cz(f.z[1])); g.stroke(); }
  }
  // pisos (hachura leve em áreas molhadas)
  g.strokeStyle = 'rgba(60,90,130,0.16)'; g.lineWidth = 2;
  const tileRect = (r) => { for (let x = r.x[0]; x < r.x[1]; x += 0.4) { g.beginPath(); g.moveTo(cx(x), cz(r.z[0])); g.lineTo(cx(x), cz(r.z[1])); g.stroke(); }
    for (let z = r.z[0]; z < r.z[1]; z += 0.4) { g.beginPath(); g.moveTo(cx(r.x[0]), cz(z)); g.lineTo(cx(r.x[1]), cz(z)); g.stroke(); } };
  tileRect(rooms[1]); tileRect({x:[0.125,3.525], z:[4.275,8.0]});

  // paredes (poché) = exatamente os retângulos usados na extrusão
  for (const w of walls) {
    for (const seg of solidSegments(w)) {
      const r = segRect(w, seg.s, seg.e);
      g.fillStyle = '#26292d'; g.fillRect(cx(r.x0), cz(r.z0), (r.x1-r.x0)*S, (r.z1-r.z0)*S);
    }
    for (const o of w.open) {
      const r = segRect(w, o.s, o.e);
      g.strokeStyle = '#26292d'; g.lineWidth = 3;
      if (o.type === 'win') {
        // janela: faces da parede + duas linhas de vidro
        g.strokeRect(cx(r.x0), cz(r.z0), (r.x1-r.x0)*S, (r.z1-r.z0)*S);
        g.beginPath();
        if (w.axis === 'x') { const m = (r.z0+r.z1)/2; g.moveTo(cx(r.x0), cz(m-0.025)); g.lineTo(cx(r.x1), cz(m-0.025)); g.moveTo(cx(r.x0), cz(m+0.025)); g.lineTo(cx(r.x1), cz(m+0.025)); }
        else { const m = (r.x0+r.x1)/2; g.moveTo(cx(m-0.025), cz(r.z0)); g.lineTo(cx(m-0.025), cz(r.z1)); g.moveTo(cx(m+0.025), cz(r.z0)); g.lineTo(cx(m+0.025), cz(r.z1)); }
        g.stroke();
      } else {
        // porta: folha aberta + arco de giro
        const d = doorGeom(w, o);
        g.lineWidth = 4; g.beginPath(); g.moveTo(cx(d.hx), cz(d.hz)); g.lineTo(cx(d.lx), cz(d.lz)); g.stroke();
        g.lineWidth = 2; g.setLineDash([10,8]); g.beginPath(); g.arc(cx(d.hx), cz(d.hz), d.wd*S, d.a0, d.a1, d.ccw); g.stroke(); g.setLineDash([]);
      }
    }
  }
  // rótulos
  g.fillStyle = '#26292d'; g.textAlign = 'center';
  for (const r of rooms) {
    g.font = `bold ${0.30*S}px "DejaVu Sans"`; g.fillText(r.name, cx(r.lx), cz(r.lz));
    if (r.area) { g.font = `${0.22*S}px "DejaVu Sans"`; g.fillText(r.area, cx(r.lx), cz(r.lz+0.38)); }
  }
  // cotas
  const dimH = (x0, x1, z, label) => { g.strokeStyle = '#3a3e44'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx(x0), cz(z)); g.lineTo(cx(x1), cz(z)); g.stroke();
    for (const x of [x0,x1]) { g.beginPath(); g.moveTo(cx(x), cz(z-0.18)); g.lineTo(cx(x), cz(z+0.18)); g.stroke(); g.beginPath(); g.moveTo(cx(x-0.1), cz(z+0.1)); g.lineTo(cx(x+0.1), cz(z-0.1)); g.stroke(); }
    g.fillStyle = '#26292d'; g.font = `${0.24*S}px "DejaVu Sans"`; g.fillText(label, cx((x0+x1)/2), cz(z-0.12)); };
  const dimV = (z0, z1, x, label) => { g.strokeStyle = '#3a3e44'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(cx(x), cz(z0)); g.lineTo(cx(x), cz(z1)); g.stroke();
    for (const z of [z0,z1]) { g.beginPath(); g.moveTo(cx(x-0.18), cz(z)); g.lineTo(cx(x+0.18), cz(z)); g.stroke(); g.beginPath(); g.moveTo(cx(x-0.1), cz(z+0.1)); g.lineTo(cx(x+0.1), cz(z-0.1)); g.stroke(); }
    g.save(); g.translate(cx(x-0.12), cz((z0+z1)/2)); g.rotate(-Math.PI/2); g.fillStyle = '#26292d'; g.font = `${0.24*S}px "DejaVu Sans"`; g.fillText(label, 0, 0); g.restore(); };
  dimH(-0.125, 9.125, -0.9, '9,25'); dimV(-0.125, 12.125, -0.9, '12,25');
  dimH(-0.125, 3.6, 12.9, '3,60'); dimH(3.6, 5.6, 12.9, '2,00'); dimH(5.6, 9.125, 12.9, '3,40');
  dimV(-0.125, 4.2, 9.9, '4,20'); dimV(4.2, 12.125, 9.9, '7,90');
  // norte
  g.save(); g.translate(cx(10.6), cz(-2.6)); g.strokeStyle = '#26292d'; g.lineWidth = 3; g.beginPath(); g.arc(0,0,0.42*S,0,Math.PI*2); g.stroke();
  g.fillStyle = '#26292d'; g.beginPath(); g.moveTo(0,-0.36*S); g.lineTo(0.14*S,0.2*S); g.lineTo(0,0.1*S); g.lineTo(-0.14*S,0.2*S); g.closePath(); g.fill();
  g.font = `bold ${0.24*S}px "DejaVu Sans"`; g.fillText('N', 0, -0.5*S); g.restore();
  // carimbo
  const bx = cx(-2.2), bz = cz(13.7), bw = 13.4*S, bh = 1.7*S;
  g.strokeStyle = '#26292d'; g.lineWidth = 4; g.strokeRect(bx, bz, bw, bh);
  g.beginPath(); g.moveTo(bx + 8.2*S, bz); g.lineTo(bx + 8.2*S, bz + bh); g.moveTo(bx + 8.2*S, bz + bh/2); g.lineTo(bx + bw, bz + bh/2); g.stroke();
  g.textAlign = 'left'; g.fillStyle = '#26292d';
  g.font = `bold ${0.5*S}px "DejaVu Sans"`; g.fillText('PLANTA BAIXA', bx + 0.35*S, bz + 0.78*S);
  g.font = `${0.24*S}px "DejaVu Sans"`; g.fillText('RESIDÊNCIA UNIFAMILIAR · TÉRREO', bx + 0.35*S, bz + 1.28*S);
  g.font = `${0.22*S}px "DejaVu Sans"`; g.fillText('ESCALA 1:50', bx + 8.5*S, bz + 0.55*S); g.fillText('ÁREA 111,0 m²', bx + 8.5*S, bz + 1.4*S);
  g.fillText('FOLHA 01/01', bx + 11.0*S, bz + 0.55*S); g.fillText('PÉ-DIREITO 2,80', bx + 11.0*S, bz + 1.4*S);

  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function solidSegments(w) {
  const lo = w.axis === 'x' ? w.x[0] : w.z[0], hi = w.axis === 'x' ? w.x[1] : w.z[1];
  const op = [...w.open].sort((a,b) => a.s - b.s); const out = []; let cur = lo;
  for (const o of op) { if (o.s > cur) out.push({ s:cur, e:o.s }); cur = o.e; }
  if (hi > cur) out.push({ s:cur, e:hi }); return out;
}
function segRect(w, s, e) { return w.axis === 'x' ? { x0:s, x1:e, z0:w.z[0], z1:w.z[1] } : { x0:w.x[0], x1:w.x[1], z0:s, z1:e }; }
function doorGeom(w, o) {
  const wd = o.e - o.s; const sw = o.swing; // -1 => abre para -z (ou -x)
  if (w.axis === 'x') {
    const hz = sw < 0 ? w.z[0] : w.z[1]; const hx = o.hinge === 's' ? o.s : o.e;
    const lx = hx, lz = hz + sw * wd; const other = o.hinge === 's' ? o.e : o.s;
    let a0 = Math.atan2(lz - hz, 0), a1 = Math.atan2(0, other - hx);
    return { hx, hz, lx, lz, wd, a0, a1, ccw: (o.hinge === 's') === (sw > 0) };
  }
  const hx = sw < 0 ? w.x[0] : w.x[1]; const hz = o.hinge === 's' ? o.s : o.e;
  return { hx, hz, lx: hx + sw*wd, lz: hz, wd, a0:0, a1:Math.PI/2, ccw:false };
}

// ---------- CENA ----------
