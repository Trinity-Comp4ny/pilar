/* ---- plano ---- */
V.plano=()=>{
  const it=(go,t,x,tag='',arg='')=>`<button class="it" data-go="${go}" ${arg}><span style="margin-top:1px">${ic(SCREENS.find(s=>s.id===go)?.icon||'check','sm')}</span><span><b>${t}</b>${tag?' '+tag:''}<span class="x">${x}</span></span></button>`;
  const out=(t,x)=>`<button class="it"><span>${ic('x','sm')}</span><span><b>${t}</b><span class="x">${x}</span></span></button>`;
  const nv=b('brand','v2');
  return head({title:'O plano em uma tela',sub:'Cada cartão abre a tela do protótipo. "v2" marca o que entrou com as suas sugestões de 04/11.',acts:`<button class="btn brand" data-go="campo">${ic('play','sm')}Ver o RDO guiado</button>`})+`<div class="pc">
  <div class="grid g4">
    <div class="lane now"><h4>${ic('clock','sm')}Agora, até o lançamento</h4><div class="k">nov/2026 a jan/2027</div>
      ${it('campo','Evidência do Campo imutável','Reenvio offline não troca a mídia sem aviso')}
      ${it('obra','Licença do clima','Open-Meteo no plano comercial ou proxy com chave')}
      ${it('precos','CUB e SINAPI automáticos','Sem upload manual; erro vai para quarentena')}
      ${it('orcamento','Total parcial na estimativa','Lacuna aparece no total e no PDF')}
      ${it('inicio','Dashboard de desempenho',"Receita, margem, conversão e prazo das obras",nv)}
    </div>
    <div class="lane la"><h4>${ic('funnel','sm')}Esteira A · do lead ao projeto</h4><div class="k">primeiro fluxo grande</div>
      ${it('comercial','Agente do funil e WhatsApp por link','Qualifica lead; wa.me com texto pronto')}
      ${it('modelos','Modelos de proposta, projeto e obra','Valores por disciplina, etapas e o que depende de chuva',nv)}
      ${it('proposta','Proposta em 1 minuto','Digita a área e o valor sai na hora',nv)}
      ${it('proposta','Negociação com histórico','Contraproposta, versões e motivo de cada uma',nv)}
      ${it('documentos','Planta para 2D e 3D','Começa assistida; automática por formato',nv)}
    </div>
    <div class="lane lb"><h4>${ic('building','sm')}Esteira B · obra</h4><div class="k">segundo fluxo grande</div>
      ${it('campo','RDO guiado por voz','Roteiro, checklist que se marca e perguntas do que faltou',nv)}
      ${it('obra','Progresso por elemento','Parede, ambiente, estrutura, área externa e sobrado',nv)}
      ${it('obra','Cronograma com clima','Sensível a chuva vem do modelo de obra',nv)}
      ${it('orcamento','Materiais pelo cronograma','Quantidade da planta × composição SINAPI',nv)}
      ${it('portal','Decisões do cliente antecipadas','Escolher piso até a data que a compra exige')}
    </div>
    <div class="stack">
      <div class="lane later"><h4>${ic('cal','sm')}Depois</h4>
        ${out('WhatsApp oficial (API da Meta)','Quando o volume pedir')}
        ${out('Leitura de planta por imagem','Piloto com API (Planner 5D) antes de decidir')}
        ${out('Prospecção em fontes públicas','PNCP e alvarás, como experimento')}
        ${out('Pedido, entrega e assinatura','Depois da cotação provar valor')}
      </div>
      <div class="lane out"><h4>${ic('x','sm')}Fora</h4>
        ${out('Scraping sem autorização','Nem contas de terceiros')}
        ${out('Compra automática','A Pilar prepara; você autoriza')}
        ${out('3D fotorealista','O 3D serve para acompanhar')}
      </div>
    </div>
  </div>
  <div class="grid g2 mt">
    <div class="card p"><h3>${ic('cube','sm')}Viabilidade do 3D a partir da planta</h3>
      <div class="phase"><span class="n">1</span><div><b>Traçado assistido</b> ${b('success','viável já')}<div class="xs soft">O usuário informa uma medida, clica nas paredes por cima do PDF e a Pilar encaixa nas linhas. O 3D sai dessas paredes (o que este protótipo já faz com Three.js).</div></div></div>
      <div class="phase"><span class="n">2</span><div><b>Automática para DWG, DXF e IFC</b> ${b('success','viável')}<div class="xs soft">O arquivo já traz as linhas ou o modelo. IFC abre direto no navegador (web-ifc / ThatOpen). PDF exportado do CAD também guarda as linhas.</div></div></div>
      <div class="phase"><span class="n">3</span><div><b>Automática para foto e scan</b> ${b('warning','piloto antes')}<div class="xs soft">Exige reconhecimento por imagem. Testar a API do Planner 5D e modelos abertos treinados no CubiCasa5K com 20 plantas reais antes de prometer.</div></div></div>
    </div>
    <div class="card p"><h3>${ic('check','sm')}Decisões de 04/11</h3><div class="stack xs soft">
      <div>${b('success','sim')} RDO por voz com roteiro na tela e perguntas só do que faltou.</div>
      <div>${b('success','sim')} Ambiguidade resolvida pelo projeto: "qual quarto?" mostra os quartos da planta.</div>
      <div>${b('success','sim')} Marcar no desenho: paredes, etapa e porcentagem.</div>
      <div>${b('success','sim')} Compras vira parte do Orçamento: materiais e cotações.</div>
      <div>${b('success','sim')} Negociação registra cada versão e contraproposta.</div>
      <div>${b('warning','a decidir')} Nome "Modelos" no lugar de "Templates".</div>
    </div></div>
  </div></div>`;
};

/* ---- início: dashboard + mesa ---- */
const MESES=['mai','jun','jul','ago','set','out'],REC=[62,71,58,77,77,86.4],DES=[48,52,50,55,58,61];
function chartRevExp(){
  const Wd=560,Hd=230,pl=36,pr=8,pt=14,pb=26,max=100,iw=Wd-pl-pr,ih=Hd-pt-pb,gw=iw/6,bw=16;
  const Y=v=>pt+ih-(v/max)*ih;
  const bar=(x,v,c,tip)=>{const y=Y(v),h=pt+ih-y,r=4;return `<path d="M${x} ${pt+ih}V${y+r}Q${x} ${y} ${x+r} ${y}H${x+bw-r}Q${x+bw} ${y} ${x+bw} ${y+r}V${pt+ih}Z" fill="${c}" data-tip="${tip}"/>`};
  let s=`<svg viewBox="0 0 ${Wd} ${Hd}" role="img" aria-label="Receita e despesa por mês, em mil reais">`;
  [0,25,50,75,100].forEach(v=>s+=`<line x1="${pl}" x2="${Wd-pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="hsl(220 13% 91%)"/><text x="${pl-6}" y="${Y(v)+4}" text-anchor="end" font-size="10" fill="hsl(220 9% 41%)">${v}</text>`);
  MESES.forEach((m,i)=>{const x0=pl+gw*i+gw/2-bw-1;s+=bar(x0,REC[i],'#3b82f6',`${m}: receita ${mil(REC[i]*1000)}`)+bar(x0+bw+2,DES[i],'#f59e0b',`${m}: despesa ${mil(DES[i]*1000)}`);s+=`<text x="${pl+gw*i+gw/2}" y="${Hd-8}" text-anchor="middle" font-size="11" fill="hsl(220 9% 41%)">${m}</text>`});
  const lx=pl+gw*5+gw/2;s+=`<text x="${lx-bw/2-1}" y="${Y(REC[5])-5}" text-anchor="middle" font-size="10.5" font-weight="600" fill="hsl(0 0% 10%)">86,4</text><text x="${lx+bw/2+1}" y="${Y(DES[5])-5}" text-anchor="middle" font-size="10.5" font-weight="600" fill="hsl(0 0% 10%)">61</text>`;
  return s+'</svg>';
}
function chartFunnel(){
  const D=[['Leads',61],['Aderentes',24],['Propostas',19],['Negociação',11],['Fechadas',8]];
  return `<div class="stack" style="gap:8px">${D.map(([l,v],i)=>`<div><div class="row between xs"><span>${l}</span><span><b>${v}</b>${i?` <span class="muted">· ${Math.round(v/D[i-1][1]*100)}% da etapa anterior</span>`:''}</span></div><div class="track" style="height:10px;margin-top:4px"><div class="f" style="width:${v/61*100}%" data-tip="${l}: ${v}"></div></div></div>`).join('')}</div>`;
}
function chartObras(){
  const O=[['Residência Alves',38,41],['Galpão Vale Norte',72,65],['Clínica Sorriso',20,35],['Casa Lima',90,88],['Reforma Centro',55,50]];
  return O.map(([n,f,t])=>{const late=f<t-5;return `<div class="obr"><span><b>${n}</b></span><div class="track"><div class="f" style="width:${f}%" data-tip="${n}: ${f}% feito"></div><div class="tk" style="left:${t}%" data-tip="${n}: ${t}% do prazo passou"></div></div><span>${late?b('danger','atrasando'):b('success','no prazo')}</span></div>`}).join('');
}
const mesa=()=>`<div class="grid g4">
    <div class="col"><div class="hd">${ic('check','sm')}Pronto para decidir<span class="n">3</span></div>
      <div class="item"><div class="who">${ic('file','sm')}Proposta · Carla Alves</div><div class="tt">Contraproposta: R$ 15.000</div><div class="xs soft">3 caminhos prontos, 1 dentro da sua margem mínima.</div><button class="btn brand sm" data-go="proposta" data-act="prop" data-arg="4">Responder</button></div>
      <div class="item"><div class="who">${ic('rain','sm')}Clima · Residência Alves</div><div class="tt">Chuva amanhã: alternativa pronta</div><div class="xs soft">2 tarefas internas com pré-requisitos conferidos.</div><button class="btn brand sm" data-go="obra" data-act="obraview" data-arg="cronograma">Ver alternativa</button></div>
      <div class="item"><div class="who">${ic('calc','sm')}Orçamento · Residência Alves</div><div class="tt">Blocos: 3 respostas para comparar</div><button class="btn outline sm" data-go="orcamento" data-act="orctab" data-arg="cotacoes">Comparar</button></div>
    </div>
    <div class="col"><div class="hd">${ic('clock','sm')}Em execução<span class="n">3</span></div>
      <div class="item"><div class="tt">Acompanhando proposta do Galpão Vale Norte</div><div class="xs soft">Aberta 2 vezes. Lembrete pronto para 06/11.</div></div>
      <div class="item"><div class="tt">Importando SINAPI out/2026</div><div class="xs soft">4.881 insumos conferidos.</div></div>
      <div class="item"><div class="tt">Relatório semanal da Residência Alves</div><div class="xs soft">Sai sexta às 17:00 com o que você liberar.</div></div>
    </div>
    <div class="col"><div class="hd">${ic('user','sm')}Aguardando terceiro<span class="n">2</span></div>
      <div class="item"><div class="tt">Arquitetura: posição do quadro elétrico</div><div class="xs soft">Elétrico segue nos quartos; sala espera.</div></div>
      <div class="item"><div class="tt">Cliente: escolher o piso da cozinha</div><div class="xs soft">Prazo 12/11 para a compra chegar a tempo.</div></div>
    </div>
    <div class="col"><div class="hd">${ic('alert','sm')}Bloqueado<span class="n">1</span></div>
      <div class="item"><div class="tt">Piso da sala sem argamassa AC-III</div><div class="xs soft">Falta material e a alvenaria da sala não foi conferida.</div><button class="btn outline sm" data-go="orcamento" data-act="orctab" data-arg="materiais">Ver material</button></div>
    </div>
  </div>`;
V.inicio=()=>{
  const tbl=`<table class="t"><thead><tr><th>Mês</th><th class="num">Receita</th><th class="num">Despesa</th><th class="num">Resultado</th></tr></thead><tbody>${MESES.map((m,i)=>`<tr><td>${m}</td><td class="num">${mil(REC[i]*1000)}</td><td class="num">${mil(DES[i]*1000)}</td><td class="num">${mil((REC[i]-DES[i])*1000)}</td></tr>`).join('')}</tbody></table>`;
  return head({title:'Início',sub:'Como o escritório está indo e o que precisa de você hoje.',acts:seg([['mes','Mês'],['tri','Trimestre'],['ano','12 meses']],S.dashPeriod,'dash')})+`<div class="pc">
  <div class="grid" style="grid-template-columns:repeat(5,minmax(0,1fr))">
    <div class="card p kpi"><div class="l">Receita recebida em out</div><div class="v">R$ 86,4 mil</div><div class="d up">▲ 12% sobre set</div></div>
    <div class="card p kpi"><div class="l">A receber em 30 dias</div><div class="v">R$ 54,2 mil</div><div class="d muted">9 parcelas · 2 vencidas</div></div>
    <div class="card p kpi"><div class="l">Margem média dos projetos</div><div class="v">31%</div><div class="d muted">meta 30%</div></div>
    <div class="card p kpi"><div class="l">Propostas fechadas</div><div class="v">42%</div><div class="d down">▼ desconto médio 8%</div></div>
    <div class="card p kpi"><div class="l">Obras no prazo</div><div class="v">4 de 5</div><div class="d down">Clínica Sorriso atrasando</div></div>
  </div>
  <div class="grid g2 mt">
    <div class="card p chart"><h3>Receita e despesa, em R$ mil<span class="r"><button class="btn ghost sm" data-act="dashtable">${S.dashTable?'Ver gráfico':'Ver tabela'}</button></span></h3>
      ${S.dashTable?tbl:`<div class="lg"><span><i style="background:#3b82f6"></i>Receita</span><span><i style="background:#f59e0b"></i>Despesa</span></div>${chartRevExp()}`}</div>
    <div class="card p chart"><h3>Funil do trimestre</h3>${chartFunnel()}<div class="xs muted mt8">Maior perda: de lead para aderente. 7 de 9 leads do post "reforma em 30 dias" pediam execução.</div></div>
  </div>
  <div class="grid g-side mt">
    <div class="card p chart"><h3>Obras: feito x prazo<span class="r xs muted">barra = feito · traço = prazo que já passou</span></h3>${chartObras()}</div>
    <div class="card p"><h3>${ic('alert','sm')}Margem abaixo da meta</h3><div class="stack xs">
      <div class="row between"><span><b>Clínica Sorriso</b><br><span class="muted">2 revisões fora do escopo</span></span>${b('danger','18%')}</div>
      <div class="row between"><span><b>Casa Lima</b><br><span class="muted">horas do elétrico 40% acima</span></span>${b('warning','24%')}</div>
      <div class="row between"><span><b>Reforma Centro</b><br><span class="muted">aditivo pronto para enviar</span></span>${b('warning','27%')}</div></div></div>
  </div>
  <div class="sec-t">${ic('spark','sm')}Mesa de operação<span class="r xs muted" style="font-weight:400">o que a Pilar preparou e o que espera de você</span></div>
  ${mesa()}
  <div class="grid g2 mt">
    <div class="card p"><h3>${ic('mic','sm')}Relatado pelo Campo hoje</h3><div class="xs soft">Seu Joaquim, 09:42: alvenaria da sala, 3 de 4 paredes. Aguardando conferência.</div><button class="btn brand sm mt8" data-go="campo">Conferir</button></div>
    <div class="card p"><h3>${ic('spark','sm')}Entrega concluída</h3><div class="xs soft">Projeto estrutural do Galpão Vale Norte foi aceito. Seu próximo cliente pode conhecer seu trabalho por esta entrega.</div><button class="btn outline sm mt8">Conhecer a EkoAI</button></div>
  </div></div>`;
};

/* ---- comercial ---- */
const LEADS={
  carla:{nome:'Carla Alves',pedido:'Casa térrea 108 m², estrutural e complementares',origem:'Indicação · Arq. Bruna Reis',av:['success','Aderente'],mot:'Serviço que o escritório faz, região atendida, arquitetura pronta.',prox:'Em negociação',tel:'5514900000001'},
  vale:{nome:'Construtora Vale Norte',pedido:'Galpão 1.200 m², estrutural metálico',origem:'Google · busca orgânica',av:['success','Aderente'],mot:'Cliente recorrente em potencial; estrutural com capacidade em dezembro.',prox:'Proposta enviada',tel:'5514900000002'},
  clinica:{nome:'Clínica Sorriso',pedido:'Reforma comercial 180 m², arquitetura e elétrico',origem:'Instagram · "antes e depois"',av:['warning','Talvez'],mot:'Arquitetura não é o foco; elétrico sim. Sugerir parceria com arquiteto.',prox:'Perguntar escopo',tel:'5514900000003'},
  rodrigo:{nome:'Rodrigo Menezes',pedido:'Reforma de apartamento, quer só execução',origem:'Instagram · "reforma em 30 dias"',av:['neutral','Fora do perfil'],mot:'Pede execução de obra, não projeto.',prox:'Encerrar com indicação',tel:'5514900000004'}
};
const WA_CONVERSA=`[03/11 19:12] Carla: Oi! A Bruna me passou seu contato. Estamos construindo uma casa térrea em Bauru, uns 108 m².
[03/11 19:13] Carla: Precisamos do projeto estrutural, elétrico e hidráulico. Te mando a planta.
[03/11 19:13] Carla: <anexo: planta-residencia-alves.pdf>
[03/11 19:15] Carla: A ideia é começar a obra em março.`;
V.comercial=()=>{
  const L=LEADS[S.lead];
  const waText=`Oi, ${L.nome.split(' ')[0]}! Aqui é a Marina, da Duarte & Lima. Recebi a planta, obrigada. Só preciso confirmar: a arquitetura já está aprovada na prefeitura?`;
  const rows=Object.entries(LEADS).map(([k,l])=>`<tr class="click ${k===S.lead?'sel':''}" data-act="lead" data-arg="${k}"><td><b>${l.nome}</b><div class="xs muted">${l.pedido}</div></td><td class="xs hm">${l.origem}</td><td>${b(l.av[0],l.av[1])}<div class="xs muted mt8 hide-m" style="max-width:260px">${l.mot}</div></td><td class="xs">${l.prox}</td></tr>`).join('');
  const parsed=S.waParsed?`<div class="stack mt8">${agent('<b>Organizei a conversa.</b> O que falta virou pergunta.')}
    <div class="fld"><span class="k">Serviços</span><span>Estrutural, elétrico, hidrossanitário</span>${og('conversa')}</div>
    <div class="fld"><span class="k">Área</span><span>108 m², térrea</span>${og('conversa')}</div>
    <div class="fld"><span class="k">Início desejado</span><span>mar/2027 <span class="xs muted">(expectativa)</span></span>${og('conversa')}</div>
    <div class="fld"><span class="k">Arquitetura aprovada?</span><span class="muted">não informado</span>${og('falta')}</div></div>`:'';
  return head({title:'Comercial',sub:'O agente do funil avalia cada lead contra o perfil do escritório e lê a conversão por origem.',acts:`<button class="btn outline">${ic('copy','sm')}Colar conversa</button><button class="btn brand" data-go="proposta" data-act="prop" data-arg="2">Nova proposta</button>`,tabs:tabsBar([['leads','Leads','funnel'],['funil','Leitura do funil','chart']],S.comTab,'comtab')})+`<div class="pc">
  ${S.comTab==='leads'?`
  <div class="grid g-side">
    <div class="card"><table class="t cards"><thead><tr><th>Lead</th><th class="hm">Origem</th><th>Avaliação do agente</th><th>Próximo passo</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="card p"><h3>${L.nome}<span class="r">${b(L.av[0],L.av[1])}</span></h3>
      <div class="xs soft">${L.pedido}</div>
      <hr class="s"><div class="h3">${ic('msg','sm')}WhatsApp por link</div>
      <div class="bubble xs">${waText}</div>
      <div class="row wrap mt8"><a class="btn brand sm" target="_blank" rel="noopener" href="https://wa.me/${L.tel}?text=${encodeURIComponent(waText)}">${ic('send','sm')}Abrir no WhatsApp</a><button class="btn outline sm" data-act="toast" data-arg="Resposta registrada. A Pilar volta a acompanhar a partir dela.">Cliente respondeu</button></div>
      <hr class="s"><div class="h3">${ic('copy','sm')}Conversa colada</div>
      <textarea aria-label="Conversa do WhatsApp" style="width:100%;min-height:90px;border:1px solid hsl(var(--border-strong));border-radius:10px;padding:8px;font:12px/1.4 ui-monospace,monospace">${WA_CONVERSA}</textarea>
      <button class="btn ${S.waParsed?'outline':'brand'} sm mt8" data-act="waparse">${ic('spark','sm')}${S.waParsed?'Organizado':'Organizar conversa'}</button>
      ${parsed}
      ${S.waParsed?`<button class="btn brand mt" style="width:100%" data-go="proposta" data-act="prop" data-arg="1">Preparar proposta ${ic('arrow','sm')}</button>`:''}
    </div>
  </div>`:`
  <div class="grid g-side">
    <div class="card"><table class="t"><thead><tr><th>Origem</th><th class="num">Leads</th><th class="num">Aderentes</th><th class="num">Propostas</th><th class="num">Fechados</th></tr></thead><tbody>
      <tr><td><b>Indicação de arquitetos</b></td><td class="num">5</td><td class="num">4</td><td class="num">3</td><td class="num">2</td></tr>
      <tr><td><b>Google</b></td><td class="num">6</td><td class="num">3</td><td class="num">2</td><td class="num">1</td></tr>
      <tr><td><b>Instagram · "reforma em 30 dias"</b><div class="xs muted">utm_campaign=reforma30</div></td><td class="num">9</td><td class="num">1</td><td class="num">0</td><td class="num">0</td></tr>
      <tr><td><b>Instagram · "antes e depois"</b></td><td class="num">4</td><td class="num">1</td><td class="num">1</td><td class="num">0</td></tr>
    </tbody></table></div>
    <div class="stack">
      ${agent('<b>O post "reforma em 30 dias" traz quem quer execução.</b><div class="xs soft mt8">7 de 9 pediram obra, não projeto. Sugestão: trocar a chamada para "projeto estrutural e complementares".</div><button class="btn outline sm mt8" data-act="toast" data-arg="Sugestão enviada à plataforma de marketing.">Enviar ao marketing</button>','Agente do funil')}
      ${agent('<b>Indicação de arquiteto fecha 4 vezes mais.</b><div class="xs soft mt8">3 parceiros sem notícia há 60 dias. Mensagem pronta para cada um.</div>','Agente do funil')}
    </div>
  </div>`}</div>`;
};

/* ---- proposta ---- */
const PSTEPS=[['Lead','qualificado'],['Briefing','o que o cliente quer'],['Proposta','pelo modelo'],['Envio','e-mail ou WhatsApp'],['Negociação','versões e contraproposta'],['Aceite','vira cliente e projeto']];
const DISC=[['est','Estrutural',4500],['ele','Elétrico',2500],['hid','Hidrossanitário',2500]];
function propCalc(){
  const rows=DISC.map(([k,n,min])=>({k,n,on:S.pd[k],v:S.pd[k]?Math.max(S.pa*S.pp[k],min):0,min}));
  const comp=S.pd.comp?2200:0;const total=rows.reduce((s,r)=>s+r.v,0)+comp;
  const cub=S.pa*2238.58;return {rows,comp,total,cmin:cub*.88,cmax:cub*1.12,prazo:S.pa>200?45:35};
}
function updateProp(){
  const c=propCalc();const set=(id,t)=>{const el=document.getElementById(id);if(el)el.textContent=t};
  c.rows.forEach(r=>set('pv-'+r.k,r.on?brl(r.v):'fora'));set('pv-comp',S.pd.comp?brl(2200):'fora');
  set('ptotal',brl(c.total));set('pcub',`${mil(c.cmin)} a ${mil(c.cmax)}`);set('pprazo',`${c.prazo} dias úteis`);
}
const VERS=[
  {v:'v1',d:'04/11 10:42',val:18400,who:'us',t:'Enviada por e-mail e WhatsApp',m:'2 revisões por disciplina'},
  {v:'',d:'05/11 09:15',val:15000,who:'cl',t:'Contraproposta da cliente',m:'"Ficou acima do que planejamos para projeto."'},
  {v:'v2',d:'05/11 11:30',val:16900,who:'us',t:'Nova versão enviada',m:'1 revisão por disciplina em vez de 2'},
  {v:'',d:'05/11 16:48',val:16900,who:'ok',t:'Aceita no portal',m:'Versão v2 guardada como aceita'}
];
V.proposta=()=>{
  const p=S.prop;const c=propCalc();
  const steps=PSTEPS.map(([t,s],i)=>`<button class="step ${i<p?'done':i===p?'on':''}" data-act="prop" data-arg="${i}"><div class="bar"></div><div class="lb">${i+1}. ${t}<b>${s}</b></div></button>`).join('');
  let body='',side='';
  if(p===0){body=`<div class="card p"><h3>Carla Alves ${b('success','Aderente')}</h3><div class="soft">Casa térrea de 108 m² em Bauru. Estrutural, elétrico e hidrossanitário.</div>
    <div class="grid g3 mt"><div class="kpi"><div class="l">Origem</div><b>Indicação · Arq. Bruna</b></div><div class="kpi"><div class="l">Capacidade</div><b>Estrutural livre em dez</b></div><div class="kpi"><div class="l">Ticket provável</div><b>R$ 15 a 20 mil</b></div></div>
    <button class="btn brand mt" data-act="prop" data-arg="1">Organizar briefing ${ic('arrow','sm')}</button></div>`}
  if(p===1){body=`<div class="card p"><h3>Briefing</h3><div class="xs muted" style="margin-top:-6px;margin-bottom:6px">O que o cliente quer, com a origem de cada dado.</div>
    <div class="fld"><span class="k">Serviços</span><span>Estrutural, elétrico, hidrossanitário</span>${og('conversa')}</div>
    <div class="fld"><span class="k">Área</span><span>108,0 m², térrea</span>${og('pdf')}</div>
    <div class="fld"><span class="k">Cidade</span><span>Bauru/SP</span>${og('conversa')}</div>
    <div class="fld"><span class="k">Início desejado</span><span>mar/2027</span>${og('conversa')}</div>
    <div class="fld"><span class="k">Arquitetura aprovada?</span><span>${S.proposalReplied?'Sim, em 20/10':'<span class="muted">aguardando</span>'}</span>${S.proposalReplied?og('conversa'):og('falta')}</div>
    <div class="row wrap mt">${S.proposalReplied?`<button class="btn brand" data-act="prop" data-arg="2">Montar proposta ${ic('arrow','sm')}</button>`:`<a class="btn outline sm" target="_blank" rel="noopener" href="https://wa.me/5514900000001?text=${encodeURIComponent('Oi, Carla! A arquitetura já está aprovada na prefeitura?')}">${ic('send','sm')}Perguntar pelo WhatsApp</a><button class="btn brand sm" data-act="replied">Registrar: aprovada</button>`}</div></div>`}
  if(p===2){body=`<div class="card p"><h3>Proposta · modelo Residencial térrea <span class="r"><button class="btn ghost sm" data-go="modelos">Trocar modelo</button></span></h3>
    <div class="pin" style="border-top:1px solid hsl(var(--border))"><label for="pa"><b>Área construída</b></label><div><input id="pa" type="number" min="20" step="1" data-inp="pa" value="${S.pa}" aria-label="Área em m²"></div><span class="pv xs muted">m² · ${og('pdf')}</span></div>
    ${c.rows.map(r=>`<div class="pin"><label><input type="checkbox" data-chk="${r.k}" ${r.on?'checked':''}> ${r.n}</label><div class="row" style="gap:4px"><span class="xs muted">R$/m²</span><input type="number" min="0" step="5" data-inp="pp.${r.k}" value="${S.pp[r.k]}" aria-label="Preço por m² ${r.n}"></div><b class="pv num" id="pv-${r.k}">${r.on?brl(r.v):'fora'}</b></div>`).join('')}
    <div class="pin"><label><input type="checkbox" data-chk="comp" ${S.pd.comp?'checked':''}> Compatibilização</label><span class="xs muted">valor fixo</span><b class="pv num" id="pv-comp">${S.pd.comp?brl(2200):'fora'}</b></div>
    <details class="more mt8"><summary>${ic('arrow','sm')}Condições (do modelo)</summary><div class="grid g2 xs soft"><div><b>Inclui</b><br>2 revisões por disciplina, memorial, ART</div><div><b>Não inclui</b><br>taxas de prefeitura, arquitetura</div><div><b>Pagamento</b><br>30% de sinal, saldo em até 3x</div><div><b>Mínimo por disciplina</b><br>Estrutural R$ 4.500 · demais R$ 2.500</div></div></details>
    <div class="row mt"><button class="btn brand" data-act="prop" data-arg="3">Aprovar e enviar</button><button class="btn ghost">${ic('file','sm')}Ver PDF</button></div></div>`;
    side=`<div class="card p"><div class="xs muted">Total da proposta</div><div class="big" id="ptotal">${brl(c.total)}</div><div class="xs soft">Prazo: <b id="pprazo">${c.prazo} dias úteis</b> após a arquitetura</div><hr class="s"><div class="xs muted">Estimativa da obra para o cliente</div><b id="pcub">${mil(c.cmin)} a ${mil(c.cmax)}</b><div class="xs muted">${og('cub')} R8-N · faixa ±12% · não substitui orçamento executivo</div><hr class="s"><div class="xs muted">Mude a área ou o R$/m²: tudo recalcula na hora.</div></div>`}
  if(p===3){body=`<div class="card p"><h3>Envio</h3><div class="grid g3">
    <div class="card p"><div class="h3">${ic('send','sm')}E-mail</div><div class="xs soft">PDF + link de aceite.</div><div class="mt8">${b('success','entregue')} ${b('info','aberto 14:05')}</div></div>
    <div class="card p"><div class="h3">${ic('msg','sm')}WhatsApp</div><div class="xs soft">Texto e link prontos.</div><a class="btn outline sm mt8" target="_blank" rel="noopener" href="https://wa.me/5514900000001?text=${encodeURIComponent('Carla, segue a proposta: https://app.pilarsoft.com.br/p/7f3k')}">Abrir</a></div>
    <div class="card p"><div class="h3">${ic('copy','sm')}Link</div><div class="xs soft">app.pilarsoft.com.br/p/7f3k</div><button class="btn ghost sm mt8" data-act="toast" data-arg="Link copiado.">Copiar</button></div></div>
    <button class="btn brand mt" data-act="prop" data-arg="4">Acompanhar ${ic('arrow','sm')}</button></div>`}
  if(p===4){
    const shown=S.neg===0?VERS.slice(0,2):S.neg===1?VERS.slice(0,3):VERS;
    const opts=[['a','Manter R$ 18.400','Explicar o que está incluído. Margem 34%.','neutral','34%'],['b','R$ 16.900 com menos revisões','1 revisão por disciplina. Desconto ligado a escopo. Margem 28%.','success','28%'],['c','Aceitar R$ 15.000','Mesmo escopo. Margem 14%, abaixo do mínimo de 20%.','danger','14%']];
    body=`<div class="card p"><h3>Negociação ${S.neg===0?b('warning','contraproposta recebida'):S.neg===1?b('info','v2 enviada'):b('success','aceita')}</h3>
      ${shown.map(v=>`<div class="vt"><span class="dt ${v.who}"></span><div><div class="row between wrap"><b>${v.t}${v.v?' · '+v.v:''}</b><b class="num">${brl(v.val)}</b></div><div class="xs muted">${v.d} · ${v.m}</div></div></div>`).join('')}
      ${S.neg===0?`<div class="mt8">${agent(`<b>3 caminhos.</b> Recomendo o do meio: o desconto vem de escopo, não do seu preço.<div class="grid g3 mt8">${opts.map(([k,t,d,tone,mg])=>`<button class="opt ${S.negOpt===k?'on':''}" data-act="negopt" data-arg="${k}"><b class="xs">${t}</b><span class="xs soft">${d}</span>${b(tone,'margem '+mg)}</button>`).join('')}</div><div class="row wrap mt8"><button class="btn brand sm" data-act="negsend">${S.negOpt==='c'?'Pedir sua aprovação e enviar':'Gerar v2 e enviar'}</button><a class="btn outline sm" target="_blank" rel="noopener" href="https://wa.me/5514900000001?text=${encodeURIComponent('Carla, consigo chegar a R$ 16.900 com 1 revisão por disciplina. Te mando a proposta atualizada?')}">Responder pelo WhatsApp</a></div>`,'Agente comercial')}</div>`:''}
      ${S.neg===1?`<button class="btn brand mt" data-act="negaccept">Simular aceite no portal</button>`:''}
      ${S.neg===2?`<button class="btn brand mt" data-act="prop" data-arg="5">Ver conversão ${ic('arrow','sm')}</button>`:''}</div>`;
    side=`<div class="card p"><h3>${ic('file','sm')}Histórico</h3><table class="t"><thead><tr><th>Versão</th><th class="num">Valor</th><th>Estado</th></tr></thead><tbody><tr><td>v1</td><td class="num">${brl(18400)}</td><td>${b('neutral','substituída')}</td></tr><tr><td>Cliente</td><td class="num">${brl(15000)}</td><td>${b('warning','contraproposta')}</td></tr>${S.neg>=1?`<tr><td>v2</td><td class="num">${brl(16900)}</td><td>${S.neg===2?b('success','aceita'):b('info','enviada')}</td></tr>`:''}</tbody></table><div class="xs muted mt8">Cada versão guarda valor, escopo, quem mudou e por quê. Vale para qualquer valor: proposta de R$ 50 mil, contraproposta de R$ 40 mil, e assim por diante.</div></div>`;
  }
  if(p===5){body=`<div class="card p"><h3>${ic('check','sm')}Proposta aceita · v2 · ${brl(16900)}</h3>
    <div class="grid g3">
      <div class="card p"><div class="xs muted">Lead</div><b>Carla Alves</b><div class="mt8">${b('success','virou cliente')}</div></div>
      <div class="card p"><div class="xs muted">Projeto criado</div><b>Residência Alves</b><div class="mt8">${b('proj','4 disciplinas')}</div><div class="xs soft mt8">Entregas e prazos do modelo de projeto.</div></div>
      <div class="card p"><div class="xs muted">Financeiro</div><b>Sinal ${brl(5070)}</b><div class="mt8">${b('info','programado')}</div></div>
    </div>
    <div class="mt">${agent('<b>Vai acompanhar a obra?</b> A planta conferida vira os ambientes, o cronograma e o 3D.<div class="row wrap mt8"><button class="btn brand sm" data-go="documentos">Conferir a planta</button><button class="btn outline sm" data-go="obra">Criar obra</button></div>')}</div></div>`}
  return head({crumbs:'Comercial › Carla Alves',title:'Do lead ao projeto',sub:'O que a Pilar fez e o que precisa de você, passo a passo.'})+`<div class="pc">
    <div class="card p mb"><div class="steps">${steps}</div></div>
    <div class="grid g-side"><div>${body}</div><div class="stack">${side||`<div class="card p xs soft">${ic('spark','sm')} A Pilar registra cada passo: quem fez, quando e com que dado. Nada sai para o cliente sem você aprovar.</div>`}</div></div></div>`;
};
