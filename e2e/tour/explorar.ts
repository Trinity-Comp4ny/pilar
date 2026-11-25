import type { Locator, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/**
 * Tour de telas: abre uma rota, fotografa a tela e as abas, e clica nos botões, filtros e
 * menus para fotografar cada modal, menu e lista que abre (até dois níveis). Serve só para
 * levantar o inventário visual do app para a prototipação; não é teste de regressão.
 */

export const SAIDA = path.join(process.cwd(), "tour-prints");

type Papel = "button" | "tab" | "combobox" | "menuitem" | "menuitemcheckbox" | "menuitemradio" | "radio";
type Escopo = "main" | "dialog" | "menu" | "chrome";
export type Passo =
  | { tipo: "papel"; escopo: Escopo; papel: Papel; nome: string }
  | { tipo: "texto"; nome: string }
  | { tipo: "linha" }
  | { tipo: "tecla"; tecla: string };

type Estado = { url: string; dialogs: number; menus: number; listas: number };
type Efeito = "tela" | "auto" | "nav" | "dialog" | "menu" | "lista" | "aba" | "estado" | "estado-leve" | "nada";
type Candidato = { papel: Papel; nome: string; selecionado: boolean; emNav: boolean; longo: boolean };
type Registro = {
  arquivo: string;
  modulo: string;
  tela: string;
  rota: string;
  efeito: string;
  cadeia: string[];
  titulo: string;
  url: string;
};

// Nunca, em nível nenhum: sessão, troca de empresa, operações de plataforma e o que só baixa ou imprime.
const NUNCA =
  /^sair$|sair da conta|encerrar sess|desconectar|log ?out|impersona|entrar como|acessar como|acessar (a |esta )?empresa|ver como|trocar (de )?empresa|alternar empresa|pular para|imprimir|baixar|download|exportar|copiar|^\d+$|^(anterior|próxim[oa]|voltar)$|tema|modo escuro|modo claro|^(fechar|close|dispensar|entendi|ok)$|cancelar assinatura|(excluir|apagar|encerrar) (minha )?conta|bloquear|desbloquear|suspender|banir|resetar|zerar|forçar|disparar|executar|rodar|reprocessar|limpar cache|migrar|^ativar|^desativar|habilitar|desabilitar|promover|rebaixar|conceder|revogar/i;

// Na página, pula o que muda dado direto, sem abrir nada.
const MUTA_NA_PAGINA =
  /^(marcar|arquivar|desarquivar|duplicar|favoritar|fixar|desfixar|sincronizar|atualizar|recarregar|tentar novamente|salvar|desfazer|refazer|limpar|aplicar)/i;

// Dentro de modal: só o que abre outra coisa (gerenciar, nova categoria, mais opções, selects, abas).
const DENTRO_OK =
  /^(nov[oa]|gerenciar|editar|ver\b|abrir|adicionar \S|incluir|mais|opç|avançad|filtr|configur|detalh|histórico|anexo|anexar|selecionar|escolher|alterar|personalizar|importar|calend|data|escolha)|gerenciar|mais opções|ações|opções/i;
const DENTRO_SUBMIT =
  /salvar|criar|confirmar|excluir|remover|apagar|enviar|aprovar|pagar|concluir|registrar|publicar|convidar|cadastrar|cancelar|descartar/i;

const PAPEIS = new Set(["button", "tab", "combobox", "menuitem", "menuitemcheckbox", "menuitemradio", "radio"]);

function slug(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "x"
  );
}

function rotulo(p: Passo): string {
  if (p.tipo === "papel") return `${p.papel}: ${p.nome}`;
  if (p.tipo === "texto") return `texto: ${p.nome}`;
  if (p.tipo === "tecla") return `tecla: ${p.tecla}`;
  return "primeira linha da tabela";
}

function curto(p: Passo): string {
  if (p.tipo === "papel" || p.tipo === "texto") return p.nome;
  if (p.tipo === "tecla") return p.tecla;
  return "linha";
}

/** Lê o snapshot de acessibilidade e devolve os alvos clicáveis com nome. */
export function lerSnapshot(snap: string): Candidato[] {
  const re = /^(\s*)- ([a-z]+)(?: "((?:[^"\\]|\\.)*)")?(.*)$/;
  const pilha: { indent: number; papel: string; linha?: number }[] = [];
  const out: Candidato[] = [];
  let linhas = 0;
  for (const bruta of snap.split("\n")) {
    const m = bruta.match(re);
    if (!m) continue;
    const indent = m[1].length;
    const papel = m[2];
    while (pilha.length && pilha[pilha.length - 1].indent >= indent) pilha.pop();
    const anc = pilha.slice();
    pilha.push({ indent, papel, linha: papel === "row" ? ++linhas : undefined });
    if (!PAPEIS.has(papel) || m[3] === undefined) continue;
    // Em tabela, só a linha de cabeçalho e a primeira de dados: as outras repetem os mesmos botões.
    const linha = [...anc].reverse().find((a) => a.linha !== undefined)?.linha;
    if (linha !== undefined && linha > 2) continue;
    let nome = m[3];
    try {
      nome = JSON.parse(`"${m[3]}"`);
    } catch {
      /* nome com escape estranho: usa cru */
    }
    nome = nome.replace(/\s+/g, " ").trim();
    if (!nome) continue;
    out.push({
      papel: papel as Papel,
      nome,
      selecionado: /\[(selected|checked|pressed)/.test(m[4] ?? ""),
      emNav: anc.some((a) => a.papel === "navigation" || a.papel === "tablist"),
      longo: nome.length > 45,
    });
  }
  return out;
}

type Opcoes = {
  orcamentoMs?: number;
  detalhes?: string[];
  escopo?: "main" | "chrome";
  maxProf?: number;
  extras?: Passo[];
};

export class Tour {
  private registros: Registro[] = [];
  private seq = 0;
  private inicio = Date.now();
  private vistos = new Set<string>();
  private esperados = new Map<string, Estado>();
  private atual = "";
  private forcar = false;
  private seletorMain = "#main-content";
  private seletorChrome = '[data-sidebar="sidebar"]';

  constructor(
    private page: Page,
    private modulo: string,
    private tela: string,
    private rota: string,
    private opts: Opcoes = {}
  ) {
    page.on("dialog", (d) => void d.dismiss().catch(() => undefined));
    page.context().on("page", (p) => {
      if (p !== page) void p.close().catch(() => undefined);
    });
  }

  private get estourou() {
    return Date.now() - this.inicio > (this.opts.orcamentoMs ?? 5 * 60_000);
  }

  private chave(c: Passo[]) {
    return JSON.stringify(c);
  }

  private loc(e: Escopo): Locator {
    const p = this.page;
    if (e === "dialog") return p.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').last();
    if (e === "menu") return p.locator('[role="menu"]:visible').last();
    if (e === "chrome") return p.locator(this.seletorChrome).first();
    return p.locator(this.seletorMain).first();
  }

  private async esperar(ms = 8000) {
    await this.page
      .waitForFunction(
        () =>
          !document.body.innerText.includes("Atualizando…") &&
          !document.querySelector('.animate-pulse, [aria-busy="true"]'),
        null,
        { timeout: ms }
      )
      .catch(() => undefined);
    await this.page.waitForLoadState("networkidle", { timeout: ms }).catch(() => undefined);
  }

  private async estado(): Promise<Estado> {
    const p = this.page;
    const [dialogs, menus, listas] = await Promise.all([
      p.locator('[role="dialog"]:visible, [role="alertdialog"]:visible').count(),
      p.locator('[role="menu"]:visible').count(),
      p.locator('[role="listbox"]:visible').count(),
    ]);
    return { url: p.url(), dialogs, menus, listas };
  }

  private igual(a: Estado, b: Estado) {
    return a.url === b.url && a.dialogs === b.dialogs && a.menus === b.menus && a.listas === b.listas;
  }

  private async texto(e: Escopo): Promise<string> {
    const alvo = e === "menu" || e === "chrome" ? this.loc("main") : this.loc(e);
    return alvo.innerText({ timeout: 3000 }).catch(() => "");
  }

  private async abrirBase(): Promise<number> {
    const p = this.page;
    await p.goto(this.rota, { waitUntil: "domcontentloaded", timeout: 30_000 }).catch(() => undefined);
    await this.esperar(15_000);
    await p.waitForTimeout(500);
    const e = await this.estado();
    return e.dialogs;
  }

  private async fecharAutomaticos() {
    for (let i = 0; i < 4; i++) {
      const e = await this.estado();
      if (e.dialogs + e.menus + e.listas === 0) return;
      await this.page.keyboard.press("Escape");
      await this.page.waitForTimeout(350);
    }
  }

  private async alvo(passo: Passo): Promise<Locator | null> {
    const p = this.page;
    if (passo.tipo === "texto") return p.locator(this.seletorMain).getByText(passo.nome, { exact: false }).first();
    if (passo.tipo === "linha") return p.locator(`${this.seletorMain} tbody tr`).first();
    if (passo.tipo === "tecla") return null;
    return this.loc(passo.escopo).getByRole(passo.papel, { name: passo.nome, exact: true }).first();
  }

  private async executar(passo: Passo): Promise<boolean> {
    if (passo.tipo === "tecla") {
      await this.page.keyboard.press(passo.tecla).catch(() => undefined);
      return true;
    }
    const alvo = await this.alvo(passo);
    if (!alvo) return false;
    try {
      await alvo.waitFor({ state: "visible", timeout: 3000 });
      await alvo.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => undefined);
      await alvo.click({ timeout: 3000 });
      return true;
    } catch {
      return false;
    }
  }

  private async depoisDoClique() {
    await this.page.waitForTimeout(650);
    await this.esperar(5000);
  }

  /** Leva a tela ao estado da cadeia: Escape, refazer o último passo ou abrir do zero. */
  private async garantir(cadeia: Passo[]): Promise<boolean> {
    const k = this.chave(cadeia);
    const esp = this.esperados.get(k);
    if (!esp) return false;
    if (!this.forcar) {
      if (this.atual === k && this.igual(await this.estado(), esp)) return true;
      for (let i = 0; i < 3; i++) {
        const e = await this.estado();
        if (this.igual(e, esp)) {
          this.atual = k;
          return true;
        }
        if (e.dialogs + e.menus + e.listas <= esp.dialogs + esp.menus + esp.listas) break;
        await this.page.keyboard.press("Escape");
        await this.page.waitForTimeout(350);
      }
      if (cadeia.length) {
        const espPai = this.esperados.get(this.chave(cadeia.slice(0, -1)));
        if (espPai && this.igual(await this.estado(), espPai)) {
          if (await this.executar(cadeia[cadeia.length - 1])) {
            await this.depoisDoClique();
            if (this.igual(await this.estado(), esp)) {
              this.atual = k;
              return true;
            }
          }
        }
      }
    }
    this.forcar = false;
    await this.abrirBase();
    await this.fecharAutomaticos();
    for (const passo of cadeia) {
      if (!(await this.executar(passo))) return false;
      await this.depoisDoClique();
    }
    const ok = this.igual(await this.estado(), esp);
    this.atual = ok ? k : "";
    return ok;
  }

  private classificar(a: Estado, d: Estado, passo: Passo, ta: string, td: string, abaLike: boolean): Efeito {
    if (d.dialogs > a.dialogs) return "dialog";
    if (d.menus > a.menus) return "menu";
    if (d.listas > a.listas) return "lista";
    const ehAba = abaLike || (passo.tipo === "papel" && (passo.papel === "tab" || passo.papel === "radio"));
    if (d.url !== a.url) return ehAba ? "aba" : "nav";
    if (ehAba) return ta !== td ? "aba" : "nada";
    if (ta !== td && Math.abs(ta.length - td.length) > 30) return "estado";
    if (ta !== td) return "estado-leve";
    return "nada";
  }

  private async capturar(efeito: Efeito, cadeia: Passo[], nomeCurto: string): Promise<boolean> {
    const p = this.page;
    let titulo = nomeCurto;
    try {
      if (efeito === "dialog" || efeito === "auto") {
        const d = this.loc("dialog");
        titulo =
          (await d
            .locator('h1, h2, h3, [role="heading"]')
            .first()
            .innerText({ timeout: 1500 })
            .catch(() => "")) ||
          (await d.getAttribute("aria-label").catch(() => "")) ||
          nomeCurto;
      } else if (efeito === "menu") {
        titulo = (await this.loc("menu").getByRole("menuitem").allInnerTexts().catch(() => []))
          .slice(0, 10)
          .join(" | ");
      } else if (efeito === "lista") {
        titulo = (
          await p
            .locator('[role="listbox"]:visible')
            .last()
            .getByRole("option")
            .allInnerTexts()
            .catch(() => [])
        )
          .slice(0, 10)
          .join(" | ");
      } else if (efeito === "nav") {
        titulo = new URL(p.url()).pathname;
      }
    } catch {
      /* título é só rótulo */
    }
    titulo = (titulo || nomeCurto).replace(/\s+/g, " ").trim().slice(0, 200);
    const k = `${efeito}:${titulo}`;
    if (this.vistos.has(k)) return false;
    this.vistos.add(k);
    const arquivo = `${String(++this.seq).padStart(3, "0")}-${efeito}-${slug(nomeCurto)}.png`;
    const rel = path.join(this.modulo, this.tela, arquivo);
    const abs = path.join(SAIDA, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    await p.mouse.move(1435, 6).catch(() => undefined);
    await p.waitForTimeout(250);
    const e = await this.estado();
    const inteira = ["tela", "nav", "aba", "estado"].includes(efeito) && e.dialogs + e.menus + e.listas === 0;
    await p.screenshot({ path: abs, fullPage: inteira, animations: "disabled", timeout: 15_000 }).catch(() => undefined);
    this.registros.push({
      arquivo: rel,
      modulo: this.modulo,
      tela: this.tela,
      rota: this.rota,
      efeito,
      cadeia: cadeia.map(rotulo),
      titulo,
      url: p.url().replace(/^https?:\/\/[^/]+/, ""),
    });
    return true;
  }

  private filtrar(cs: Candidato[], escopo: Escopo, prof: number, excluir: Set<string>): Candidato[] {
    const vistos = new Set<string>();
    let longos = 0;
    const out: Candidato[] = [];
    const abas: Candidato[] = [];
    for (const c of cs) {
      if (excluir.has(c.nome)) continue;
      const k = `${c.papel}:${c.nome}`;
      if (vistos.has(k)) continue;
      vistos.add(k);
      if (NUNCA.test(c.nome)) continue;
      if (c.selecionado && (c.papel === "tab" || c.papel === "radio")) continue;
      if (c.longo && longos++ >= 1) continue;
      if (escopo === "main" || escopo === "chrome") {
        if (MUTA_NA_PAGINA.test(c.nome)) continue;
      } else if (escopo === "menu") {
        if (!c.papel.startsWith("menuitem")) continue;
      } else {
        const ok =
          c.papel === "tab" ||
          c.papel === "combobox" ||
          c.emNav ||
          (c.papel === "button" && DENTRO_OK.test(c.nome) && !DENTRO_SUBMIT.test(c.nome));
        if (!ok) continue;
      }
      if (c.papel === "tab" || c.papel === "radio" || (escopo === "dialog" && c.emNav)) abas.push(c);
      else out.push(c);
    }
    return [...out, ...abas];
  }

  private async explorar(cadeia: Passo[], escopo: Escopo, prof: number, excluir: Set<string>) {
    if (this.estourou) return;
    if (!(await this.garantir(cadeia))) return;
    let snap = "";
    try {
      snap = await this.loc(escopo).ariaSnapshot({ timeout: 8000 });
    } catch {
      return;
    }
    const cands = this.filtrar(lerSnapshot(snap), escopo, prof, excluir);
    const topo = prof === 0 && cadeia.length === 0;
    const extras: Passo[] = topo
      ? [
          ...(this.opts.extras ?? []),
          ...(this.opts.detalhes ?? []).map((nome) => ({ tipo: "texto" as const, nome })),
          ...(escopo === "main" ? [{ tipo: "linha" as const }] : []),
        ]
      : [];
    const limite = prof === 0 ? 45 : prof === 1 ? 18 : 8;
    const passos: { passo: Passo; abaLike: boolean }[] = [
      ...extras.map((passo) => ({ passo, abaLike: false })),
      ...cands.slice(0, limite).map((c) => ({
        passo: { tipo: "papel" as const, escopo, papel: c.papel, nome: c.nome },
        abaLike: escopo === "dialog" && c.emNav,
      })),
    ];
    let mexeuEmAba = false;
    for (const { passo, abaLike } of passos) {
      if (this.estourou) return;
      if (!(await this.garantir(cadeia))) return;
      const a = await this.estado();
      const ta = await this.texto(escopo);
      if (!(await this.executar(passo))) continue;
      this.atual = "";
      await this.depoisDoClique();
      const d = await this.estado();
      const td = await this.texto(escopo);
      const efeito = this.classificar(a, d, passo, ta, td, abaLike);
      if (efeito === "nada") {
        this.atual = this.chave(cadeia);
        continue;
      }
      const nova = [...cadeia, passo];
      const ehAba = efeito === "aba" && (abaLike || (passo.tipo === "papel" && passo.papel !== "button"));
      const capturou = efeito === "estado-leve" ? false : await this.capturar(efeito, nova, curto(passo));
      if (ehAba) {
        // Aba seguinte troca de qualquer aba; só o pai precisa recarregar no fim.
        mexeuEmAba = true;
        if (d.url === a.url) this.atual = this.chave(cadeia);
        else this.forcar = true;
        continue;
      }
      if (efeito === "estado" || efeito === "estado-leve" || efeito === "aba") this.forcar = true;
      if (capturou && (efeito === "dialog" || efeito === "menu") && prof < (this.opts.maxProf ?? 2)) {
        this.esperados.set(this.chave(nova), d);
        this.atual = this.chave(nova);
        await this.explorar(nova, efeito === "dialog" ? "dialog" : "menu", prof + 1, new Set());
      }
    }
    if (mexeuEmAba) this.forcar = true;
  }

  async rodar() {
    const escopo = this.opts.escopo ?? "main";
    try {
      const autos = await this.abrirBase();
      if (!(await this.page.locator(this.seletorMain).count())) {
        this.seletorMain = (await this.page.locator("main").count()) ? "main" : "body";
      }
      if (!(await this.page.locator(this.seletorChrome).count())) {
        this.seletorChrome = (await this.page.locator("aside").count()) ? "aside" : "nav";
      }
      if (autos > 0) await this.capturar("auto", [], "abriu-sozinho");
      await this.fecharAutomaticos();
      const base = await this.estado();
      this.esperados.set(this.chave([]), base);
      this.atual = this.chave([]);
      await this.capturar("tela", [], "tela");

      // Abas do topo: primeiro só a foto de cada uma (barato), depois a exploração.
      const snap = await this.loc(escopo)
        .ariaSnapshot({ timeout: 8000 })
        .catch(() => "");
      const abas = lerSnapshot(snap).filter((c) => c.papel === "tab" && !NUNCA.test(c.nome));
      const nomesAbas = new Set(abas.map((a) => a.nome));
      const estados: Passo[] = [];
      for (const aba of abas) {
        if (aba.selecionado || this.estourou) continue;
        if (!(await this.garantir([]))) break;
        const passo: Passo = { tipo: "papel", escopo, papel: "tab", nome: aba.nome };
        if (!(await this.executar(passo))) continue;
        await this.page.waitForTimeout(700);
        await this.esperar(8000);
        await this.capturar("aba", [passo], `aba-${aba.nome}`);
        this.esperados.set(this.chave([passo]), await this.estado());
        this.atual = this.chave([passo]);
        estados.push(passo);
      }
      this.forcar = true;
      await this.explorar([], escopo, 0, nomesAbas);
      for (const passo of estados) {
        if (this.estourou) break;
        this.forcar = true;
        await this.explorar([passo], escopo, 0, nomesAbas);
      }
    } catch (e) {
      console.log(`[tour] ${this.modulo}/${this.tela}: ${(e as Error).message.split("\n")[0]}`);
    } finally {
      const dir = path.join(SAIDA, "_manifest");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${this.modulo}--${this.tela}.json`), JSON.stringify(this.registros, null, 1));
      const s = Math.round((Date.now() - this.inicio) / 1000);
      console.log(`[tour] ${this.modulo}/${this.tela}: ${this.registros.length} prints em ${s}s`);
    }
  }
}
