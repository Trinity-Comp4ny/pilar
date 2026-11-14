// Kit de movimento da marca para os Reels (quadro a quadro, determinístico).
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v)), lin=(t,a,b)=>clamp((t-a)/(b-a));
const expo=x=>x>=1?1:1-Math.pow(2,-10*x), quint=x=>1-Math.pow(1-x,5), easeIO=x=>x<.5?4*x*x*x:1-Math.pow(-2*x+2,3)/2;
const $=id=>document.getElementById(id);
const show=(id,on)=>{const e=$(id); if(e) e.style.display=on?(e.dataset.d||'block'):'none';};
function enter(el,t,t0,dy=40,dur=0.5){ if(typeof el==='string') el=$(el); const k=expo(lin(t,t0,t0+dur)); el.style.opacity=k; el.style.transform='translateY('+((1-k)*dy)+'px)'; return k; }
function pill(el,t,t0){ if(typeof el==='string') el=$(el); el.style.setProperty('--s',quint(lin(t,t0,t0+0.4))); }
function countTo(el,t,t0,t1,v0,v1,fmt){ if(typeof el==='string') el=$(el); const k=quint(lin(t,t0,t1)); el.textContent=fmt(v0+(v1-v0)*k); }
const brl=v=>'R$ '+Math.round(v).toLocaleString('pt-BR');
// fechamento padrão
async function setupEnd(q){
  const svg=await (await fetch('../assets/pilar-logo-horizontal-white.svg')).text();
  const d=document.createElement('div'); d.id='end';
  d.innerHTML=svg.replace('width="396" height="121"','class="logo"')+(q?'<div class="q" id="eq">'+q+'</div>':'')+
    '<div class="tag" id="etag">Gestão com agentes de IA para escritórios de engenharia e arquitetura.</div><div class="cta" id="ecta">Planos e demonstração no link da bio</div><div class="url" id="eurl">pilarsoft.com.br</div>';
  document.body.appendChild(d);
  const s=[...d.querySelectorAll('.logo g path')]; s.forEach(p=>{const L=p.getTotalLength();p.style.strokeDasharray=L;p.dataset.L=L;});
  window.__endStrokes=s; window.__endFills=[...d.querySelectorAll('.logo > path')];
}
function renderEnd(t,t0){
  const e=$('end'); if(!e) return; if(t<t0){e.style.display='none';return;} e.style.display='flex'; e.style.opacity=lin(t,t0,t0+0.3);
  const u=t-t0; window.__endStrokes.forEach((p,i)=>{const dl=[0,.16,.34,.42,.5][i]||0;const k=quint(lin(u,.25+dl,.8+dl));p.style.strokeDashoffset=(1-k)*p.dataset.L;});
  window.__endFills.forEach(p=>p.style.opacity=expo(lin(u,.6,1)));
  if($('eq')) enter('eq',u,0.15,24); enter('etag',u,0.7,20); enter('ecta',u,0.95,20); enter('eurl',u,1.1,14);
}
// imagem de quadro (sequência renderizada)
const __imgCache={};
function setFrame(img,src){ return new Promise(r=>{ if(img.dataset.src===src) return r(); img.dataset.src=src; img.onload=()=>r(); img.onerror=()=>r(); img.src=src; }); }
// recorte de tela real: mostra a região (x,y,w,h) da imagem 2880x1800 dentro da caixa
function shot(box,img,region,zoom=1,focus=[0.5,0.5]){
  const bw=box.clientWidth,bh=box.clientHeight; const [x,y,w,h]=region; const s=bw/w*zoom;
  const fx=x+w*focus[0], fy=y+h*focus[1]; const ox=bw/2-fx*s, oy=bh/2-fy*s;
  const minX=bw-2880*s, minY=bh-1800*s;
  img.style.transform='translate('+Math.min(0,Math.max(minX,ox))+'px,'+Math.min(0,Math.max(minY,oy))+'px) scale('+s+')';
}
window.CUES=[]; const cue=(t,type,v)=>window.CUES.push({t,type,v});
// mostra a imagem com escala s, centrando o ponto (px,py) na caixa (com limite nas bordas)
function shotAt(box,img,s,px,py){ const bw=box.clientWidth,bh=box.clientHeight; let ox=bw/2-px*s, oy=bh/2-py*s;
  ox=Math.min(0,Math.max(bw-2880*s,ox)); oy=Math.min(0,Math.max(bh-1800*s,oy)); img.style.transform='translate('+ox+'px,'+oy+'px) scale('+s+')'; return [ox,oy]; }
