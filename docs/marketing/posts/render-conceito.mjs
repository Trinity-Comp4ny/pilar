/**
 * Posts-conceito: uma foto que carrega a ideia e uma frase curta por cima (docs/marketing/08-direcao-criativa.md).
 * A foto é a metáfora do escritório de projeto (tapume, escalímetro, carimbo, placa de obra...), o texto
 * só fecha a piada ou a tese. Nada de cartão, ícone ou lista: a imagem faz o trabalho.
 *
 *   node docs/marketing/posts/render-conceito.mjs            todas
 *   node docs/marketing/posts/render-conceito.mjs placa      só as que contêm "placa"
 *
 * Fotos em docs/marketing/posts/fotos/ (geradas no Figma AI, JPG 1024 × 1280, ampliadas para 1080 × 1350).
 * Saída em docs/marketing/posts/out/conceito/. Regras: texto de no mínimo 32 px, verde nunca como
 * texto sobre fundo claro, símbolo numa cor só, nada de número sem "exemplo".
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");
const TPL = resolve(ROOT, "brand/social/templates");
const OUT = resolve(HERE, "out/conceito");
const FOTO = (n) => pathToFileURL(resolve(HERE, "fotos", n + ".jpg")).href;

const MARK = `<svg viewBox="0 0 27.6 22.6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M.8 .8H26.8"/><path d="M2.8 4.8H24.8"/><path d="M6.8 7.8V21.8"/><path d="M13.8 7.8V21.8"/><path d="M20.8 7.8V21.8"/></svg>`;
// rodapé: claro (texto branco sobre degradê escuro) ou escuro (texto tinta, sem degradê)
const foot = (tom = "escuro", { degrade = tom === "claro" } = {}) =>
  `${degrade ? '<div class="deg"></div>' : ""}<div class="foot ${tom}"><span class="who">${MARK}<span>Pilar</span></span><span>@pilarsoft.app</span></div>`;

const css = `
html,body{margin:0}
.c{position:relative;width:1080px;height:1350px;overflow:hidden;font-family:Geist,Inter,system-ui,sans-serif;color:#1A1A1A}
.c>img.bg{position:absolute;inset:0;width:1080px;height:1350px;object-fit:cover}
.a{position:absolute}
.h{font-weight:600;letter-spacing:-.045em;line-height:1.02}
.b{font-weight:450;font-size:38px;line-height:1.35;letter-spacing:-.01em}
.w{color:#fff}
.soft{opacity:.62}
.deg{position:absolute;left:0;right:0;bottom:0;height:360px;background:linear-gradient(to top,rgba(10,12,10,.85),rgba(10,12,10,0))}
.foot{position:absolute;left:90px;right:90px;bottom:70px;display:flex;justify-content:space-between;align-items:center;font-size:30px;font-weight:500}
.foot .who{display:flex;align-items:center;gap:16px;font-weight:600;font-size:34px;letter-spacing:-.02em}
.foot svg{width:44px}
.foot.claro,.foot.claro .who{color:#fff}.foot.escuro,.foot.escuro .who{color:#1A1A1A}
.shadow{text-shadow:0 2px 30px rgba(0,0,0,.35)}
`;

const P = {};

// 1 · Tapume: a frase pintada no tapume, como aviso de obra.
P["01-tapume"] = `<img class="bg" src="${FOTO("tapume")}">
  <div class="a h" style="left:110px;top:560px;width:860px;font-size:84px">Esta obra não depende do grupo do WhatsApp.</div>
  <div class="a b" style="left:110px;top:820px;width:820px;color:#3D3D3D">Diário, fotos e pendências da obra no mesmo lugar que o projeto.</div>
  ${foot("claro", { degrade: false })}`;

// 2 · Escalímetro: a precisão do projeto contra a imprecisão da gestão.
P["02-escalimetro"] = `<img class="bg" src="${FOTO("escalimetro")}">
  <div class="a h" style="left:90px;top:110px;width:900px;font-size:92px">Você mede tudo em milímetro.</div>
  <div class="a h" style="left:90px;top:1040px;width:620px;font-size:56px">E a margem de cada projeto, <span style="background:#A4EC86;border-radius:.2em;padding:0 .14em;font-style:italic">quem mede?</span></div>
  ${foot("escuro")}`;

// 3 · Carimbo: a assinatura da marca termina num carimbo de verdade.
P["03-carimbo"] = `<img class="bg" src="${FOTO("carimbo")}">
  <svg width="0" height="0" style="position:absolute"><filter id="tinta"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.6"/><feComposite in="SourceGraphic" operator="in"/></filter></svg>
  <div class="a h" style="left:90px;top:620px;width:900px;font-size:88px">A IA prepara.<br>O sistema confere.</div>
  <div class="a" style="left:130px;top:880px;transform:rotate(-7deg);filter:url(#tinta);color:#B3261E;border:9px solid currentColor;border-radius:18px;padding:22px 44px;font:700 100px/1 Geist;letter-spacing:-.02em;opacity:.88;box-shadow:inset 0 0 0 5px #fff, inset 0 0 0 12px currentColor">VOCÊ APROVA.</div>
  ${foot("escuro")}`;

// 4 · Betoneira: a tempestade chegando e a pergunta que todo mundo já viveu.
P["04-betoneira"] = `<img class="bg" src="${FOTO("betoneira")}">
  <div class="a h w shadow" style="left:90px;top:120px;width:900px;font-size:96px">A betoneira já saiu.</div>
  <div class="a h w shadow soft" style="left:90px;top:250px;width:900px;font-size:96px;opacity:.7">A previsão dizia chuva.</div>
  <div class="a b w" style="left:90px;top:1120px;width:880px">Marque quem precisa olhar a previsão antes de marcar a concretagem.</div>
  ${foot("claro")}`;

// 5 · Placa de obra: o formato oficial, preenchido com a verdade.
P["05-placa"] = `<img class="bg" src="${FOTO("placa")}">
  <div class="a" style="left:206px;top:256px;width:676px;height:402px;background:#fff;display:flex;flex-direction:column;font-size:33px">
    <div style="background:#1A1A1A;color:#fff;font-weight:700;letter-spacing:.12em;padding:20px 30px;font-size:32px">PLACA DE OBRA</div>
    ${[["Obra", "Residencial exemplo"], ["Responsável técnico", "você"], ["Responsável pela planilha", "ninguém"], ["Prazo", "perguntar no grupo"]]
      .map(([k, v], i) => `<div style="flex:1;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:0 30px;${i ? "border-top:2px solid #D9D9D9" : ""}"><span style="color:#5F6572">${k}</span><b style="font-weight:600;letter-spacing:-.02em">${v}</b></div>`)
      .join("")}
  </div>
  ${foot("claro")}`;

// 6 · Nível: a bolha no centro é a tese.
P["06-nivel"] = `<img class="bg" src="${FOTO("nivel")}">
  <div class="a h" style="left:90px;top:170px;width:900px;font-size:110px">Projeto e caixa no mesmo nível.</div>
  <div class="a b" style="left:90px;top:1050px;width:860px;color:#3D3D3D">Escopo, prazo e financeiro de cada projeto na mesma tela.</div>
  ${foot("escuro")}`;

// 7 · Capacete na mesa: o escritório que projeta e acompanha a obra.
P["07-capacete"] = `<img class="bg" src="${FOTO("capacete")}">
  <div class="a h" style="left:330px;top:120px;width:680px;font-size:74px">De manhã, no escritório.<br><span style="color:#5F4A2E">À tarde, na obra.</span></div>
  <div class="a b" style="left:330px;top:440px;width:660px;color:#3D3D3D">A Pilar vai junto: no computador e no celular.</div>
  ${foot("claro")}`;

// 8 · Celular sobre a prancha: o produto na prática, com a tela do assistente.
const tela = `<div class="a" style="left:366px;top:300px;width:338px;height:708px;border-radius:40px;overflow:hidden;background:#F7F7F7;font-family:Geist;display:flex;flex-direction:column">
  <div style="height:58px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 30px 6px;font:600 17px Geist"><span>9:41</span><span>●●● ▮</span></div>
  <div style="display:flex;align-items:center;gap:12px;padding:16px 22px;border-bottom:1px solid #E5E5E5;background:#fff"><span style="width:30px;color:#1A1A1A">${MARK}</span><b style="font-size:21px;letter-spacing:-.02em">Assistente Pilar</b></div>
  <div style="flex:1;padding:20px 18px;display:flex;flex-direction:column;gap:16px">
    <div style="align-self:flex-end;max-width:84%;background:#1A1A1A;color:#fff;border-radius:20px 20px 4px 20px;padding:14px 16px;font-size:19px;line-height:1.3">Lança a revisão 3 do estrutural do Ed. Aurora como aditivo.</div>
    <div style="background:#fff;border-radius:20px;padding:18px;box-shadow:0 0 0 1px #E5E5E5;display:flex;flex-direction:column;gap:8px">
      <span style="font:600 14px Inter;letter-spacing:.1em;color:#5F6572">ADITIVO PREPARADO</span>
      <b style="font-size:22px;letter-spacing:-.02em">Revisão 3 · Estrutural</b>
      <span style="font-size:17px;color:#5F6572">Ed. Aurora (exemplo)</span>
      <b style="font-size:34px;letter-spacing:-.03em;margin-top:4px">R$ 4.800</b>
      <span style="font-size:15px;color:#5F6572">valor de exemplo · 12 h de revisão</span>
      <div style="display:flex;gap:10px;margin-top:10px"><span style="flex:1;text-align:center;background:#A4EC86;border-radius:999px;padding:12px 0;font:600 18px Geist">Aprovar</span><span style="flex:1;text-align:center;border-radius:999px;padding:12px 0;font:600 18px Geist;box-shadow:inset 0 0 0 1.5px #1A1A1A">Ajustar</span></div>
    </div>
  </div></div>`;
P["08-celular"] = `<img class="bg" src="${FOTO("celular")}">${tela}
  <div class="a h" style="left:90px;top:96px;width:900px;font-size:76px;text-align:center">Pediu pelo celular.</div>
  <div class="a h" style="left:230px;top:1040px;width:620px;font-size:52px;text-align:center">Chegou pronto<br>para você aprovar.</div>
  ${foot("escuro")}`;

// 9 · Planilhas de madrugada: a cena que todo sócio conhece.
P["09-planilhas"] = `<img class="bg" src="${FOTO("planilhas")}">
  <div class="a" style="left:0;top:0;width:1080px;height:520px;background:linear-gradient(to bottom,rgba(8,10,8,.55),rgba(8,10,8,0))"></div>
  <div class="a h w" style="left:430px;top:110px;width:560px;font-size:170px;text-align:right">23h47.</div>
  <div class="a b w" style="left:430px;top:310px;width:560px;text-align:right;font-size:44px">Fechando o mês na planilha. De novo.</div>
  <div class="a h w" style="left:90px;top:1090px;width:900px;font-size:54px">Fechar o mês não precisa virar madrugada.</div>
  ${foot("claro")}`;

// 10 · Caixa de ferramentas: cada coisa no seu lugar.
P["10-ferramentas"] = `<img class="bg" src="${FOTO("ferramentas")}">
  <div class="a h w" style="left:170px;top:250px;width:740px;font-size:80px">Cada coisa no seu lugar.</div>
  <div class="a b w" style="left:170px;top:430px;width:720px;opacity:.85">Proposta, projeto, obra e financeiro também.</div>
  ${foot("escuro")}`;

// 11 · Vergalhões: a estrutura, com um cartão de papel por cima.
P["11-vergalhoes"] = `<img class="bg" src="${FOTO("vergalhoes")}">
  <div class="a" style="left:90px;top:400px;width:900px;height:560px;background:#FCFCFC;border-radius:6px;box-shadow:0 40px 80px -30px rgba(0,0,0,.55);padding:70px 70px;box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between">
    <div class="h" style="font-size:92px">Estrutura não se improvisa.</div>
    <div class="b" style="color:#3D3D3D">Nem na obra, nem no escritório que projeta a obra.</div>
    <div style="display:flex;justify-content:space-between;align-items:center;font-size:30px;font-weight:500;color:#5F6572"><span style="display:flex;align-items:center;gap:14px;color:#1A1A1A;font-weight:600;font-size:34px"><span style="width:44px">${MARK}</span>Pilar</span><span>@pilarsoft.app</span></div>
  </div>`;

// 12 · Caixa de papéis: a pergunta que ninguém consegue responder rápido.
P["12-caixa-papeis"] = `<img class="bg" src="${FOTO("caixa-papeis")}">
  <div class="a h" style="left:90px;top:130px;width:900px;font-size:90px">Cadê o contrato da revisão 2?</div>
  <div class="a h" style="left:90px;top:340px;width:900px;font-size:90px;color:#8A8F99">Na caixa. Em algum lugar.</div>
  <div class="a b" style="left:90px;top:1100px;width:880px;color:#3D3D3D">Na Pilar, cada documento fica dentro do projeto.</div>
  ${foot("escuro")}`;

// ---------- Série 2: objetos digitais (sem foto). A tela que todo sócio reconhece, com uma virada. ----------
const papel = (corpo, { bg = "#F2F1EE" } = {}) => `<div class="a" style="inset:0;background:${bg}"></div>${corpo}`;
const lupa = `<svg viewBox="0 0 24 24" width="34" fill="none" stroke="#8A8F99" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>`;

// 13 · Busca: o autocompletar que entrega a dor
P["13-busca"] = papel(`
  <div class="a h" style="left:90px;top:120px;width:900px;font-size:72px">O que todo escritório de projeto já pesquisou:</div>
  <div class="a" style="left:90px;top:400px;width:900px;background:#fff;border-radius:34px;box-shadow:0 30px 70px -30px rgba(0,0,0,.3),0 0 0 2px #E4E4E4;overflow:hidden">
    <div style="display:flex;align-items:center;gap:22px;padding:34px 40px;font-size:42px;border-bottom:2px solid #EDEDED">${lupa}<span>como cobrar revisão<span style="display:inline-block;width:3px;height:44px;background:#1A1A1A;vertical-align:-6px;margin-left:4px"></span></span></div>
    ${["de projeto", "sem perder o cliente", "que o cliente jura que é ajuste", "pela quarta vez"].map((s) => `<div style="display:flex;align-items:center;gap:22px;padding:24px 40px;font-size:38px;color:#3D3D3D">${lupa}<span>como cobrar revisão <b style="font-weight:650;color:#1A1A1A">${s}</b></span></div>`).join("")}
  </div>
  <div class="a b" style="left:90px;top:1010px;width:880px;color:#3D3D3D">Resposta curta: <b style="color:#1A1A1A;font-weight:600">aditivo</b>, registrado no dia em que o pedido chega.</div>
  ${foot("escuro")}`);

// 14 · Arquivos: a pasta de propostas de sempre
const arq = ["Proposta_Aurora_v2.docx", "Proposta_Aurora_v2_revisada.docx", "Proposta_Aurora_FINAL.docx", "Proposta_Aurora_FINAL_v2.docx", "Proposta_Aurora_FINAL_agora_vai.docx", "Proposta_Aurora_FINAL_agora_vai (1).docx"];
P["14-arquivos"] = papel(`
  <div class="a h" style="left:90px;top:120px;width:900px;font-size:84px">Qual dessas foi para o cliente?</div>
  <div class="a" style="left:90px;top:380px;width:900px;background:#fff;border-radius:22px;box-shadow:0 30px 70px -30px rgba(0,0,0,.3),0 0 0 2px #E4E4E4;overflow:hidden">
    <div style="display:flex;gap:12px;padding:22px 28px;background:#F7F7F7;border-bottom:2px solid #EDEDED"><i style="width:18px;height:18px;border-radius:50%;background:#D9D9D9"></i><i style="width:18px;height:18px;border-radius:50%;background:#D9D9D9"></i><i style="width:18px;height:18px;border-radius:50%;background:#D9D9D9"></i><span style="margin-left:16px;font-size:30px;color:#5F6572">Propostas › Ed. Aurora (exemplo)</span></div>
    ${arq.map((n, i) => `<div style="display:flex;align-items:center;gap:20px;padding:20px 28px;font-size:32px;${i === arq.length - 1 ? "background:#1A1A1A;color:#fff" : i % 2 ? "background:#FAFAFA" : ""}"><span style="width:36px;height:44px;border-radius:6px;background:${i === arq.length - 1 ? "#fff" : "#DDE6F5"};flex:none"></span>${n}</div>`).join("")}
  </div>
  <div class="a b" style="left:90px;top:1090px;width:880px;color:#3D3D3D">Marque quem salva assim. A gente não conta pra ninguém.</div>
  ${foot("escuro")}`);

// 15 · Laudo: o concreto passou, a gestão não
const linha = (k, v, ok) => `<div style="display:flex;justify-content:space-between;align-items:center;padding:26px 40px;border-top:2px solid #E4E4E4;font-size:34px"><span>${k}</span><span style="display:flex;align-items:center;gap:18px;font-weight:650">${v}<i style="font-style:normal;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:28px;background:${ok ? "#1A1A1A" : "#B3261E"};color:#fff">${ok ? "✓" : "✕"}</i></span></div>`;
P["15-laudo"] = papel(`
  <div class="a h" style="left:90px;top:120px;width:900px;font-size:84px">O concreto passou no ensaio. A gestão, não.</div>
  <div class="a" style="left:90px;top:440px;width:900px;background:#fff;border-radius:10px;box-shadow:0 30px 70px -30px rgba(0,0,0,.3),0 0 0 2px #E4E4E4">
    <div style="padding:34px 40px;display:flex;justify-content:space-between;align-items:flex-end"><div><div style="font:700 30px Geist;letter-spacing:.14em">RELATÓRIO DE ENSAIO</div><div style="font-size:30px;color:#5F6572;margin-top:8px">Ed. Aurora · exemplo</div></div><div style="font-size:30px;color:#5F6572">28 dias</div></div>
    ${linha("Resistência à compressão", "30 MPa", true)}${linha("Aprovação do cliente", "47 dias", false)}${linha("Revisões fora do escopo", "6", false)}${linha("Aditivos emitidos", "0", false)}
  </div>
  <div class="a b" style="left:90px;top:1080px;width:880px;color:#3D3D3D">O projeto é calculado. A margem também deveria ser.</div>
  ${foot("escuro")}`);

// 16 · Notificações: antes das 7h
const notif = (app, tit, txt, hora) => `<div style="background:rgba(255,255,255,.14);backdrop-filter:blur(10px);border-radius:30px;padding:26px 30px;color:#fff"><div style="display:flex;justify-content:space-between;font-size:26px;opacity:.75"><span>${app}</span><span>${hora}</span></div><div style="font:600 34px Geist;margin-top:8px;letter-spacing:-.02em">${tit}</div><div style="font-size:32px;opacity:.85;margin-top:4px">${txt}</div></div>`;
P["16-notificacoes"] = `<div class="a" style="inset:0;background:radial-gradient(120% 80% at 50% 0%,#2B3A33,#0C0E0C)"></div>
  <div class="a" style="left:0;top:110px;width:1080px;text-align:center;color:#fff"><div style="font-size:34px;opacity:.8">terça-feira, 11 de novembro</div><div style="font:600 190px/1 Geist;letter-spacing:-.05em;margin-top:10px">6:58</div></div>
  <div class="a" style="left:110px;top:440px;width:860px;display:flex;flex-direction:column;gap:18px">
    ${notif("Grupo · Obra Ed. Aurora", "47 mensagens novas", "Mestre: chegou o aço, mas faltou o de 10", "agora")}
    ${notif("Cliente", "Pode só dar uma olhadinha?", "É um ajuste rapidinho na fachada", "6:41")}
    ${notif("Agenda", "Compatibilização às 8h", "Estrutural × hidráulica", "6:30")}
  </div>
  <div class="a h w" style="left:90px;top:1060px;width:900px;font-size:62px">O seu dia começa no grupo ou no planejamento?</div>
  ${foot("claro", { degrade: false })}`;

// 17 · Post-it: o lembrete que não cobra ninguém
P["17-postit"] = papel(`
  <div class="a h" style="left:90px;top:120px;width:900px;font-size:96px">Hoje é 11/11.</div>
  <div class="a" style="left:230px;top:350px;width:620px;height:600px;background:#F6E27A;transform:rotate(-4deg);box-shadow:0 40px 60px -30px rgba(0,0,0,.45);padding:70px 60px;box-sizing:border-box;font:500 italic 64px/1.2 Geist;letter-spacing:-.03em;color:#2B2A26">
    <div style="font-size:36px;font-style:normal;opacity:.7">12/08</div><div style="margin-top:26px">cobrar a revisão do Aurora!!</div><div style="margin-top:20px;font-size:40px;font-style:normal;opacity:.7">(sem falta)</div></div>
  <div class="a b" style="left:90px;top:1060px;width:880px;color:#3D3D3D">Lembrete não cobra ninguém. <b style="color:#1A1A1A;font-weight:600">Aditivo, sim.</b></div>
  ${foot("escuro")}`);

// 18 · Agenda: onde foi parar a semana
const bloco = (dia, top, h, txt, escuro) => `<div style="position:absolute;left:${dia * 176 + 4}px;top:${top}px;width:168px;height:${h}px;border-radius:14px;padding:14px;box-sizing:border-box;font:600 26px/1.15 Geist;letter-spacing:-.02em;background:${escuro ? "#1A1A1A" : "#E7ECEF"};color:${escuro ? "#fff" : "#1A1A1A"}">${txt}</div>`;
P["18-agenda"] = papel(`
  <div class="a h" style="left:90px;top:120px;width:900px;font-size:92px">Onde foi parar a semana?</div>
  <div class="a" style="left:90px;top:380px;width:900px;height:620px;background:#fff;border-radius:22px;box-shadow:0 30px 70px -30px rgba(0,0,0,.3),0 0 0 2px #E4E4E4;padding:24px 10px 0;box-sizing:border-box">
    <div style="display:flex;font:600 28px Geist;color:#5F6572">${["seg", "ter", "qua", "qui", "sex"].map((d) => `<span style="width:176px;text-align:center">${d}</span>`).join("")}</div>
    <div style="position:relative;margin-top:16px;height:540px">
      ${bloco(0, 0, 250, "Ajuste rápido na fachada", true)}${bloco(0, 270, 200, "Grupo da obra")}
      ${bloco(1, 0, 160, "Revisar a revisão", true)}${bloco(1, 180, 300, "Ajuste rápido (parte 2)", true)}
      ${bloco(2, 0, 200, "Reunião")}${bloco(2, 220, 230, "Planilha do mês")}
      ${bloco(3, 0, 330, "O cliente mudou de ideia", true)}${bloco(3, 350, 140, "Grupo da obra")}
      ${bloco(4, 0, 180, "Planilha do mês")}${bloco(4, 200, 150, "Projeto (enfim)")}
    </div></div>
  <div class="a b" style="left:90px;top:1060px;width:880px;color:#3D3D3D">Ajuste rápido de 14 horas tem nome: <b style="color:#1A1A1A;font-weight:600">aditivo.</b></div>
  ${foot("escuro")}`);

// 19 · Planilha interditada: fita zebrada sobre o controle
const celulas = Array.from({ length: 9 }, (_, r) => `<div style="display:flex">${Array.from({ length: 6 }, (_, c) => `<div style="width:150px;height:62px;border:1px solid #E1E1E1;box-sizing:border-box;font-size:24px;color:#5F6572;padding:16px 10px;background:${r === 0 ? "#F2F2F2" : "#fff"}">${r === 0 ? ["Projeto", "Fase", "Valor", "Pago", "Margem", "Obs"][c] : c === 4 ? "#REF!" : ""}</div>`).join("")}</div>`).join("");
const fita = (top, rot) => `<div style="position:absolute;left:-120px;top:${top}px;width:1320px;height:86px;transform:rotate(${rot}deg);background:repeating-linear-gradient(45deg,#F2C230 0 46px,#1A1A1A 46px 92px);display:flex;align-items:center;justify-content:center;box-shadow:0 10px 30px rgba(0,0,0,.25)"><span style="background:#F2C230;padding:6px 26px;font:800 40px Geist;letter-spacing:.14em;color:#1A1A1A">NÃO MEXA NA FÓRMULA</span></div>`;
P["19-zebrada"] = papel(`
  <div class="a h" style="left:90px;top:120px;width:900px;font-size:72px">Controle_projetos_FINAL.xlsx</div>
  <div class="a" style="left:90px;top:330px;width:900px;height:558px;overflow:hidden;border-radius:12px;box-shadow:0 0 0 2px #E1E1E1">${celulas}</div>
  <div class="a" style="left:0;top:0;width:1080px;height:1350px;overflow:hidden">${fita(470, -9)}${fita(700, 7)}</div>
  <div class="a h" style="left:90px;top:1000px;width:900px;font-size:58px">Se ninguém pode mexer, não é controle. É risco.</div>
  ${foot("escuro")}`);

// 20 · Conversa: a palavra que salva a margem
const msg = (txt, eu) => `<div style="align-self:${eu ? "flex-end" : "flex-start"};max-width:78%;background:${eu ? "#1A1A1A" : "#fff"};color:${eu ? "#fff" : "#1A1A1A"};border-radius:${eu ? "34px 34px 8px 34px" : "34px 34px 34px 8px"};padding:26px 32px;font-size:38px;line-height:1.3;box-shadow:0 0 0 2px ${eu ? "#1A1A1A" : "#E4E4E4"}">${txt}</div>`;
P["20-conversa"] = papel(`
  <div class="a" style="left:90px;top:120px;width:900px;display:flex;flex-direction:column;gap:26px">
    <div style="font-size:30px;color:#5F6572;text-align:center">Cliente · Ed. Aurora (exemplo)</div>
    ${msg("Oi! Só um ajustezinho: dá para mudar a escada de lugar?", false)}
    ${msg("Claro! Vou preparar o aditivo com prazo e valor e te mando hoje.", true)}
    ${msg("Aditivo?", false)}
  </div>
  <div class="a h" style="left:90px;top:900px;width:900px;font-size:92px">A palavra que salva a margem.</div>
  ${foot("escuro")}`);

const filtro = process.argv[2] ?? "";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const pg = await browser.newPage({ viewport: { width: 1080, height: 1350 } });
for (const [nome, corpo] of Object.entries(P)) {
  if (!nome.includes(filtro)) continue;
  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="social.css"><style>${css}</style></head><body><div class="c">${corpo}</div></body></html>`;
  const tmp = resolve(TPL, `_conceito-${nome}.html`);
  writeFileSync(tmp, html);
  await pg.goto(pathToFileURL(tmp).href);
  await pg.evaluate(() => document.fonts.ready);
  await pg.waitForFunction(() => [...document.images].every((i) => i.complete));
  await pg.screenshot({ path: resolve(OUT, `${nome}.jpg`), type: "jpeg", quality: 92 });
  unlinkSync(tmp);
  console.log("ok", nome);
}
await browser.close();
