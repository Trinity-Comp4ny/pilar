import fs from "node:fs";
import path from "node:path";
import { test } from "../fixtures";
import { SAIDA } from "./explorar";

// Medidas de interface (posição, altura, fonte, raio, cor) de cada tela, a 1440×900.
// Serve para a auditoria de alinhamento e padronização; não é teste de regressão.
const ID = "00000000-0000-0000-0000-000000000";
const TELAS: [string, string][] = [
  ["inicio", "/inicio"], ["leads", "/gestao/leads"], ["propostas", "/gestao/propostas"], ["clientes", "/gestao/clientes"],
  ["cliente", `/gestao/clientes/${ID}101`], ["agenda", "/gestao/agenda"], ["tarefas", "/gestao/tarefas"], ["metas", "/gestao/metas"],
  ["projetos", "/projetos"], ["projeto", `/projetos/${ID}401`], ["disciplinas", "/projetos/disciplinas"], ["cronograma", "/projetos/cronograma"],
  ["calendario", "/projetos/calendario"], ["mapa", "/projetos/mapa"], ["timesheet", "/gestao/timesheet"], ["obras", "/obras"],
  ["obra", `/obras/${ID}a01`], ["clima", "/obras/clima"], ["estimativas", "/obras/estimativas"], ["precos", "/obras/estimativas/precos"],
  ["fornecedores", "/gestao/fornecedores"], ["fornecedor", `/gestao/fornecedores/${ID}642`], ["financeiro", "/gestao/financeiro"],
  ["lancamentos", "/gestao/financeiro?tab=lancamentos&fp=tudo"], ["rentabilidade", "/rentabilidade"], ["equipe", "/gestao/equipe"],
  ["admin", "/admin"], ["agentes", "/agentes"], ["relatorios", "/relatorios"], ["novidades", "/novidades"], ["ajuda", "/ajuda"],
  ["revisao-ia", "/revisao-ia"], ["chat", "/chat"],
];

for (const [tela, rota] of TELAS) {
  test(`medidas · ${tela}`, async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(rota);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page
      .waitForFunction(() => !document.querySelector('.animate-pulse, [aria-busy="true"]'), null, { timeout: 10_000 })
      .catch(() => undefined);
    await page.waitForTimeout(800);
    const m = await page.evaluate(() => {
      const main = (document.querySelector("#main-content") as HTMLElement) || document.body;
      const vis = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && r.top < 1400 && r.bottom > 0;
      };
      const box = (el: Element) => {
        const r = el.getBoundingClientRect();
        return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const st = (el: Element) => {
        const s = getComputedStyle(el);
        return { fs: s.fontSize, fw: s.fontWeight, ff: s.fontFamily.split(",")[0].replace(/"/g, ""), cor: s.color, bg: s.backgroundColor, raio: s.borderRadius, borda: s.borderTopWidth + " " + s.borderTopColor, pad: s.padding, sombra: s.boxShadow !== "none" };
      };
      const txt = (el: Element) => ((el as HTMLElement).innerText || el.getAttribute("aria-label") || "").trim().replace(/\s+/g, " ").slice(0, 50);
      const h1 = main.querySelector("h1");
      let cab: Element | null = h1;
      while (cab && cab !== main && cab.parentElement && cab.parentElement.getBoundingClientRect().width < main.getBoundingClientRect().width - 4) cab = cab.parentElement;
      const botoes = [...main.querySelectorAll('button, [role="button"], a[role="tab"], [role="tab"]')].filter(vis).slice(0, 250)
        .map((b) => ({ ...box(b), ...st(b), papel: b.getAttribute("role") || b.tagName.toLowerCase(), t: txt(b) }));
      const campos = [...main.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), [role="combobox"], select, textarea')]
        .filter(vis).map((b) => ({ ...box(b), ...st(b), t: (b.getAttribute("placeholder") || b.getAttribute("aria-label") || txt(b)).slice(0, 40) }));
      const titulos = [...main.querySelectorAll("h1, h2, h3, [role=heading]")].filter(vis).slice(0, 60).map((b) => ({ tag: b.tagName.toLowerCase(), ...box(b), ...st(b), t: txt(b) }));
      // Números grandes (indicadores): folha com dígito e fonte >= 18px; guarda o cartão em volta.
      const nums = [...main.querySelectorAll("*")].filter((el) => el.children.length === 0 && /\d/.test(el.textContent || "") && parseFloat(getComputedStyle(el).fontSize) >= 18 && vis(el)).slice(0, 60)
        .map((el) => {
          let c: Element | null = el.parentElement;
          while (c && c !== main && getComputedStyle(c).borderTopWidth === "0px") c = c.parentElement;
          return { ...box(el), ...st(el), t: txt(el), cartao: c && c !== main ? { ...box(c), ...st(c) } : null };
        });
      const cartoes = [...main.querySelectorAll("div, section, article, li")].filter((el) => {
        const s = getComputedStyle(el);
        return s.borderTopWidth !== "0px" && parseFloat(s.borderRadius) >= 4 && vis(el);
      }).map((el) => ({ ...box(el), ...st(el) })).filter((c) => c.w > 120 && c.h > 48).slice(0, 200);
      const conj = (sel: string, prop: string) => {
        const m: Record<string, number> = {};
        for (const el of main.querySelectorAll(sel)) {
          if (!vis(el)) continue;
          const v = getComputedStyle(el).getPropertyValue(prop);
          m[v] = (m[v] || 0) + 1;
        }
        return m;
      };
      return {
        url: location.pathname + location.search,
        main: { ...box(main), pad: getComputedStyle(main).padding },
        h1: h1 && vis(h1) ? { ...box(h1), ...st(h1), t: txt(h1) } : null,
        cabecalho: cab && cab !== main ? { ...box(cab) } : null,
        botoes, campos, titulos, nums, cartoes,
        fontes: conj("*", "font-size"),
        cores: conj("p, span, div, td, th, h1, h2, h3, label, a, button", "color"),
      };
    });
    const dir = path.join(SAIDA, "_medidas");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${tela}.json`), JSON.stringify(m));
    // Faixa do topo (cabeçalho, indicadores e filtros) para comparar lado a lado.
    fs.mkdirSync(path.join(SAIDA, "topos"), { recursive: true });
    await page.mouse.move(1435, 6);
    await page.screenshot({ path: path.join(SAIDA, "topos", `${tela}.jpg`), type: "jpeg", quality: 80, clip: { x: 0, y: 0, width: 1440, height: 360 } });
  });
}
