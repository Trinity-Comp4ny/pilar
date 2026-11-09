/* ---- modelos ---- */
const OBRA_SVC=[
  ['Alvenaria','Alvenaria → Chapisco → Reboco → Massa → Pintura','não (interna) · sim (fachada)','Alvenaria de vedação com bloco cerâmico','—'],
  ['Concretagem de laje','Forma → Armação → Concretagem → Cura','sim, decisão do RT','Concreto usinado + forma','—'],
  ['Reboco externo','Chapisco → Reboco → Pintura','sim','Emboço/reboco externo','Cor da fachada, 20 dias antes'],
  ['Elétrica','Tubulação → Fiação → Acabamento','não','Eletroduto, cabo, tomada','Posição de pontos, antes da tubulação'],
  ['Piso','Contrapiso → Assentamento → Rejunte','não','Contrapiso + porcelanato','Escolher piso, 10 dias antes da compra'],
  ['Impermeabilização','Preparo → Aplicação → Teste','sim','Manta asfáltica','—'],
  ['Piscina','Escavação → Estrutura → Impermeabilização → Revestimento → Equipamentos','sim','vários','Revestimento, 15 dias antes'],
  ['Jardim','Preparo do solo → Plantio → Irrigação','sim','—','Espécies, 7 dias antes']
];
V.modelos=()=>{
  const t=S.tpl;
  const list=`<div class="card p"><h3>Modelos</h3><div class="stack">
    <button class="item" style="text-align:left;border-color:hsl(var(--ink))"><span class="tt">Residencial térrea</span><span class="xs muted">proposta, projeto e obra · v3 · usado em 12</span></button>
    <button class="item" style="text-align:left"><span class="tt">Sobrado</span><span class="xs muted">proposta, projeto e obra · v1 · usado em 4</span></button>
    <button class="item" style="text-align:left"><span class="tt">Galpão metálico</span><span class="xs muted">proposta e projeto · v2 · usado em 3</span></button></div>
    <button class="btn outline sm mt" style="width:100%">Novo modelo</button>
    <div class="callout info xs mt">${ic('spark','sm')}<div>"Modelo" no lugar de "template": é a forma de trabalhar do escritório. Aparece na hora de criar proposta, projeto ou obra.</div></div></div>`;
  const prop=`<div class="card p"><h3>Proposta</h3><table class="t"><thead><tr><th>Disciplina</th><th class="num">R$/m²</th><th class="num">Mínimo</th><th class="num">Revisões</th></tr></thead><tbody>
    <tr><td>Estrutural</td><td class="num"><input class="inp" style="width:80px" value="70" aria-label="R$/m² estrutural"></td><td class="num">${brl(4500)}</td><td class="num">2</td></tr><tr><td>Elétrico</td><td class="num"><input class="inp" style="width:80px" value="40" aria-label="R$/m² elétrico"></td><td class="num">${brl(2500)}</td><td class="num">2</td></tr><tr><td>Hidrossanitário</td><td class="num"><input class="inp" style="width:80px" value="40" aria-label="R$/m² hidrossanitário"></td><td class="num">${brl(2500)}</td><td class="num">2</td></tr><tr><td>Compatibilização</td><td class="num">fixo</td><td class="num">${brl(2200)}</td><td class="num">1</td></tr></tbody></table>
    <div class="grid g2 mt xs soft"><div><b>Prazo</b><br>35 dias úteis após a arquitetura</div><div><b>Margem mínima</b><br>20%: abaixo disso a Pilar pede sua aprovação</div><div><b>Desconto</b><br>sempre ligado a escopo (menos revisões, menos disciplinas)</div><div><b>Lembretes</b><br>3 dias, no máximo 2</div></div></div>`;
  const proj=`<div class="card p"><h3>Projeto</h3><table class="t"><thead><tr><th>Entregável</th><th>Depende de</th><th>Pronto quando</th><th class="num">Dias</th></tr></thead><tbody>
    <tr><td>Estrutural</td><td>arquitetura aprovada</td><td class="xs">pranchas + memorial + ART</td><td class="num">15</td></tr><tr><td>Elétrico</td><td>layout da arquitetura</td><td class="xs">quadro de cargas + pranchas</td><td class="num">10</td></tr><tr><td>Hidrossanitário</td><td>layout da arquitetura</td><td class="xs">isométricos + pranchas</td><td class="num">10</td></tr><tr><td>Compatibilização</td><td>todas</td><td class="xs">interferências zeradas</td><td class="num">5</td></tr></tbody></table></div>`;
  const obra=`<div class="card"><div style="padding:14px 14px 0"><h3>Obra: serviços e etapas</h3><div class="xs muted">Daqui saem as etapas do progresso, o que depende de chuva, o material de cada etapa e as decisões do cliente.</div></div><div class="scroll-x"><table class="t"><thead><tr><th>Serviço</th><th>Etapas</th><th>Sensível a chuva</th><th>Composição SINAPI</th><th>Decisão do cliente</th></tr></thead><tbody>
    ${OBRA_SVC.map(r=>`<tr><td><b>${r[0]}</b></td><td class="xs">${r[1]}</td><td class="xs">${r[2].startsWith('sim')?b('info',r[2]):r[2]}</td><td class="xs muted">${r[3]}</td><td class="xs">${r[4]}</td></tr>`).join('')}</tbody></table></div></div>`;
  return head({crumbs:'Configurações',title:'Modelos',sub:'A forma de trabalhar do escritório. A Pilar usa para montar proposta, projeto, cronograma e progresso.',acts:`<button class="btn brand">Salvar como v4</button>`,tabs:tabsBar([['proposta','Proposta','file'],['projeto','Projeto','layers'],['obra','Obra','building']],t,'tpl')})+`<div class="pc"><div class="grid g-side-l">${list}<div class="stack">${t==='proposta'?prop:t==='projeto'?proj:obra}<div class="callout ok xs">${ic('lock','sm')}<div>Mudar o modelo não altera propostas, projetos e obras em andamento: cada um guarda a versão usada.</div></div></div></div></div>`;
};

/* ---- planta (scanner) ---- */
const SCAN_STEPS=['Formato: PDF vetorial (exportado do CAD)','Escala 1:50 conferida pela cota de 12,00 m','16 paredes e 13 aberturas nas linhas do PDF','5 ambientes pelo texto da planta','Pé-direito não está na planta: 2,80 m'];
V.documentos=()=>{
  const st=S.scan;const done=st==='done';
  const pipe=SCAN_STEPS.map((t,i)=>{const c=done||i<S.scanStep?'done':(st==='reading'&&i===S.scanStep?'on':'');return `<div class="s ${c}"><span class="m">${c==='done'?ic('check','sm'):''}</span><span>${t}</span></div>`}).join('');
  const vbtn=[['original','Original','file'],['2d','2D','plan'],['3d','3D','cube']].map(([k,l,i])=>`<button class="btn sm ${S.scanView===k?'brand':'outline'}" data-act="scanview" data-arg="${k}" ${!done&&k!=='original'?'disabled':''}>${ic(i,'sm')}${l}</button>`).join('');
  return head({crumbs:'Clientes › Carla Alves › Documentos',title:'Planta para 2D e 3D',sub:'A Pilar lê a planta e monta os ambientes. Você confere antes de usar.',acts:`<button class="btn outline">${ic('upload','sm')}Enviar outra versão</button>`})+`<div class="pc">
  <div class="grid" style="grid-template-columns:300px minmax(0,1fr) 300px">
    <div class="stack">
      <div class="file"><div class="ic">PDF</div><div style="min-width:0"><b class="xs">planta-residencia-alves.pdf</b><div class="xs muted">2,4 MB · v1 · veio do WhatsApp</div></div></div>
      <div class="card p"><h3>${ic('scan','sm')}Leitura</h3><div class="pipe">${pipe}</div>
        ${st==='idle'?`<button class="btn brand mt8" style="width:100%" data-act="scan">${ic('spark','sm')}Ler planta</button>`:''}</div>
      <div class="card p"><h3>${ic('layers','sm')}Como cada arquivo é lido</h3>
        <div class="fld" style="grid-template-columns:1fr auto"><span class="xs"><b>IFC</b> (BIM)</span>${b('success','direto')}</div>
        <div class="fld" style="grid-template-columns:1fr auto"><span class="xs"><b>DWG, DXF</b></span>${b('success','automático')}</div>
        <div class="fld" style="grid-template-columns:1fr auto"><span class="xs"><b>PDF do CAD</b></span>${b('success','automático + conferência')}</div>
        <div class="fld" style="grid-template-columns:1fr auto"><span class="xs"><b>Foto ou scan</b></span>${b('warning','traçado assistido')}</div>
        <div class="xs muted mt8">No traçado assistido você informa uma medida e clica nas paredes; a Pilar encaixa e monta o 3D.</div></div>
    </div>
    <div class="stack">
      <div class="row wrap">${vbtn}<span class="xs muted" style="margin-left:auto">${S.scanView==='3d'?'Arraste para girar':''}</span></div>
      <div class="viewer" id="scanViewer" style="height:520px">${st==='reading'?'<div class="scanline"></div>':''}${S.scanView!=='3d'?`<div class="plan2d">${plan2D({mode:S.scanView==='original'?'paper':'clean',progress:false})}</div>`:''}${S.scanView==='3d'?'<div class="hint">Geometria simplificada: paredes e aberturas</div>':''}</div>
    </div>
    <div class="stack">
      ${done?`<div class="card"><table class="t"><thead><tr><th>Ambiente</th><th class="num">Área</th><th class="num">Perím.</th></tr></thead><tbody>${ROOMS.terreo.map(r=>`<tr><td><b>${r.nome}</b></td><td class="num">${fmt(area(r))} m²</td><td class="num">${fmt(per(r))} m</td></tr>`).join('')}</tbody></table></div>
      <div class="card p"><h3>${ic('alert','sm')}Confirme</h3><div class="fld" style="grid-template-columns:1fr auto"><span class="xs">Pé-direito 2,80 m</span>${og('inferido')}</div><div class="fld" style="grid-template-columns:1fr auto"><span class="xs">Parede 15 cm</span>${og('inferido')}</div><div class="fld" style="grid-template-columns:1fr auto"><span class="xs">Pavimentos: 1</span>${og('pdf')}</div></div>
      <div class="card p"><h3>${ic('calc','sm')}Quantidades</h3><div class="fld" style="grid-template-columns:1fr auto auto"><span class="xs">Alvenaria</span><b class="xs">214 m²</b>${og('calc')}</div><div class="fld" style="grid-template-columns:1fr auto auto"><span class="xs">Reboco (2 faces)</span><b class="xs">392 m²</b>${og('calc')}</div><div class="fld" style="grid-template-columns:1fr auto auto"><span class="xs">Piso</span><b class="xs">108 m²</b>${og('calc')}</div></div>
      <button class="btn brand" data-act="toast" data-arg="Ambientes confirmados. A obra passa a usar a planta v1.">Confirmar ambientes</button>`:`<div class="card p xs soft">Depois da leitura aparecem os ambientes, o que confirmar e as quantidades.</div>`}
    </div>
  </div></div>`;
};

/* ---- obra: cronograma + clima ---- */
const DAYS=Array.from({length:21},(_,i)=>{const d=new Date(2026,10,2+i);return {i,dd:String(d.getDate()).padStart(2,'0'),dw:['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][d.getDay()],wk:d.getDay()===0}});
const RAIN=[3,4];const TODAY=2;
function tasks(){
  const a=S.clima;
  return [
    {g:'Estrutura',n:'Concretagem da laje da garagem',s:3,d:1,k:'critical',ch:'modelo'},
    {g:'Alvenaria',n:'Alvenaria quartos e banheiro',s:0,d:2,k:'done'},
    {g:'Alvenaria',n:'Alvenaria da sala',s:1,d:3,k:'progress'},
    {g:'Alvenaria',n:'Alvenaria da cozinha',s:16,d:3,k:'planned'},
    {g:'Instalações',n:'Elétrica interna dos quartos',s:a?3:8,d:4,k:'planned',mv:a},
    {g:'Revestimentos',n:'Montar andaime da fachada',s:2,d:1,k:'planned',ch:S.andaime==='sim'?'confirmado':S.andaime==='nao'?null:'?'},
    {g:'Revestimentos',n:'Reboco externo da fachada',s:a?7:3,d:2,k:'planned',ch:'modelo',mv:a},
    {g:'Revestimentos',n:'Reboco interno quartos e banheiro',s:7,d:3,k:'planned'},
    {g:'Revestimentos',n:'Contrapiso do banheiro',s:a?4:9,d:2,k:'planned',mv:a},
    {g:'Revestimentos',n:'Piso da sala',s:11,d:3,k:'blocked'}
  ];
}
const WX=[['Qua','04/11','sun',31,'0 mm'],['Qui','05/11','rain',22,'18 mm · 80%'],['Sex','06/11','rain',24,'6 mm · 60%'],['Sáb','07/11','cloud',27,'0 mm'],['Dom','08/11','sun',29,'0 mm'],['Seg','09/11','sun',30,'0 mm'],['Ter','10/11','cloud',28,'1 mm · 20%']];
function gantt(){
  let html=`<div class="gantt"><div class="g-head"><div></div>${DAYS.map(d=>`<div class="d ${d.i===TODAY?'today':''}">${d.dw}<b>${d.dd}</b></div>`).join('')}</div><div class="g-head"><div class="xs muted" style="padding:4px 0">Clima</div>${DAYS.map(d=>`<div class="w ${RAIN.includes(d.i)?'rain':''}">${d.i<9?ic(RAIN.includes(d.i)?'rain':d.i===5||d.i===8?'cloud':'sun','sm'):''}</div>`).join('')}</div>`;
  let g='';
  tasks().forEach(t=>{
    if(t.g!==g){g=t.g;html+=`<div class="g-row" style="border:0"><div class="g-grp">${g}</div></div>`}
    const label=t.k==='blocked'?'bloqueado':t.k==='critical'?'RT':t.k==='progress'?'relatado':t.k==='done'?'feito':'';
    const chip=t.ch==='?'?`<span class="qbadge" title="A Pilar acha que depende de chuva. Confirme.">chuva?</span>`:t.ch?`<span title="Sensível a chuva (${t.ch==='modelo'?'do modelo de obra':'confirmado por você'})">${ic('rain','sm')}</span>`:'';
    html+=`<div class="g-row"><div class="nm">${chip}<span class="tx">${t.n}</span></div>${DAYS.map(d=>`<div class="c ${RAIN.includes(d.i)?'rain':''} ${d.wk?'wk':''}"></div>`).join('')}<div class="gbar ${t.k} ${t.mv?'moved':''}" style="left:calc(var(--g-name) + ${t.s} * var(--cw) + 2px);width:calc(${t.d} * var(--cw) - 4px)">${label}</div></div>`;
  });
  return html+`</div>`;
}
function obraCronograma(){
  const a=S.clima;
  const wx=WX.map((w,i)=>`<div class="d ${w[2]==='rain'?'rain':''} ${i===0?'today':''}"><span class="dd">${w[0]} ${w[1]}</span>${ic(w[2],'lg')}<span class="tp">${w[3]}°</span><span class="xs ${w[2]==='rain'?'':'muted'}">${w[4]}</span></div>`).join('');
  return `<div class="row between wrap mb"><div class="h3" style="margin:0">${ic('sun','sm')}Próximos 7 dias</div><span class="xs muted">Open-Meteo (plano comercial) · consultado 06:00 · previsão não é certeza</span></div>
  <div class="wx mb">${wx}</div>
  <div class="grid g-side">
    <div class="card p"><h3>${ic('rain','sm')}Chuva forte amanhã: 2 tarefas sensíveis ${a?`<span class="r">${b('success','plano v14 aplicado')}</span>`:''}</h3>
      <div class="grid g2">
        <div><div class="xs muted" style="margin-bottom:6px">Afetadas</div>
          <div class="chk">${ic('alert','sm')}<div><b>Concretagem da laje da garagem</b><div class="xs soft">Crítica: o responsável técnico decide.</div><button class="btn outline sm mt8" data-act="toast" data-arg="Pedido de decisão enviado ao Eng. Paulo com a previsão anexada.">Pedir decisão ao RT</button></div></div>
          <div class="chk">${ic('sun','sm')}<div><b>Reboco externo da fachada</b><div class="xs soft">${a?'Movido para seg 09/11.':'Mover para seg 09/11 (sol).'}</div></div></div></div>
        <div><div class="xs muted" style="margin-bottom:6px">Alternativa para a equipe</div>
          <div class="chk"><span class="ok">${ic('check','sm')}</span><div><b>Elétrica interna dos quartos</b><div class="xs soft">Alvenaria confirmada · material em estoque</div></div></div>
          <div class="chk"><span class="ok">${ic('check','sm')}</span><div><b>Contrapiso do banheiro</b><div class="xs soft">Tubulação testada · cimento em estoque</div></div></div>
          <div class="chk"><span class="no">${ic('x','sm')}</span><div><b>Piso da sala</b><div class="xs soft">Falta argamassa AC-III</div></div></div></div>
      </div>
      ${a?`<div class="callout ok xs mt">${ic('check','sm')}<div>Aviso enviado ao Pilar Campo de 3 pessoas. Leram: 1 de 3.</div></div>`:`<div class="row wrap mt"><button class="btn brand" data-act="clima">Aplicar e avisar a equipe</button><button class="btn outline">Ajustar</button></div>`}
    </div>
    <div class="card p"><h3>${ic('spark','sm')}Como a Pilar sabe o que depende de chuva</h3>
      <div class="phase"><span class="n">1</span><div class="xs"><b>Modelo de obra.</b> Cada serviço já vem marcado (reboco externo, concretagem, impermeabilização, pintura externa, cobertura, piscina, jardim). Cobre a maioria.</div></div>
      <div class="phase"><span class="n">2</span><div class="xs"><b>Onde fica.</b> Tarefa ligada a fachada ou área externa da planta conta como externa.</div></div>
      <div class="phase"><span class="n">3</span><div class="xs"><b>Tarefa criada à mão.</b> O agente lê o nome e pergunta uma vez.</div></div>
      ${S.andaime?`<div class="callout ok xs mt8">${ic('check','sm')}<div>"Montar andaime da fachada" ${S.andaime==='sim'?'agora é sensível a chuva':'não depende de chuva'}. A regra vale para as próximas obras.</div></div>`:`<div class="qa mt8"><div class="q">"Montar andaime da fachada" depende de chuva?</div><div class="xs soft">É externa e tem trabalho em altura.</div><div class="chips"><button class="chip" data-act="andaime" data-arg="sim">Sim</button><button class="chip" data-act="andaime" data-arg="nao">Não</button></div></div>`}
      <div class="xs muted mt8">Limites (ex.: reboco para acima de 5 mm) são do responsável técnico.</div>
    </div>
  </div>
  <div class="card mt"><div class="row between wrap" style="padding:12px 14px"><div class="h3" style="margin:0">${ic('cal','sm')}Cronograma · 02 a 22/11</div><div class="row wrap xs"><span>${ic('rain','sm')} sensível a chuva</span>${b('success','feito')}${b('warning','relatado')}${b('proj','planejado')}${b('danger','bloqueado')}</div></div><div class="scroll-x" style="padding:0 14px 14px">${gantt()}</div></div>`;
}

/* ---- obra: progresso por elemento ---- */
const SVC=[['Elétrica',['Tubulação','Fiação','Acabamento']],['Hidráulica',['Tubulação','Teste','Louças']],['Piso',['Contrapiso','Assentamento','Rejunte']],['Forro',['Estrutura','Placas','Pintura']]];
const RPROG={
  sala:{Elétrica:[0,30,'relatado'],Piso:[-2],Forro:[-1]},
  cozinha:{Elétrica:[-1],Hidráulica:[0,60,'confirmado'],Piso:[-1],Forro:[-1]},
  quarto1:{Elétrica:[1,20,'relatado'],Piso:[-1],Forro:[-1]},
  banho:{Elétrica:[0,100,'confirmado'],Hidráulica:[1,100,'confirmado'],Piso:[0,50,'relatado']},
  quarto2:{Elétrica:[0,60,'confirmado'],Piso:[-1],Forro:[-1]}
};
const ESTR=[
  ['Fundação (radier)',['Escavação','Armação','Concretagem'],2,100,'confirmado',''],
  ['Pilares do térreo',['Forma','Armação','Concretagem'],2,100,'confirmado','12 de 12'],
  ['Laje do térreo',['Forma','Armação','Concretagem','Cura'],2,0,'','concretagem 05/11: decisão do RT'],
  ['Pilares do superior',['Forma','Armação','Concretagem'],-1,0,'','só no sobrado'],
  ['Cobertura',['Estrutura','Telhas','Calhas'],-1,0,'','']
];
const EXTP={
  piscina:[['Escavação',100,'confirmado'],['Estrutura',40,'relatado'],['Impermeabilização',0],['Revestimento',0],['Equipamentos',0]],
  jardim:[['Preparo do solo',0],['Plantio',0],['Irrigação',0]]
};
const etp=(names,cur,pct,blocked)=>`<div class="etp">${names.map((n,i)=>`<span class="${blocked?'b':i<cur?'d':i===cur?'c':''}">${n}${i===cur&&!blocked?` ${pct}%`:''}</span>`).join('')}</div>`;
function progressPanel(){
  const L=S.layer;
  if(L==='paredes'){
    if(!S.sel.length){
      const tot=ETAPAS.map((e,i)=>WALLS.filter(w=>{const x=S.W[w.id];return x&&(x.e>i||(x.e===i&&x.p===100))}).reduce((s,w)=>s+warea(w),0));
      return `<div class="card p"><h3>${ic('hand','sm')}Toque nas paredes</h3><div class="xs soft">Selecione uma ou várias paredes, escolha a etapa e quanto foi feito. Também dá para tocar no 3D.</div><hr class="s"><div class="xs muted" style="margin-bottom:6px">Feito no térreo (m² de parede)</div>${ETAPAS.map((e,i)=>`<div class="row between xs" style="padding:4px 0"><span><span class="sw" style="background:${ETCOL[i]};border:1px solid #0002"></span>${e}</span><b>${fmt(tot[i])} m²</b></div>`).join('')}</div>`;
    }
    const ws=S.sel.map(k=>({k,w:WALLS.find(w=>w.id===k.replace(/^s/,''))}));const m2=ws.reduce((s,x)=>s+warea(x.w),0);
    const f=S.W[S.sel[0]];
    return `<div class="card p"><h3>${S.sel.length===1?ws[0].w.nome:S.sel.length+' paredes'}<span class="r"><button class="btn ghost sm" data-act="selclear">Limpar</button></span></h3>
      <div class="xs muted">${fmt(m2)} m² líquidos (sem portas e janelas)${S.sel.length>1?' · '+ws.map(x=>x.w.nome).join(', '):''}</div>
      <div class="mt8">${f&&f.e>=0?etp(ETAPAS,f.e,f.p):etp(ETAPAS,-1,0)}</div>
      <hr class="s"><div class="xs muted" style="margin-bottom:6px">Etapa</div><div class="chips">${ETAPAS.map((e,i)=>`<button class="chip ${S.apE===i?'on':''}" data-act="ape" data-arg="${i}">${e}</button>`).join('')}</div>
      <div class="xs muted" style="margin:10px 0 6px">Quanto da etapa</div><div class="chips">${[25,50,75,100].map(p=>`<button class="chip ${S.apP===p?'on':''}" data-act="app" data-arg="${p}">${p}%</button>`).join('')}</div>
      <div class="row wrap mt"><button class="btn outline sm" data-act="apply" data-arg="relatado">Marcar como relatado</button><button class="btn brand sm" data-act="apply" data-arg="confirmado">Confirmar</button></div>
      <div class="xs muted mt8">Etapas e ordem vêm do modelo de obra. Chegar ao reboco marca alvenaria e chapisco como feitos.</div></div>`;
  }
  if(L==='ambientes'){
    const r=ROOMS.terreo.find(x=>x.id===S.selRoom)||ROOMS.terreo[0];const P=RPROG[r.id];
    return `<div class="card p"><h3>${r.nome}<span class="r xs muted">${fmt(area(r))} m²</span></h3>${SVC.filter(([n])=>P[n]).map(([n,et])=>{const v=P[n];const bl=v[0]===-2;return `<div class="svc"><div class="hd"><b>${n}</b>${bl?b('danger','bloqueado'):v[0]<0?b('neutral','não iniciado'):b(v[2]==='confirmado'?'success':'warning',v[2])}</div>${etp(et,bl?0:v[0],v[1]||0,bl)}</div>`}).join('')}
      <div class="xs muted mt8">Instalações e acabamentos são por ambiente: ninguém conta tomada por parede. Toque em outro ambiente na planta.</div></div>`;
  }
  if(L==='estrutura') return `<div class="card p"><h3>${ic('column','sm')}Estrutura</h3>${ESTR.filter(e=>S.sobrado||!e[5].includes('sobrado')).map(([n,et,c,p,st,nota])=>`<div class="svc"><div class="hd"><b>${n}</b>${c<0?b('neutral','não iniciado'):st?b(st==='confirmado'?'success':'warning',st):b('info','agendado')}</div>${etp(et,c<0?-1:c,p)}${nota?`<span class="xs muted">${nota}</span>`:''}</div>`).join('')}<div class="xs muted mt8">Concretagem tem trava: o responsável técnico libera.</div></div>`;
  const e=EXT.find(x=>x.id===S.selExt);
  return `<div class="card p"><h3>${ic(e.id==='piscina'?'wave':'tree','sm')}${e.nome}</h3>${EXTP[e.id].map(([n,p,st])=>`<div class="svc"><div class="hd"><span>${n}</span>${p===100?b('success',st):p?b('warning',`${p}% · ${st}`):b('neutral','não iniciado')}</div></div>`).join('')}<div class="xs muted mt8">Área externa entra como item próprio, com etapas do modelo. Toque na piscina ou no jardim.</div></div>`;
}
function obraProgresso(){
  const floorSeg=S.sobrado?seg([['terreo','Térreo'],['superior','Superior']],S.floor,'floor'):'';
  return `<div class="toolbar">
    ${seg([['paredes','Paredes'],['ambientes','Ambientes'],['estrutura','Estrutura'],['externo','Área externa']],S.layer,'layer')}
    ${floorSeg}
    <label class="row xs" style="gap:6px"><input type="checkbox" data-chk="sobrado" ${S.sobrado?'checked':''}> Ver como sobrado (exemplo)</label>
    <span style="margin-left:auto"></span>
    ${S.layer==='paredes'?seg([['etapa','Cor: etapa'],['conf','Cor: conferência']],S.colorBy,'colorby'):''}
    ${seg([['3d','3D'],['2d','2D']],S.progView,'progview')}
  </div>
  <div class="grid g-side"><div class="viewer" id="progViewer" style="height:520px">${S.progView==='2d'?`<div class="plan2d">${plan2D({floor:S.floor,interactive:true,sel:S.sel,layer:S.layer,ext:S.layer==='externo'})}</div>`:''}${S.layer==='paredes'?legend():''}${S.progView==='3d'?'<div class="hint hide-m">Arraste para girar · toque numa parede</div>':''}</div>${progressPanel()}</div>`;
}
V.obra=()=>head({crumbs:'Obras',title:'Residência Alves',sub:'Rua das Acácias, 210 · Bauru/SP · 38% concluída',acts:`<button class="btn outline">${ic('file','sm')}Diário</button>`,tabs:tabsBar([['cronograma','Cronograma e clima','cal'],['progresso','Progresso','cube']],S.obraView,'obraview')})+`<div class="pc">${S.obraView==='cronograma'?obraCronograma():obraProgresso()}</div>`;

/* ---- campo: RDO guiado ---- */
const RDO={
  completo:{fala:'"Hoje fomos eu, o Zé e dois serventes. Levantamos as paredes da sala até em cima, só falta a do fundo, que tá esperando o bloco."',
    guia:[['Quem trabalhou','4 pessoas: 2 pedreiros, 2 serventes','ok'],['O que fez','Alvenaria','ok'],['Onde','Sala: 3 paredes sugeridas pelo projeto','amb'],['Quanto','"até em cima" = 100%','ok'],['O que travou','Parede do fundo sem bloco','ok']],
    walls:['w1','w9','w10'],etapa:0,pct:100},
  vago:{fala:'"Hoje a gente adiantou o quarto e começou o reboco."',
    guia:[['Quem trabalhou','não falou','miss'],['O que fez','Reboco (começou)','ok'],['Onde','"o quarto": a obra tem 2','amb'],['Quanto','não falou','miss'],['O que travou','não falou (opcional)','miss']],
    walls:[],etapa:2,pct:null}
};
const GUIA=['Quem trabalhou','O que fez','Onde (ambiente e parede)','Quanto (metade, tudo)','O que travou ou faltou'];
function miniPlan(){return `<div class="mini">${plan2D({interactive:true,act:'awall',sel:S.ans.walls,layer:'campo',hl:S.ans.room,hitW:30})}</div>`}
function campoPhone(){
  const c=S.campo,R=RDO[S.rdo];let ph='';
  const guide=(state)=>`<div class="guide"><div class="xs muted" style="margin-bottom:4px">O que contar</div>${GUIA.map((g,i)=>{const st=state?state[i]:'';return `<div class="gi ${st}"><span class="m">${st==='ok'?ic('check'):st==='amb'?'!':''}</span><span>${g}</span></div>`}).join('')}</div>`;
  if(c==='idle') ph=`<div class="xs muted">Residência Alves · qua 04/11 · plano de hoje: alvenaria da sala</div>${guide()}<div style="flex:1"></div><button class="rec" data-act="rec" aria-label="Gravar áudio">${ic('mic','lg')}</button><div class="xs muted" style="text-align:center">Fale do seu jeito. A lista vai se marcando.</div><div class="row" style="justify-content:center;gap:10px"><button class="btn ghost sm">${ic('photo','sm')}Foto</button><button class="btn ghost sm" data-act="manual">${ic('hand','sm')}Marcar no desenho</button></div>`;
  if(c==='recording') ph=`<div class="xs muted">Gravando · 0:${String(4+S.recTick*3).padStart(2,'0')}</div>${guide(R.guia.map((g,i)=>i<S.recTick?(g[2]==='miss'?'':g[2]):''))}<div style="flex:1"></div><div class="wave">${Array.from({length:18},(_,i)=>`<i style="animation-delay:${(i%6)*0.1}s"></i>`).join('')}</div><button class="rec on" aria-label="Parar">${ic('mic','lg')}</button>`;
  if(c==='processing') ph=`<div class="bubble xs">${ic('mic','sm')} Áudio enviado</div><div class="row xs muted"><svg class="ring" viewBox="0 0 44 44" style="width:22px;height:22px"><circle class="bg" cx="22" cy="22" r="17"/><circle class="fg" cx="22" cy="22" r="17"/></svg>Conferindo com o projeto</div>`;
  if(c==='review'){
    const manual=S.rdo==='manual';
    const qs=[];
    if(!manual) qs.push(`<div class="bubble xs"><i>${R.fala}</i></div>`,guide(R.guia.map(g=>g[2])));
    if(S.rdo==='vago'){
      qs.push(`<div class="qa"><div class="q">Qual quarto?</div><div class="chips"><button class="chip ${S.ans.room==='quarto1'?'on':'sug'}" data-act="aroom" data-arg="quarto1">Quarto 1 · provável</button><button class="chip ${S.ans.room==='quarto2'?'on':''}" data-act="aroom" data-arg="quarto2">Quarto 2</button></div><div class="xs muted">Provável: o cronograma de hoje tem reboco no quarto 1.</div></div>`);
    }
    if(manual||S.rdo==='completo'||S.ans.room){
      qs.push(`<div class="qa"><div class="q">${manual?'Toque nas paredes que você fez':S.rdo==='completo'?'Confere as paredes?':'Quais paredes?'}</div>${miniPlan()}<div class="xs muted">${S.ans.walls.length} parede${S.ans.walls.length===1?'':'s'} · ${manual?'toque para marcar':'sugeridas pelo que você disse; toque para mudar'}</div></div>`);
    }
    if(manual) qs.push(`<div class="qa"><div class="q">Qual etapa?</div><div class="chips">${ETAPAS.map((e,i)=>`<button class="chip ${S.ans.etapa===i?'on':''}" data-act="aetapa" data-arg="${i}">${e}</button>`).join('')}</div></div>`);
    if(S.rdo==='vago'||manual) qs.push(`<div class="qa"><div class="q">${manual?'Quanto?':'Até onde foi o reboco?'}</div><div class="chips">${[25,50,75,100].map(p=>`<button class="chip ${S.ans.pct===p?'on':''}" data-act="apct" data-arg="${p}">${p===100?'Tudo':p+'%'}</button>`).join('')}</div></div>`);
    if(S.rdo==='vago'||manual) qs.push(`<div class="qa"><div class="q">Quantas pessoas trabalharam?</div><div class="chips">${['1','2','3','4','5+'].map(p=>`<button class="chip ${S.ans.pessoas===p?'on':''}" data-act="apes" data-arg="${p}">${p}</button>`).join('')}</div></div>`);
    if(S.rdo==='completo') qs.push(`<div class="qa"><div class="q">Sobrou bloco? <span class="xs muted" style="font-weight:400">(opcional)</span></div><div class="chips">${['Não sobrou','Uns 50','Uns 100'].map(p=>`<button class="chip ${S.ans.material===p?'on':''}" data-act="amat" data-arg="${p}">${p}</button>`).join('')}<button class="chip" data-act="amat" data-arg="pular">Pular</button></div></div>`);
    const ready=S.ans.walls.length&&(S.rdo==='completo'||(S.ans.pct&&S.ans.pessoas));
    qs.push(`<button class="btn brand" ${ready?'':'disabled'} data-act="sendrdo">Enviar relato</button>`);
    ph=qs.join('');
  }
  if(c==='reported'||c==='confirmed'){
    const R2=S.rdo==='vago'?'Reboco':S.rdo==='manual'?ETAPAS[S.ans.etapa]:'Alvenaria';
    ph=`<div class="callout ok xs">${ic('check','sm')}<div><b>Relato enviado.</b> ${R2} em ${S.ans.walls.length} parede${S.ans.walls.length===1?'':'s'}${S.ans.pct&&S.ans.pct<100?`, ${S.ans.pct}%`:''}. O gestor confere com foto.</div></div><div class="guide"><div class="xs muted">RDO de hoje</div><div class="xs mt8">Efetivo: ${S.rdo==='completo'?'4 (2 pedreiros, 2 serventes)':S.ans.pessoas||'—'}<br>Clima: sol, 31° (automático)<br>Serviço: ${R2.toLowerCase()}<br>${S.rdo==='completo'?'Impedimento: parede do fundo sem bloco<br>':''}</div></div><button class="btn outline sm" data-act="campoReset">Novo registro</button>`;
  }
  return `<div class="phone"><div class="bar0"><span>9:42</span><span>Pilar Campo</span><span>4G</span></div><div class="pb"><div class="row between"><b>Registrar</b>${b('obra','Residência Alves')}</div>${ph}</div></div>`;
}
function campoAnalysis(){
  const c=S.campo,R=RDO[S.rdo];
  if(c==='idle'||c==='recording'||c==='processing') return `<div class="card p"><h3>${ic('spark','sm')}Por que tem roteiro</h3><div class="xs soft">Relato livre costuma ser "a gente fez o quarto". O roteiro na tela lembra o que contar, a lista se marca enquanto a pessoa fala, e a Pilar só pergunta o que faltou. Ambiguidade se resolve pelo projeto: se há 2 quartos, ela mostra os 2.</div></div>`;
  if(c==='review'){
    if(S.rdo==='manual') return `<div class="card p"><h3>${ic('hand','sm')}Marcar no desenho</h3><div class="xs soft">Sem áudio: toque nas paredes, escolha a etapa e quanto foi feito. Serve para quem prefere não falar e para corrigir um relato.</div></div>`;
    return `<div class="card p"><h3>${ic('spark','sm')}O que a Pilar entendeu</h3>${R.guia.map(([k,v,st])=>`<div class="fld" style="grid-template-columns:120px 1fr auto"><span class="k">${k}</span><span class="xs">${v}</span>${st==='ok'?og('fala'):st==='amb'?og('projeto'):og('falta')}</div>`).join('')}<div class="xs muted mt8">Pergunta só o que falta e muda a decisão, com resposta de 1 toque.</div></div>`;
  }
  return c==='reported'?`<div class="card p"><h3>${ic('mic','sm')}Relatado agora <span class="r">${b('warning','aguardando conferência')}</span></h3><div class="xs soft">O áudio original fica guardado; a interpretação e as respostas ficam ao lado.</div><div class="row wrap mt"><button class="btn brand" data-act="confirm">${ic('photo','sm')}Confirmar com foto</button><button class="btn outline" data-act="toast" data-arg="Marcado como divergente. A equipe recebe a pergunta no Campo.">Não confere</button></div></div>`
  :`<div class="card p"><h3>${ic('check','sm')}Conferido por Marina <span class="r">${b('success','confirmado')}</span></h3><div class="xs soft">Pode entrar no relatório do cliente se você liberar.</div><button class="btn outline sm mt8" data-go="portal">Ver como o cliente vê</button></div>`;
}
V.campo=()=>head({crumbs:'Obras › Residência Alves',title:'Campo: RDO guiado',sub:'O pedreiro fala com um roteiro na tela. A Pilar marca o que ouviu, pergunta o que faltou e mostra no 3D.',acts:`<span class="xs muted">Simular:</span>${seg([['completo','Relato completo'],['vago','Relato vago']],S.rdo==='manual'?'':S.rdo,'rdo')}`,tabs:tabsBar([['3d','3D','cube'],['2d','2D','plan']],S.campoView,'campoview')})+`<div class="pc">
  <div class="row" style="gap:20px;align-items:flex-start;flex-wrap:wrap">${campoPhone()}
    <div class="stack" style="flex:1;min-width:280px"><div class="viewer" id="campoViewer" style="height:430px">${S.campoView==='2d'?`<div class="plan2d">${plan2D({sel:S.campo==='review'?S.ans.walls:[],hl:S.ans.room||(S.rdo==='completo'&&S.campo!=='idle'?'sala':null)})}</div>`:''}${legend()}</div>${campoAnalysis()}</div>
  </div></div>`;
