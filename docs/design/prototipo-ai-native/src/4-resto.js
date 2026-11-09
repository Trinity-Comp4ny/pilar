/* ---- orçamento: estimativa, materiais e cotações ---- */
function orcEstimativa(){
  const L=[['Fundação (radier)','SINAPI · 108 m²','sinapi',38900],['Estrutura e alvenaria','CUB R8-N proporcional','cub',148200],['Instalações elétricas','tabela da empresa','empresa',21600],['Instalações hidrossanitárias','tabela da empresa','empresa',18400],['Esquadrias','SINAPI · 13 un','sinapi',26300],['Revestimentos e pisos','CUB R8-N proporcional','cub',61500],['Piscina','valor do usuário','usuario',42000],['Marcenaria','referência do Pilar','ref',28000],['Climatização','','definir',null],['Energia solar','','definir',null]];
  const total=L.reduce((s,l)=>s+(l[3]||0),0);
  return `<div class="callout warn mb">${ic('alert','sm')}<div><b>Total parcial: ${brl(total)}</b><br><span class="xs">Faltam 2 itens sem preço. O PDF também mostra "total parcial".</span></div></div>
    <div class="grid g3 mb"><div class="card p kpi"><div class="l">Procedência</div><div class="v">92%</div><div class="xs muted">do valor tem fonte</div></div><div class="card p kpi"><div class="l">Completude</div><div class="v">80%</div><div class="xs muted">8 de 10 itens com preço</div></div><div class="card p kpi"><div class="l">Calibração</div><div class="v" style="font-size:16px;padding-top:6px">sem histórico</div><div class="xs muted">depois de 3 obras comparáveis</div></div></div>
    <div class="card"><table class="t cards"><thead><tr><th>Item</th><th>Base</th><th>Origem</th><th class="num">Valor</th></tr></thead><tbody>${L.map(l=>`<tr><td><b>${l[0]}</b></td><td class="xs soft">${l[1]}</td><td>${og(l[2])}</td><td class="num">${l[3]?brl(l[3]):'<span class="muted">a definir</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function orcMateriais(){
  const M=[['Argamassa de reboco','m³','3,4','0,0','3,4'],['Cimento CP-II 50 kg','saco','12','4','8'],['Cal hidratada 20 kg','saco','30','0','30'],['Areia média','m³','3,9','1,0','2,9']];
  return `<div class="callout info mb xs">${ic('spark','sm')}<div><b>Como a conta sai.</b> Quantidade do serviço vem da planta conferida (m² de parede × faces − aberturas). O material por m² vem da composição do SINAPI (aba Analítico). O CUB não detalha material por etapa: serve para a estimativa global.</div></div>
  <div class="card mb"><div style="padding:14px 14px 0"><h3>${ic('cal','sm')}Reboco interno dos quartos e do banheiro <span class="r">${b('proj','seg 09 a qua 11/11')}</span></h3>
    <div class="row wrap xs soft" style="gap:14px"><span>Quantidade: <b>142 m²</b> ${og('calc')}</span><span>Composição: emboço/reboco 2 cm ${og('sinapi')}</span><span>Cotar até: <b>05/11</b></span></div></div>
    <table class="t mat mt8"><thead><tr><th>Material</th><th>Unid.</th><th class="num">Precisa</th><th class="num">Em estoque</th><th class="num">Comprar</th></tr></thead><tbody>${M.map(m=>`<tr><td>${m[0]}</td><td>${m[1]}</td><td class="num">${m[2]}</td><td class="num">${m[3]}</td><td class="num"><b>${m[4]}</b></td></tr>`).join('')}</tbody></table>
    <div class="row wrap" style="padding:12px 14px"><button class="btn brand sm" data-act="orctab" data-arg="cotacoes">Pedir cotação</button><span class="xs muted">Coeficientes ilustrativos neste protótipo.</span></div></div>
  <div class="grid g2">
    <div class="card p"><h3>${ic('cart','sm')}Alvenaria da cozinha e fundo da sala <span class="r">${b('proj','16 a 20/11')}</span></h3>
      <div class="fld" style="grid-template-columns:1fr auto auto"><span class="xs">Paredes (planta)</span><b class="xs">58 m²</b>${og('calc')}</div>
      <div class="fld" style="grid-template-columns:1fr auto auto"><span class="xs">Bloco 14×19×29 (com perda 5%)</span><b class="xs">2.258 un</b>${og('sinapi')}</div>
      <div class="fld" style="grid-template-columns:1fr auto auto"><span class="xs">Estoque</span><b class="xs">− 600 un</b>${b('neutral','estoque')}</div>
      <div class="fld" style="grid-template-columns:1fr auto"><span class="xs"><b>Comprar</b></span><b>1.658 un</b></div>
      <div class="xs muted mt8">Necessário 16/11 − entrega 4 d − aprovação 1 d − cotação 3 d = <b>cotar até 08/11</b></div></div>
    <div class="card p"><h3>${ic('alert','sm')}Piso da sala <span class="r">${b('warning','só consultar')}</span></h3><div class="xs soft">Argamassa AC-III, 40 sacos.</div>${'<div class="mt8">'+agent('<b>Vale consultar; ainda não emitir pedido.</b><div class="xs soft mt8">A cliente escolhe o piso até 12/11 e a especificação pode mudar.</div>')+'</div>'}</div>
  </div>`;
}
function orcCotacoes(){
  return `<div class="card"><div class="row between wrap" style="padding:12px 14px"><div class="h3" style="margin:0">Bloco 14×19×29 · 1.658 un · 3 respostas</div><span class="xs muted">Referência SINAPI ${brl(1.48)}/un · SP out/26</span></div>
    <table class="t cards"><thead><tr><th>Fornecedor</th><th class="num">Unitário</th><th class="num">Frete</th><th>Entrega</th><th class="num">Total conhecido</th></tr></thead><tbody>
      <tr><td><b>Depósito Central</b><div class="xs muted">nota 4,6 em 8 entregas</div></td><td class="num">${brl(1.55)}</td><td class="num">${brl(180)}</td><td>2 dias ${b('success','no prazo')}</td><td class="num"><b>${brl(2749.9)}</b></td></tr>
      <tr><td><b>Cerâmica Bauru</b><div class="xs muted">nota 4,2 em 3 entregas</div></td><td class="num">${brl(1.42)}</td><td class="num">${S.frete?brl(220):b('warning','não informado')}</td><td>3 dias ${b('success','no prazo')}</td><td class="num">${S.frete?`<b>${brl(2574.36)}</b>`:'<span class="muted">incompleto</span>'}</td></tr>
      <tr><td><b>Olaria São José</b><div class="xs muted">sem histórico</div></td><td class="num">${brl(1.35)}</td><td class="num">${brl(250)}</td><td>6 dias ${b('danger','chega depois')}</td><td class="num">${brl(2488.3)}</td></tr>
    </tbody></table>
    <div class="row wrap" style="padding:14px">${S.frete?'':`<a class="btn outline sm" target="_blank" rel="noopener" data-act="frete" href="https://wa.me/5514900000010?text=${encodeURIComponent('Oi! Sobre a cotação de 1.658 blocos para a Rua das Acácias, 210: qual o valor do frete?')}">Perguntar frete à Cerâmica Bauru</a>`}<button class="btn brand sm" data-act="toast" data-arg="Pedido preparado. Falta a sua autorização para enviar.">Preparar pedido</button><span class="xs muted">Frete ausente nunca vira zero. A Pilar não compra sozinha.</span></div></div>`;
}
V.orcamento=()=>head({crumbs:'Obras › Residência Alves',title:'Orçamento',sub:'Estimativa, material de cada etapa e cotações no mesmo lugar.',tabs:tabsBar([['estimativa','Estimativa','calc'],['materiais','Materiais','cart'],['cotacoes','Cotações','file']],S.orcTab,'orctab')})+`<div class="pc">${S.orcTab==='estimativa'?orcEstimativa():S.orcTab==='materiais'?orcMateriais():orcCotacoes()}</div>`;

/* ---- preços ---- */
V.precos=()=>{
  const UF=[['SP','Sinduscon-SP',2238.58,2162.78,'out/26','ok'],['PR','Sinduscon-PR',2105.12,2031.4,'out/26','ok'],['MG','Sinduscon-MG',2011.9,1942.33,'out/26','ok'],['RJ','Sinduscon-Rio',2189.07,2114.55,'set/26','wait'],['RS','Sinduscon-RS',2201.6,2125.02,'set/26','q']];
  const st={ok:b('success','atualizado sozinho'),wait:b('neutral','aguardando publicação'),q:b('danger','quarentena')};
  return head({crumbs:'Configurações',title:'Referências de preço',sub:'CUB e SINAPI chegam sozinhos. Você só é avisado quando algo foge do normal.'})+`<div class="pc"><div class="grid g-side">
    <div class="card"><div style="padding:12px 14px 0" class="h3">${ic('chart','sm')}CUB R8-N por estado</div><table class="t cards"><thead><tr><th>UF</th><th>Fonte</th><th class="num">Sem desoneração</th><th class="num">Com desoneração</th><th>Competência</th><th>Estado</th></tr></thead><tbody>${UF.map(u=>`<tr><td><b>${u[0]}</b></td><td class="xs">${u[1]}</td><td class="num">${brl(u[2])}</td><td class="num">${brl(u[3])}</td><td>${u[4]}</td><td>${st[u[5]]}</td></tr>`).join('')}</tbody></table>
    <div class="xs muted" style="padding:10px 14px">Cada Sinduscon publica o seu até o dia 5. O hub da CBIC tem todos os estados, mas o acesso é restrito: confirmar antes de depender dele.</div></div>
    <div class="stack"><div class="card p"><h3>${ic('refresh','sm')}SINAPI out/2026</h3><div class="xs soft">Importado sozinho em 09/10 às 06:10. 4.881 insumos, 10.612 composições com coeficientes.</div></div>
    <div class="callout danger xs">${ic('alert','sm')}<div><b>CUB-RS em quarentena</b><br>Outubro veio em PDF digitalizado. Setembro continua valendo, com aviso nas estimativas do RS.</div></div></div>
  </div></div>`;
};

/* ---- portal do cliente ---- */
V.portal=()=>head({crumbs:'Visão do cliente',title:'Residência Alves',sub:'O que a Carla vê no portal. Só entra o que foi conferido e liberado.'})+`<div class="pc"><div style="max-width:760px">
  <div class="portal-hero"><div class="xs" style="opacity:.7">Semana de 02 a 08/11</div><div style="font-size:20px;font-weight:700;margin:4px 0">Sua obra avançou 6% esta semana</div><div class="row wrap">${b('neutral','38% concluída')}${b('neutral','entrega prevista 20/03/2027')}</div></div>
  <div class="card p mt"><h3>${ic('alert','sm')}Precisamos de você</h3><div class="row between wrap"><div><b>Escolher o piso da cozinha até 12/11</b><div class="xs soft">O piso leva 10 dias para chegar e o assentamento começa em 23/11.</div></div><button class="btn brand">Escolher piso</button></div></div>
  <div class="card p mt"><h3>${ic('check','sm')}O que avançou</h3><div class="stack"><div><b>Paredes dos quartos e do banheiro levantadas</b><div class="xs muted">Conferido em 03/11</div></div>${S.campo==='confirmed'?'<div><b>Novo avanço conferido hoje</b><div class="xs muted">04/11</div></div>':''}<div class="grid g3"><div class="photo"></div><div class="photo"></div><div class="photo"></div></div></div></div>
  <div class="card p mt"><h3>${ic('rain','sm')}Clima</h3><div class="xs soft">Chuva prevista para quinta. A equipe vai trabalhar nas instalações internas. A data de entrega não muda.</div></div>
  <div class="card mt"><div style="padding:12px 14px 0" class="h3">${ic('plan','sm')}Andamento na planta</div><div class="viewer" style="height:300px;border:0"><div class="plan2d">${plan2D({})}</div></div></div>
</div></div>`;

/* ============ shell e render ============ */
function rail(){
  const items=SCREENS.map(s=>`<button class="ri desk ${S.screen===s.id?'on':''} ${s.id==='inicio'?'sep':''}" data-go="${s.id}" aria-label="${s.label}">${ic(s.icon)}${s.label}${s.dot?'<span class="dot"></span>':''}</button>`).join('');
  const mob=MOB.map(id=>{const s=SCREENS.find(x=>x.id===id);return `<button class="ri mob ${S.screen===id?'on':''}" data-go="${id}">${ic(s.icon)}${s.label}</button>`}).join('')+`<button class="ri mob ${!MOB.includes(S.screen)?'on':''}" data-act="sheet">${ic('menu')}Menu</button>`;
  return `<nav class="rail" aria-label="Módulos"><div class="logo"><span class="mk"><i style="height:12px"></i><i style="height:20px"></i><i style="height:16px"></i></span>pilar</div>${items}${mob}</nav>`;
}
const sheet=()=>S.sheet?`<div class="sheet-bg" data-act="sheet"><div class="sheet" onclick="event.stopPropagation()">${SCREENS.map(s=>`<button data-go="${s.id}">${ic(s.icon)}${s.label}</button>`).join('')}</div></div>`:'';
function render(){
  dispose3D();
  const id=S.screen;let content;
  if(S.state!=='cheio'){const v=V[id]();content=v.slice(0,v.indexOf('<div class="pc">'))+`<div class="pc">${stateView(id)}</div>`}
  else content=V[id]();
  const dv=document.getElementById('device');const top=dv.scrollTop,wy=window.scrollY;
  document.getElementById('app').innerHTML=`<div class="shell">${rail()}<main>${content}</main></div>${sheet()}`;
  dv.scrollTop=top;window.scrollTo(0,wy);
  document.querySelectorAll('#segDevice button').forEach(x=>x.classList.toggle('on',x.dataset.dev===S.device));
  document.querySelectorAll('#segState button').forEach(x=>x.classList.toggle('on',x.dataset.st===S.state));
  const g=document.querySelector('.gantt');if(g)g.style.setProperty('--g-name',getComputedStyle(g.querySelector('.g-head')).gridTemplateColumns.split(' ')[0]);
  if(S.state==='cheio')requestAnimationFrame(after);
}
function after(){
  const id=S.screen;const anim=S._anim||[];S._anim=null;
  if(id==='documentos'&&S.scanView==='3d'){const el=document.getElementById('scanViewer');if(el)mount3D(el,{neutral:true})}
  if(id==='campo'&&S.campoView==='3d'){const el=document.getElementById('campoViewer');if(el){
    const v=mount3D(el,{sel:S.campo==='review'?S.ans.walls:[],hlRoom:S.ans.room||(S.rdo==='completo'&&S.campo!=='idle'?'sala':null),pick:S.campo==='review'?k=>act('awall',k):null});
    if(v)anim.forEach((k,i)=>v.apply(k,true,i*300))}}
  if(id==='obra'&&S.obraView==='progresso'&&S.progView==='3d'){const el=document.getElementById('progViewer');if(el){
    const v=mount3D(el,{focus:S.layer,sel:S.sel,upper:S.sobrado,ext:S.layer==='externo',pick:S.layer==='paredes'?k=>act('wsel',k):null,auto:false});
    if(v)anim.forEach((k,i)=>v.apply(k,true,i*200))}}
}
function toast(t){const el=document.getElementById('toast');el.textContent=t;el.classList.add('on');clearTimeout(toast._t);toast._t=setTimeout(()=>el.classList.remove('on'),3600)}
function go(id){S.screen=id;S.sheet=false;render();document.getElementById('device').scrollTop=0;window.scrollTo({top:0})}
const DEF_WALLS={quarto1:['w7','w8','w15'],quarto2:['w4','w5','w16']};
function startReview(){
  const R=RDO[S.rdo];
  S.ans={room:null,walls:R?R.walls.slice():[],pct:R?R.pct:null,pessoas:null,material:null,etapa:R?R.etapa:0};
  S.campo='review';
}
function act(a,arg){
  switch(a){
    case 'st':S.state=arg;render();break;
    case 'sheet':S.sheet=!S.sheet;render();break;
    case 'toast':toast(arg);break;
    case 'dash':S.dashPeriod=arg;render();break;
    case 'dashtable':S.dashTable=!S.dashTable;render();break;
    case 'lead':S.lead=arg;S.waParsed=false;render();break;
    case 'comtab':S.comTab=arg;render();break;
    case 'waparse':S.waParsed=true;render();break;
    case 'prop':S.prop=+arg;if(+arg>1)S.proposalReplied=true;render();break;
    case 'replied':S.proposalReplied=true;render();toast('Resposta registrada no briefing.');break;
    case 'negopt':S.negOpt=arg;render();break;
    case 'negsend':if(S.negOpt==='a'){toast('Resposta preparada explicando o escopo. Valor mantido.');break}S.neg=1;render();toast(S.negOpt==='c'?'Abaixo da margem mínima: aprovado por você e enviado.':'v2 gerada (R$ 16.900) e enviada. A v1 fica no histórico.');break;
    case 'negaccept':S.neg=2;render();toast('Cliente aceitou a v2 no portal.');break;
    case 'tpl':S.tpl=arg;render();break;
    case 'scanview':S.scanView=arg;render();break;
    case 'scan':S.scan='reading';S.scanStep=0;render();
      const tick=()=>{S.scanStep++;if(S.scanStep>=SCAN_STEPS.length){S.scan='done';S.scanView='2d';render();toast('Planta lida. Confira antes de usar.');return}render();setTimeout(tick,800)};setTimeout(tick,800);break;
    case 'obraview':S.obraView=arg;render();break;
    case 'clima':S.clima=true;render();toast('Plano v14 aplicado. Equipe avisada no Pilar Campo.');break;
    case 'andaime':S.andaime=arg;render();break;
    case 'layer':S.layer=arg;S.sel=[];render();break;
    case 'floor':S.floor=arg;S.sel=[];render();break;
    case 'colorby':S.colorBy=arg;render();break;
    case 'progview':S.progView=arg;render();break;
    case 'wsel':{if(S.floor==='superior'&&!arg.startsWith('s'))arg='s'+arg;const i=S.sel.indexOf(arg);i>=0?S.sel.splice(i,1):S.sel.push(arg);const w=S.W[S.sel[0]];if(w&&w.e>=0){S.apE=w.e;S.apP=w.p}render();break}
    case 'selclear':S.sel=[];render();break;
    case 'rsel':S.selRoom=arg;render();break;
    case 'esel':S.selExt=arg;render();break;
    case 'ape':S.apE=+arg;render();break;
    case 'app':S.apP=+arg;render();break;
    case 'apply':S.sel.forEach(k=>S.W[k]={e:S.apE,p:S.apP,st:arg});S._anim=S.sel.slice();toast(`${S.sel.length} parede${S.sel.length>1?'s':''}: ${ETAPAS[S.apE].toLowerCase()} ${S.apP}%, ${arg}.`);S.sel=[];render();break;
    case 'campoview':S.campoView=arg;render();break;
    case 'rdo':S.rdo=arg;S.campo='idle';S.W=JSON.parse(JSON.stringify(W0));render();break;
    case 'manual':S.rdo='manual';S.ans={room:null,walls:[],pct:100,pessoas:null,material:null,etapa:0};S.campo='review';render();break;
    case 'rec':S.campo='recording';S.recTick=0;render();
      const rt=()=>{S.recTick++;if(S.recTick<=5){render();setTimeout(rt,600);return}S.campo='processing';render();setTimeout(()=>{startReview();render();toast(S.rdo==='vago'?'Faltou detalhe. A Pilar perguntou só o que faltou.':'Relato conferido com o projeto. Confira as paredes.')},1300)};setTimeout(rt,600);break;
    case 'aroom':S.ans.room=arg;S.ans.walls=DEF_WALLS[arg].slice();render();break;
    case 'awall':{const i=S.ans.walls.indexOf(arg);i>=0?S.ans.walls.splice(i,1):S.ans.walls.push(arg);render();break}
    case 'aetapa':S.ans.etapa=+arg;render();break;
    case 'apct':S.ans.pct=+arg;render();break;
    case 'apes':S.ans.pessoas=arg;render();break;
    case 'amat':S.ans.material=arg;render();break;
    case 'sendrdo':{const e=S.ans.etapa,p=S.ans.pct||100;S.ans.walls.forEach(k=>S.W[k]={e,p,st:'relatado'});S._anim=S.ans.walls.slice();S.campo='reported';render();toast('Relato ligado às paredes. Estado: relatado.');break}
    case 'confirm':S.ans.walls.forEach(k=>{if(S.W[k])S.W[k].st='confirmado'});S.campo='confirmed';render();toast('Conferido. Pode ir para o relatório do cliente.');break;
    case 'campoReset':S.campo='idle';render();break;
    case 'orctab':S.orcTab=arg;render();break;
    case 'frete':setTimeout(()=>{S.frete=true;render();toast('Frete recebido: R$ 220. Comparação atualizada.')},1500);break;
  }
}
document.addEventListener('click',e=>{
  const dv=e.target.closest('[data-dev]');if(dv){S.device=dv.dataset.dev;document.getElementById('device').className=S.device;render();return}
  const st=e.target.closest('[data-st]');if(st){S.state=st.dataset.st;render();return}
  const t=e.target.closest('[data-go],[data-act]');if(!t)return;
  if(t.dataset.act)act(t.dataset.act,t.dataset.arg);
  if(t.dataset.go)go(t.dataset.go);
});
document.addEventListener('input',e=>{
  const k=e.target.dataset.inp;if(!k)return;const v=Math.max(0,parseFloat(e.target.value)||0);
  if(k==='pa')S.pa=v;else S.pp[k.split('.')[1]]=v;updateProp();
});
document.addEventListener('change',e=>{
  const k=e.target.dataset.chk;if(!k)return;
  if(k==='sobrado'){S.sobrado=e.target.checked;if(!S.sobrado)S.floor='terreo';S.sel=[];render();return}
  S.pd[k]=e.target.checked;updateProp();
});
const tip=document.createElement('div');tip.id='tip';document.body.appendChild(tip);
document.addEventListener('mousemove',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.classList.remove('on');return}tip.textContent=t.dataset.tip;tip.style.left=e.clientX+'px';tip.style.top=e.clientY+'px';tip.classList.add('on')});
render();
