/* ============ ícones e helpers ============ */
const IC={
  map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>',
  funnel:'<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
  file:'<path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  scan:'<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 12h10"/>',
  building:'<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  calc:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  cart:'<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12L22 7H6"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  eye:'<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  spark:'<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  check:'<path d="m5 12 5 5 9-10"/>',
  x:'<path d="M6 6l12 12M18 6 6 18"/>',
  alert:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/>',
  send:'<path d="m22 2-11 11M22 2l-7 20-4-9-9-4z"/>',
  msg:'<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v4h16v-4"/>',
  cube:'<path d="m12 2 9 5v10l-9 5-9-5V7z"/><path d="m3 7 9 5 9-5M12 12v10"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  cloud:'<path d="M7 18a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 10 4 4 0 0 1 18 18z"/>',
  rain:'<path d="M7 15a5 5 0 1 1 1-9.9A6 6 0 0 1 19.5 7 4 4 0 0 1 18 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
  user:'<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="m16 11 2 2 4-4"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  plan:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 12h9V3M12 12v9M16 12h5"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  photo:'<rect x="3" y="5" width="18" height="15" rx="2"/><circle cx="9" cy="11" r="2"/><path d="m21 17-5-5-9 8"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  play:'<path d="M7 4v16l13-8z"/>',
  hand:'<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V5.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5A6.5 6.5 0 0 1 4 16.5L3 13a1.5 1.5 0 0 1 2.6-1.4L8 14"/>',
  tree:'<path d="M12 22v-6M12 16l-6-1 3-4H7l5-8 5 8h-2l3 4z"/>',
  wave:'<path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  column:'<rect x="9" y="3" width="6" height="18"/><path d="M5 3h14M5 21h14"/>',
  stairs:'<path d="M3 20h5v-5h5v-5h5V5h3"/>'
};
const ic=(n,c='')=>`<svg class="i ${c}" viewBox="0 0 24 24" aria-hidden="true">${IC[n]||''}</svg>`;
const b=(tone,t)=>`<span class="b b-${tone}">${t}</span>`;
const brl=n=>'R$ '+n.toLocaleString('pt-BR',{minimumFractionDigits:n%1?2:0,maximumFractionDigits:2});
const mil=n=>'R$ '+(n/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mil';
const fmt=n=>n.toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:2});
const ORIG={conversa:['highlight','da conversa'],fala:['highlight','da fala'],resp:['info','respondido'],pdf:['info','da planta'],projeto:['proj','pelo projeto'],calc:['neutral','calculado'],tabela:['success','sua tabela'],falta:['warning','falta'],inferido:['attention','inferido, confirme'],regra:['brand','regra do modelo'],cub:['info','CUB-SP set/26'],sinapi:['proj','SINAPI out/26'],empresa:['success','tabela da empresa'],usuario:['highlight','valor do usuário'],definir:['warning','a definir'],ref:['attention','referência provisória'],modelo:['brand','do modelo de obra'],agente:['attention','sugerido, confirme']};
const og=k=>b(ORIG[k][0],ORIG[k][1]);
const agent=(html,who='Agente')=>`<div class="agent"><div class="av">${ic('spark')}</div><div style="min-width:0;flex:1"><div class="xs muted" style="margin-bottom:2px">${who}</div>${html}</div></div>`;

/* ============ estado ============ */
const S={screen:'plano',device:'desktop',state:'cheio',sheet:false,
  lead:'carla',waParsed:false,comTab:'leads',
  prop:0,proposalReplied:false,pa:108,pp:{est:70,ele:40,hid:40},pd:{est:true,ele:true,hid:true,comp:true},neg:0,negOpt:'b',
  tpl:'proposta',
  scan:'idle',scanStep:0,scanView:'original',
  obraView:'cronograma',clima:false,andaime:null,
  progView:'3d',layer:'paredes',floor:'terreo',sobrado:false,colorBy:'etapa',sel:[],selRoom:'sala',selExt:'piscina',apE:0,apP:100,
  campo:'idle',campoView:'3d',rdo:'completo',ans:{room:null,walls:[],pct:100,pessoas:null,material:null,etapa:0},
  orcTab:'estimativa',frete:false,dashPeriod:'tri',dashTable:false};
const SCREENS=[
  {id:'plano',label:'Plano',icon:'map'},
  {id:'inicio',label:'Início',icon:'home'},
  {id:'comercial',label:'Comercial',icon:'funnel'},
  {id:'proposta',label:'Proposta',icon:'file'},
  {id:'modelos',label:'Modelos',icon:'layers'},
  {id:'documentos',label:'Planta',icon:'scan'},
  {id:'obra',label:'Obra',icon:'building',dot:true},
  {id:'campo',label:'Campo',icon:'mic'},
  {id:'orcamento',label:'Orçamento',icon:'calc'},
  {id:'precos',label:'Preços',icon:'chart'},
  {id:'portal',label:'Cliente',icon:'eye'}
];
const MOB=['inicio','proposta','obra','campo'];

/* ============ a casa (dado do projeto) ============ */
const H3=2.8,T3=0.15,FLOOR_H=3.0;
const ROOMS={
  terreo:[
    {id:'sala',nome:'Sala',x0:0,y0:0,x1:6,y1:5,floor:0xf3eee4},
    {id:'cozinha',nome:'Cozinha',x0:6,y0:0,x1:12,y1:5,floor:0xeef1f3},
    {id:'quarto1',nome:'Quarto 1',x0:0,y0:5,x1:4.5,y1:9,floor:0xf1efe9},
    {id:'banho',nome:'Banheiro',x0:4.5,y0:5,x1:7,y1:9,floor:0xe9f0f2},
    {id:'quarto2',nome:'Quarto 2',x0:7,y0:5,x1:12,y1:9,floor:0xf1efe9}],
  superior:[
    {id:'suite',nome:'Suíte',x0:0,y0:0,x1:6,y1:5,floor:0xf1efe9},
    {id:'quarto3',nome:'Quarto 3',x0:6,y0:0,x1:12,y1:5,floor:0xf1efe9},
    {id:'escritorio',nome:'Escritório',x0:0,y0:5,x1:4.5,y1:9,floor:0xf1efe9},
    {id:'banho2',nome:'Banho 2',x0:4.5,y0:5,x1:7,y1:9,floor:0xe9f0f2},
    {id:'quarto4',nome:'Quarto 4',x0:7,y0:5,x1:12,y1:9,floor:0xf1efe9}]
};
const WALLS=[
  {id:'w1',a:[0,0],b:[6,0],nome:'Frente da sala',op:[{t:'door',at:0.6,w:0.9},{t:'win',at:2.6,w:2.2}]},
  {id:'w2',a:[6,0],b:[12,0],nome:'Frente da cozinha',op:[{t:'win',at:2.2,w:1.6}]},
  {id:'w3',a:[12,0],b:[12,5],nome:'Lateral da cozinha',op:[{t:'win',at:1.6,w:1.2}]},
  {id:'w4',a:[12,5],b:[12,9],nome:'Lateral do quarto 2',op:[{t:'win',at:1.2,w:1.5}]},
  {id:'w5',a:[7,9],b:[12,9],nome:'Fundo do quarto 2'},
  {id:'w6',a:[4.5,9],b:[7,9],nome:'Fundo do banheiro',op:[{t:'win',at:0.9,w:0.6}]},
  {id:'w7',a:[0,9],b:[4.5,9],nome:'Fundo do quarto 1',op:[{t:'win',at:1.5,w:1.5}]},
  {id:'w8',a:[0,5],b:[0,9],nome:'Lateral do quarto 1'},
  {id:'w9',a:[0,0],b:[0,5],nome:'Lateral da sala',op:[{t:'win',at:1.6,w:1.6}]},
  {id:'w10',a:[6,0],b:[6,5],nome:'Sala e cozinha',op:[{t:'door',at:3.6,w:0.9}]},
  {id:'w11',a:[0,5],b:[4.5,5],nome:'Sala e quarto 1',op:[{t:'door',at:3.4,w:0.8}]},
  {id:'w12',a:[4.5,5],b:[6,5],nome:'Sala e banheiro',op:[{t:'door',at:0.3,w:0.7}]},
  {id:'w13',a:[6,5],b:[7,5],nome:'Cozinha e banheiro'},
  {id:'w14',a:[7,5],b:[12,5],nome:'Cozinha e quarto 2',op:[{t:'door',at:0.4,w:0.8}]},
  {id:'w15',a:[4.5,5],b:[4.5,9],nome:'Quarto 1 e banheiro'},
  {id:'w16',a:[7,5],b:[7,9],nome:'Banheiro e quarto 2'}
];
const ROOM_WALLS={sala:['w1','w9','w10','w11','w12'],cozinha:['w2','w3','w10','w13','w14'],quarto1:['w7','w8','w11','w15'],banho:['w6','w12','w13','w15','w16'],quarto2:['w4','w5','w14','w16']};
const PILARES=[[0,0],[6,0],[12,0],[0,5],[4.5,5],[6,5],[7,5],[12,5],[0,9],[4.5,9],[7,9],[12,9]];
const EXT=[
  {id:'piscina',nome:'Piscina',x0:13.6,y0:1,x1:17.6,y1:5},
  {id:'jardim',nome:'Jardim',x0:13,y0:6,x1:18.2,y1:9.4}
];
const ETAPAS=['Alvenaria','Chapisco','Reboco','Massa','Pintura'];
const ETCOL=['#c8794f','#8f8a80','#bdb9b0','#e2ded5','#f7f2e6'];
const CONF={relatado:'#f0a92e',confirmado:'#5fb84f'};
/* progresso por parede: e = etapa atual (-1 não iniciada), p = % da etapa, st = relatado|confirmado */
const W0={};
['w4','w5','w6','w8','w15','w16'].forEach(id=>W0[id]={e:0,p:100,st:'confirmado'});
W0.w7={e:1,p:100,st:'confirmado'};
S.W=JSON.parse(JSON.stringify(W0));
const wlen=w=>Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);
const warea=w=>Math.max(0,wlen(w)*H3-(w.op||[]).reduce((s,o)=>s+(o.t==='door'?o.w*2.1:o.w*1.1),0));
const roomsOf=f=>ROOMS[f];
const area=r=>((r.x1-r.x0)*(r.y1-r.y0));
const per=r=>2*((r.x1-r.x0)+(r.y1-r.y0));
const wkey=(id,f)=>f==='superior'?'s'+id:id;

function wallPieces(w){
  const len=wlen(w);let cur=-T3/2;const out=[];
  (w.op||[]).slice().sort((x,y)=>x.at-y.at).forEach(o=>{
    if(o.at>cur) out.push({s:cur,l:o.at-cur,y0:0,y1:H3,k:'solid'});
    if(o.t==='door') out.push({s:o.at,l:o.w,y0:2.1,y1:H3,k:'lintel',o});
    else {out.push({s:o.at,l:o.w,y0:0,y1:1.0,k:'sill',o});out.push({s:o.at,l:o.w,y0:2.1,y1:H3,k:'lintel',o});}
    cur=o.at+o.w;
  });
  out.push({s:cur,l:len+T3/2-cur,y0:0,y1:H3,k:'solid'});
  return out;
}
function wallLook(key,colorBy=S.colorBy){
  const w=S.W[key];
  if(!w||w.e<0) return {c:'#cfcfcf',o:.35,h:.05,none:true};
  const c=colorBy==='etapa'?ETCOL[w.e]:CONF[w.st];
  return {c,o:1,h:w.e===0?Math.max(.05,w.p/100):1};
}

/* ============ planta 2D (SVG) ============ */
function plan2D(o={}){
  const {floor='terreo',mode='clean',progress=true,interactive=false,act='wsel',sel=[],hl=null,layer='paredes',ext=false,colorBy=S.colorBy,hitW=20}=o;
  const K=40,P=46,WM=ext?18.6:12,W=WM*K+P*2,Hh=9.6*K+P*2+(mode==='paper'?54:0);
  const X=x=>P+x*K,Y=y=>P+y*K;const paper=mode==='paper';
  let s=`<svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Planta baixa">`;
  if(paper){s+=`<rect width="${W}" height="${Hh}" fill="#fbfaf5"/>`;for(let i=0;i<W;i+=20)s+=`<line x1="${i}" y1="0" x2="${i}" y2="${Hh}" stroke="#ece9df" stroke-width=".6"/>`;for(let j=0;j<Hh;j+=20)s+=`<line x1="0" y1="${j}" x2="${W}" y2="${j}" stroke="#ece9df" stroke-width=".6"/>`}
  if(ext) EXT.forEach(e=>{
    const on=interactive&&layer==='externo';const sl=S.selExt===e.id&&layer==='externo';
    const fill=e.id==='piscina'?'hsl(200 70% 85%)':'hsl(100 35% 80%)';
    s+=`<rect x="${X(e.x0)}" y="${Y(e.y0)}" width="${(e.x1-e.x0)*K}" height="${(e.y1-e.y0)*K}" rx="${e.id==='piscina'?6:2}" fill="${fill}" stroke="${sl?'#1a1a1a':'#9aa39a'}" stroke-width="${sl?3:1}" ${e.id==='jardim'?'stroke-dasharray="5 4"':''} ${on?`class="hit" data-act="esel" data-arg="${e.id}"`:''}/><text x="${X((e.x0+e.x1)/2)}" y="${Y((e.y0+e.y1)/2)+4}" text-anchor="middle" font-size="12" font-weight="600" fill="#2b3a2b" pointer-events="none">${e.nome}</text>`;
  });
  roomsOf(floor).forEach(r=>{
    const sl=layer==='ambientes'&&S.selRoom===r.id;
    const fill=paper?'none':(hl===r.id||sl?'hsl(38 92% 50% / .2)':'#'+r.floor.toString(16));
    const on=interactive&&layer==='ambientes';
    s+=`<rect x="${X(r.x0)}" y="${Y(r.y0)}" width="${(r.x1-r.x0)*K}" height="${(r.y1-r.y0)*K}" fill="${fill}" ${on?`class="hit" data-act="rsel" data-arg="${r.id}"`:''}/>`;
  });
  const hits=[];
  WALLS.forEach(w=>{
    const key=wkey(w.id,floor);const pieces=wallPieces(w);const len=wlen(w);
    const ux=(w.b[0]-w.a[0])/len,uy=(w.b[1]-w.a[1])/len,nx=-uy,ny=ux;
    const lk=progress?wallLook(key,colorBy):null;
    const col=paper?'#55524a':(lk?(lk.none?'#bdbdbd':lk.c):'#2b2b2b');
    const dash=lk&&lk.none?'stroke-dasharray="4 4"':'';
    const sw=lk&&lk.none?2.5:T3*K;
    const isSel=sel.includes(key);
    const dim=layer!=='paredes'&&layer!=='campo'&&!paper?' opacity=".35"':'';
    if(isSel) s+=`<line x1="${X(w.a[0])}" y1="${Y(w.a[1])}" x2="${X(w.b[0])}" y2="${Y(w.b[1])}" stroke="#1a1a1a" stroke-width="${T3*K+9}" stroke-linecap="round" opacity=".9"/>`;
    pieces.forEach(p=>{
      const x1=X(w.a[0]+ux*p.s),y1=Y(w.a[1]+uy*p.s),x2=X(w.a[0]+ux*(p.s+p.l)),y2=Y(w.a[1]+uy*(p.s+p.l));
      if(p.k==='solid') s+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col}" stroke-width="${sw}" ${dash} stroke-linecap="square"${dim}/>`;
      if(p.k==='sill'){const of=T3*K/3;const c2=paper?'#55524a':'#6b7280';s+=`<line x1="${x1+nx*of}" y1="${y1+ny*of}" x2="${x2+nx*of}" y2="${y2+ny*of}" stroke="${c2}" stroke-width="1.2"${dim}/><line x1="${x1-nx*of}" y1="${y1-ny*of}" x2="${x2-nx*of}" y2="${y2-ny*of}" stroke="${c2}" stroke-width="1.2"${dim}/>`}
      if(p.k==='lintel'&&p.o.t==='door'){const r=p.l*K;const ex=x1+nx*r,ey=y1+ny*r;s+=`<path d="M${x2} ${y2} A${r} ${r} 0 0 0 ${ex} ${ey}" fill="none" stroke="${paper?'#8a8578':'#9ca3af'}" stroke-width="1" stroke-dasharray="3 3"${dim}/><line x1="${x1}" y1="${y1}" x2="${ex}" y2="${ey}" stroke="${paper?'#55524a':'#6b7280'}" stroke-width="1.4"${dim}/>`}
    });
    if(interactive&&(layer==='paredes'||layer==='campo')) hits.push(`<line class="hit" data-act="${act}" data-arg="${key}" x1="${X(w.a[0])}" y1="${Y(w.a[1])}" x2="${X(w.b[0])}" y2="${Y(w.b[1])}" stroke="transparent" stroke-width="${hitW}"><title>${w.nome}</title></line>`);
  });
  if(layer==='estrutura') PILARES.forEach(([x,y])=>{s+=`<rect x="${X(x)-6}" y="${Y(y)-6}" width="12" height="12" fill="${floor==='terreo'?'#5f5a52':'#d6d3cc'}" stroke="#1a1a1a" stroke-width="1"/>`});
  roomsOf(floor).forEach(r=>{
    const cx=X((r.x0+r.x1)/2),cy=Y((r.y0+r.y1)/2);
    s+=`<text x="${cx}" y="${cy-3}" text-anchor="middle" font-size="${paper?11:13}" font-weight="${paper?500:600}" fill="${paper?'#3d3a33':'#1a1a1a'}" pointer-events="none" ${paper?'letter-spacing="1"':''}>${paper?r.nome.toUpperCase():r.nome}</text><text x="${cx}" y="${cy+13}" text-anchor="middle" font-size="11" fill="${paper?'#6b675d':'#5f6570'}" pointer-events="none">${fmt(area(r))} m²</text>`;
  });
  s+=hits.join('');
  const dc=paper?'#6b675d':'#9ca3af';
  s+=`<line x1="${X(0)}" y1="${P-22}" x2="${X(12)}" y2="${P-22}" stroke="${dc}"/><line x1="${X(0)}" y1="${P-27}" x2="${X(0)}" y2="${P-17}" stroke="${dc}"/><line x1="${X(12)}" y1="${P-27}" x2="${X(12)}" y2="${P-17}" stroke="${dc}"/><text x="${X(6)}" y="${P-27}" text-anchor="middle" font-size="11" fill="${dc}">12,00</text>`;
  s+=`<line x1="${P-22}" y1="${Y(0)}" x2="${P-22}" y2="${Y(9)}" stroke="${dc}"/><line x1="${P-27}" y1="${Y(0)}" x2="${P-17}" y2="${Y(0)}" stroke="${dc}"/><line x1="${P-27}" y1="${Y(9)}" x2="${P-17}" y2="${Y(9)}" stroke="${dc}"/><text x="${P-28}" y="${Y(4.5)}" text-anchor="middle" font-size="11" fill="${dc}" transform="rotate(-90 ${P-28} ${Y(4.5)})">9,00</text>`;
  if(paper){const by=Y(9)+30;s+=`<rect x="${X(5.5)}" y="${by}" width="${6.5*K}" height="40" fill="none" stroke="#55524a"/><text x="${X(5.7)}" y="${by+16}" font-size="10" fill="#3d3a33" font-weight="600">RESIDÊNCIA ALVES · PLANTA BAIXA TÉRREO</text><text x="${X(5.7)}" y="${by+31}" font-size="9" fill="#6b675d">ESC. 1:50 · FOLHA 01/04 · ARQ. REV. 02</text>`}
  return s+'</svg>';
}

/* ============ 3D (three.js) ============ */
let VIEWERS=[];
function dispose3D(){VIEWERS.forEach(v=>v.dispose());VIEWERS=[]}
function mount3D(el,o={}){
  const {focus='paredes',colorBy=S.colorBy,sel=[],hlRoom=null,upper=false,ext=false,pick=null,neutral=false,auto=true}=o;
  if(!window.THREE){el.insertAdjacentHTML('beforeend',`<div class="v-err"><div class="stack" style="align-items:center">${ic('cube','lg')}<b>A visualização 3D não abriu neste navegador</b><span class="muted xs">A planta 2D continua disponível.</span></div></div>`);return null}
  const w=el.clientWidth||600,h=el.clientHeight||420;
  const R=new THREE.WebGLRenderer({antialias:true,alpha:true});
  R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.setSize(w,h);el.appendChild(R.domElement);
  const scene=new THREE.Scene();const cam=new THREE.PerspectiveCamera(38,w/h,0.1,300);
  scene.add(new THREE.HemisphereLight(0xffffff,0xc9ccc2,0.95));
  const dl=new THREE.DirectionalLight(0xffffff,0.6);dl.position.set(14,22,2);scene.add(dl);
  const mat=(c,op=1)=>new THREE.MeshStandardMaterial({color:c,roughness:.92,transparent:op<1,opacity:op});
  const cx=ext?9.2:6,cz=4.6;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,80),mat(0xeef0e8));ground.rotation.x=-Math.PI/2;ground.position.set(cx,-0.13,cz);scene.add(ground);
  const slab=new THREE.Mesh(new THREE.BoxGeometry(12.4,0.12,9.4),mat(0xd9d4c7));slab.position.set(6,-0.06,4.5);scene.add(slab);
  const floors={};
  ROOMS.terreo.forEach(r=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(r.x1-r.x0-0.15,r.y1-r.y0-0.15),mat(r.floor));m.rotation.x=-Math.PI/2;m.position.set((r.x0+r.x1)/2,0.006,(r.y0+r.y1)/2);scene.add(m);floors[r.id]=m});
  const pickables=[];const groups={};
  const dimWalls=focus==='estrutura'||focus==='externo'||focus==='ambientes';
  function buildWalls(floor,y0){
    WALLS.forEach(wl=>{
      const key=wkey(wl.id,floor);
      const g=new THREE.Group();const dx=wl.b[0]-wl.a[0],dz=wl.b[1]-wl.a[1];
      g.position.set(wl.a[0],y0,wl.a[1]);g.rotation.y=-Math.atan2(dz,dx);
      const m=new THREE.MeshStandardMaterial({color:'#cfcfcf',roughness:.85,transparent:true,opacity:1});
      const em=new THREE.LineBasicMaterial({color:0x3a3a3a,transparent:true,opacity:.28});
      wallPieces(wl).forEach(p=>{const geo=new THREE.BoxGeometry(Math.max(p.l,0.01),p.y1-p.y0,T3);const mesh=new THREE.Mesh(geo,m);mesh.position.set(p.s+p.l/2,(p.y0+p.y1)/2,0);mesh.userData.key=key;g.add(mesh);pickables.push(mesh);const ed=new THREE.LineSegments(new THREE.EdgesGeometry(geo),em);ed.position.copy(mesh.position);g.add(ed)});
      scene.add(g);groups[key]={g,m,em,from:1,to:1,t0:0,dur:1500,delay:0};
    });
  }
  buildWalls('terreo',0);
  if(upper){buildWalls('superior',FLOOR_H)}
  /* estrutura: pilares e lajes */
  const conc=0x8d877c;
  PILARES.forEach(([x,z])=>{const p=new THREE.Mesh(new THREE.BoxGeometry(0.22,H3,0.22),mat(conc,focus==='estrutura'?1:.0001));p.position.set(x,H3/2,z);scene.add(p);
    if(upper){const q=new THREE.Mesh(new THREE.BoxGeometry(0.22,H3,0.22),mat(0xd8d5ce,focus==='estrutura'?.55:.0001));q.position.set(x,FLOOR_H+H3/2,z);scene.add(q)}});
  if(focus==='estrutura'||upper){const l=new THREE.Mesh(new THREE.BoxGeometry(12.3,0.18,9.3),mat(0xb9b4aa,focus==='estrutura'?.45:.22));l.position.set(6,H3+0.1,4.5);scene.add(l)}
  /* área externa */
  if(ext){
    const pe=EXT[0];const pw=pe.x1-pe.x0,pd=pe.y1-pe.y0;
    const pit=new THREE.Mesh(new THREE.PlaneGeometry(pw,pd),mat(focus==='externo'?0x6f7b84:0x9aa4ab));pit.rotation.x=-Math.PI/2;pit.position.set((pe.x0+pe.x1)/2,-0.11,(pe.y0+pe.y1)/2);scene.add(pit);
    [[pe.x0,pe.y0,pw,0.25],[pe.x0,pe.y1-0.25,pw,0.25],[pe.x0,pe.y0,0.25,pd],[pe.x1-0.25,pe.y0,0.25,pd]].forEach(([x,z,ww,dd],i)=>{const c=new THREE.Mesh(new THREE.BoxGeometry(ww,0.35,dd),mat(i<2?0xa9a397:0xd9d6cf,i<2?1:.5));c.position.set(x+ww/2,0.05,z+dd/2);scene.add(c)});
    const je=EXT[1];const jd=new THREE.Mesh(new THREE.PlaneGeometry(je.x1-je.x0,je.y1-je.y0),mat(0xb5926a));jd.rotation.x=-Math.PI/2;jd.position.set((je.x0+je.x1)/2,0.003,(je.y0+je.y1)/2);scene.add(jd);
  }
  const lbl=document.createElement('div');lbl.className='lbls';el.appendChild(lbl);
  const labels=ROOMS.terreo.map(r=>({id:r.id,t:r.nome,v:new THREE.Vector3((r.x0+r.x1)/2,0.3,(r.y0+r.y1)/2)}));
  if(upper) ROOMS.superior.forEach(r=>labels.push({id:r.id,t:r.nome,v:new THREE.Vector3((r.x0+r.x1)/2,FLOOR_H+0.3,(r.y0+r.y1)/2),up:1}));
  if(ext) EXT.forEach(e=>labels.push({id:e.id,t:e.nome,v:new THREE.Vector3((e.x0+e.x1)/2,0.3,(e.y0+e.y1)/2)}));
  labels.forEach(L=>{const sp=document.createElement('span');sp.textContent=L.t;if(L.up)sp.style.opacity='.7';lbl.appendChild(sp);L.sp=sp});
  function apply(key,anim=false,delay=0){
    const G=groups[key];if(!G)return;
    if(neutral){G.m.color.set('#e7e2d6');G.m.opacity=1;G.g.scale.y=1;return}
    const L=wallLook(key,colorBy);let op=L.o;if(dimWalls)op=Math.min(op,.2);
    G.m.color.set(L.c);G.m.opacity=op;G.m.emissive=new THREE.Color(sel.includes(key)?0x2a3d10:0x000000);
    G.em.opacity=sel.includes(key)?1:.28;G.em.color.set(sel.includes(key)?0x1a1a1a:0x3a3a3a);
    if(anim){G.from=.05;G.to=L.h;G.t0=performance.now();G.delay=delay;G.g.scale.y=.05}else{G.from=G.to=L.h;G.g.scale.y=L.h}
  }
  Object.keys(groups).forEach(k=>apply(k));
  function hl(id){Object.entries(floors).forEach(([k,m])=>m.material.color.set(k===id?0xf7dfae:ROOMS.terreo.find(r=>r.id===k).floor));labels.forEach(L=>L.sp.classList.toggle('hl',L.id===id))}
  if(hlRoom)hl(hlRoom);
  const fit=()=>{const a=(el.clientWidth||600)/(el.clientHeight||420);return (ext?27:21)*(upper?1.12:1)*Math.min(1.9,Math.max(1,1.8/a))};
  let theta=-2.2,phi=upper?0.98:0.92,rad=fit(),drag=null,moved=0,touched=!auto;const tgt=new THREE.Vector3(cx,upper?1.6:0.6,cz);
  const cv=R.domElement;const ray=new THREE.Raycaster();
  cv.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};moved=0;touched=true;cv.setPointerCapture(e.pointerId)});
  cv.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;moved+=Math.abs(dx)+Math.abs(dy);theta+=dx*0.008;phi=Math.min(1.42,Math.max(0.2,phi-dy*0.006));drag={x:e.clientX,y:e.clientY}});
  cv.addEventListener('pointerup',e=>{const was=drag;drag=null;if(!pick||!was||moved>6)return;const r=cv.getBoundingClientRect();ray.setFromCamera({x:((e.clientX-r.left)/r.width)*2-1,y:-((e.clientY-r.top)/r.height)*2+1},cam);const hit=ray.intersectObjects(pickables)[0];if(hit)pick(hit.object.userData.key)});
  cv.addEventListener('wheel',e=>{e.preventDefault();rad=Math.min(56,Math.max(9,rad+e.deltaY*0.01))},{passive:false});
  const ease=t=>1-Math.pow(1-t,3);let raf;
  const loop=now=>{
    if(!touched)theta+=0.0016;
    cam.position.set(tgt.x+rad*Math.sin(phi)*Math.cos(theta),tgt.y+rad*Math.cos(phi),tgt.z+rad*Math.sin(phi)*Math.sin(theta));cam.lookAt(tgt);
    Object.values(groups).forEach(G=>{if(G.from!==G.to){const t=Math.min(1,Math.max(0,(now-G.t0-G.delay)/G.dur));G.g.scale.y=G.from+(G.to-G.from)*ease(t);if(t>=1)G.from=G.to}});
    R.render(scene,cam);const W=el.clientWidth,Hh=el.clientHeight;
    labels.forEach(L=>{const p=L.v.clone().project(cam);L.sp.style.left=((p.x+1)/2*W)+'px';L.sp.style.top=((1-p.y)/2*Hh)+'px'});
    raf=requestAnimationFrame(loop);
  };
  raf=requestAnimationFrame(loop);
  const ro=new ResizeObserver(()=>{const W=el.clientWidth,Hh=el.clientHeight;if(!W||!Hh)return;R.setSize(W,Hh);cam.aspect=W/Hh;cam.updateProjectionMatrix();if(!touched)rad=fit()});ro.observe(el);
  const api={apply,hl,dispose(){cancelAnimationFrame(raf);ro.disconnect();R.dispose();scene.traverse(x=>{x.geometry&&x.geometry.dispose()})}};
  VIEWERS.push(api);return api;
}
const legend=(colorBy=S.colorBy)=>colorBy==='etapa'
  ?`<div class="legend"><span><i style="background:#cfcfcf;opacity:.6"></i>Não iniciada</span>${ETAPAS.map((e,i)=>`<span><i style="background:${ETCOL[i]};border:1px solid #0002"></i>${e}</span>`).join('')}</div>`
  :`<div class="legend"><span><i style="background:#cfcfcf;opacity:.6"></i>Não iniciada</span><span><i style="background:${CONF.relatado}"></i>Relatado</span><span><i style="background:${CONF.confirmado}"></i>Confirmado</span></div>`;

/* ============ estados genéricos ============ */
const EMPTY={
  plano:['Nenhum plano registrado','Registre as decisões no DECISOES.md e o mapa aparece aqui.','Registrar decisão'],
  inicio:['Ainda sem dados para mostrar','Os números aparecem quando entrarem a primeira proposta, o primeiro recebimento ou a primeira obra.','Cadastrar lead'],
  comercial:['Nenhum lead ainda','Cole uma conversa do WhatsApp ou cadastre o primeiro lead. A Pilar organiza o pedido e diz se ele combina com o seu escritório.','Colar conversa'],
  proposta:['Nenhuma proposta em andamento','Escolha um lead aderente ou digite a área: a Pilar monta a proposta pelo seu modelo.','Nova proposta'],
  modelos:['Nenhum modelo ainda','Comece por um modelo pronto e ajuste à forma de trabalhar do escritório.','Usar modelo Residencial térrea'],
  documentos:['Nenhuma planta enviada','Envie a planta em PDF, DWG ou IFC. A Pilar monta os ambientes e o modelo 3D para você conferir.','Enviar planta'],
  obra:['Cronograma vazio','Monte o cronograma a partir da estimativa ou de um modelo de obra. O clima passa a ser cruzado com as tarefas sensíveis a chuva.','Montar cronograma'],
  campo:['Nenhum registro hoje','A equipe grava um áudio, tira uma foto ou marca no desenho. A Pilar liga o relato ao ambiente e à parede certa.','Gravar primeiro registro'],
  orcamento:['Nenhuma estimativa nesta obra','Crie a estimativa a partir da planta conferida. Cada linha mostra de onde veio o preço.','Criar estimativa'],
  precos:['Nenhuma referência ativa','Escolha os estados e a Pilar busca CUB e SINAPI sozinha todo mês.','Escolher estados'],
  portal:['Nada liberado ao cliente ainda','Só entra aqui o que você liberar. Registros do Campo nascem internos.','Liberar primeiro relatório']
};
const ERR={
  documentos:['Não consegui ler a escala desta planta','O PDF veio digitalizado e a cota está ilegível. Envie o PDF exportado do CAD, ou trace as paredes por cima com a escala que você informar.','Traçar à mão'],
  precos:['A busca do CUB-RS falhou hoje','O site do Sinduscon-RS não respondeu. A última referência válida (set/2026) continua ativa. Nova tentativa às 18:00.','Tentar agora'],
  obra:['Previsão do tempo indisponível','O serviço de clima não respondeu às 06:00. Nenhuma tarefa foi mudada. Nova tentativa em 1 hora.','Tentar agora'],
  campo:['O áudio ainda não subiu','Sem internet no canteiro. O registro está guardado no celular e sobe sozinho quando a conexão voltar.','Ver fila do celular'],
  _:['Não foi possível carregar esta tela','A conexão caiu antes de os dados chegarem. Nada foi perdido. Tente de novo em instantes.','Tentar de novo']
};
const LOADING={plano:'Abrindo o plano',inicio:'Calculando os números do período',comercial:'Avaliando os leads',proposta:'Montando a proposta',modelos:'Abrindo modelos',documentos:'Abrindo a planta',obra:'Cruzando cronograma e previsão',campo:'Buscando registros de hoje',orcamento:'Calculando a estimativa',precos:'Conferindo referências',portal:'Montando o relatório'};
function stateView(id){
  if(S.state==='carregando')return `<div class="state"><svg class="ring" viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="17"/><circle class="fg" cx="22" cy="22" r="17"/></svg><p class="muted">${LOADING[id]}</p></div><div class="grid g3" style="padding:0 0 24px">${'<div class="sk" style="height:120px"></div>'.repeat(3)}</div><div class="sk" style="height:260px"></div>`;
  if(S.state==='vazio'){const [t,p,a]=EMPTY[id];return `<div class="state"><div class="ic">${ic(SCREENS.find(s=>s.id===id).icon,'lg')}</div><h2>${t}</h2><p>${p}</p><button class="btn brand mt8" data-act="st" data-arg="cheio">${a}</button></div>`}
  const [t,p,a]=ERR[id]||ERR._;
  return `<div class="state err"><div class="ic">${ic('alert','lg')}</div><h2>${t}</h2><p>${p}</p><button class="btn outline mt8" data-act="st" data-arg="cheio">${ic('refresh','sm')}${a}</button></div>`;
}
function head({crumbs='',title,sub='',acts='',tabs=''}){
  return `<div class="ph">${crumbs?`<div class="crumbs">${crumbs}</div>`:''}<div class="row"><div><h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}</div><div class="acts row wrap">${acts}</div></div>${tabs}</div>`;
}
const tabsBar=(items,cur,act)=>`<div class="tabs">${items.map(([k,l,i])=>`<button class="${k===cur?'on':''}" data-act="${act}" data-arg="${k}">${i?ic(i,'sm'):''}${l}</button>`).join('')}</div>`;
const seg=(items,cur,act)=>`<div class="scn">${items.map(([k,l])=>`<button class="${k===cur?'on':''}" data-act="${act}" data-arg="${k}">${l}</button>`).join('')}</div>`;
const V={};
