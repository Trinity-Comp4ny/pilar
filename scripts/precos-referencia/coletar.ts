// Coleta mensal dos preços de referência da estimativa de obra (Deno, roda no GitHub Actions).
//
//   deno run --config scripts/precos-referencia/deno.json -A scripts/precos-referencia/coletar.ts sinapi
//   deno run --config scripts/precos-referencia/deno.json -A scripts/precos-referencia/coletar.ts cub
//   deno run --config scripts/precos-referencia/deno.json -A scripts/precos-referencia/coletar.ts conferir
//
// `sinapi`: para cada mês que falta no banco (ou que a Caixa retificou), baixa o zip do mês, tira a planilha
// SINAPI_Referência, lê as abas ISD e ICD com o mesmo leitor da importação manual e grava só os códigos do
// catálogo. Mês ainda não publicado não é erro. Arquivo fora do formato é erro e nada é gravado.
// `cub`: para cada UF e cada mês e regime que faltam, tenta as fontes da UF em ordem (portal da CBIC, depois o
// portal do Sinduscon; SP e RS só o portal próprio), lê o PDF com as conferências de `cub.ts` e grava. A primeira
// fonte que passa nas conferências vence. UF em que nenhuma passa não grava nada e faz o job falhar no fim.
// `sondar`: lê as fontes reais e roda as conferências sem banco e sem gravar (roda no PR).
// `conferir`: falha quando o CUB ou o SINAPI do mês anterior não chegou no prazo, para abrir a issue do cron.
//
// Variáveis: SUPABASE_DB_URL (obrigatória, a mesma do backup); DRY_RUN=1 lê e confere sem gravar;
// SINAPI_MES=AAAA-MM e CUB_MES=AAAA-MM forçam um mês; CUB_UFS="SP,GO" limita as UFs; CUB_SINDUSCON="MG=12"
// fixa o Sinduscon da UF no portal da CBIC; CUB_PORTAIS="TO=https://.../cub/" acrescenta portal estadual;
// SINAPI_PAGINA_URL, SINAPI_DOWNLOAD_BASE e CUB_BASE_URL trocam os endereços (testes).
import { unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { getDocumentProxy } from "unpdf";
import { lerParametros } from "@/lib/estimativaObra";
import { UFS, type Regime, type Uf } from "@/schemas/estimativaObra";
import { codigosDoCatalogo, interpretarSinapi, type AbaSinapi } from "@/pages/ultra-admin/estimativaSinapiImport";
import {
  acharZipsSinapi,
  arquivoDoMes,
  atraso,
  fonteDaColeta,
  mesesPendentes,
  mesValido,
  planilhaDoZip,
  precisaReimportar,
  type ArquivoSinapi,
  type Base,
  type MesBase,
} from "./fonte.ts";
import {
  cookiesDaResposta,
  escolherSinduscon,
  formularioCub,
  igualAoAnterior,
  lerCsrf,
  lerFixos,
  lerOpcoesSinduscon,
  lerPdfCub,
  paraGravar,
  saltoSuspeito,
  type ItemDeTexto,
  type LinhaCub,
} from "./cub.ts";
import {
  candidatosDoMes,
  lerPortaisExtras,
  linksPdfDaPagina,
  linksPdfDoWordpress,
  portaisDaUf,
  urlWordpressMedia,
  type LinkPdf,
  type PortalEstadual,
} from "./portais.ts";
import { abrirBanco, bancoDeSondagem, type Banco, type CubGravado } from "./banco.ts";

const env = (nome: string) => Deno.env.get(nome)?.trim() ?? "";
let dryRun = env("DRY_RUN") === "1" || env("DRY_RUN") === "true";

function resumo(linha: string): void {
  console.warn(linha);
  const arquivo = env("GITHUB_STEP_SUMMARY");
  if (arquivo) Deno.writeTextFileSync(arquivo, `${linha}\n`, { append: true });
}

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NAVEGADOR = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

/** Lê o corpo com teto de tamanho, para um servidor que responda arquivo gigante não derrubar o job. */
async function corpoLimitado(r: Response, maximo: number, nome: string): Promise<Uint8Array> {
  const declarado = Number(r.headers.get("content-length") ?? 0);
  if (declarado > maximo) throw new Error(`${nome} passa de ${maximo} bytes.`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > maximo) throw new Error(`${nome} passa de ${maximo} bytes.`);
  return bytes;
}

const ehPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF

// ─── SINAPI ────────────────────────────────────────────────────────────────

const PAGINA_PADRAO = "https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx";
const DOWNLOAD_PADRAO = "https://www.caixa.gov.br/Downloads/sinapi-relatorios-mensais";
const TAMANHO_MAXIMO_ZIP = 300_000_000;

async function buscar(url: string, tempo = 180_000): Promise<Response> {
  return await fetch(url, { headers: NAVEGADOR, signal: AbortSignal.timeout(tempo), redirect: "follow" });
}

/** Lê a página da Caixa atrás dos links. Página fora do ar não impede a coleta: sobra o endereço direto. */
async function linksDaPagina(paginaUrl: string): Promise<Map<MesBase, ArquivoSinapi>> {
  try {
    const r = await buscar(paginaUrl, 60_000);
    if (!r.ok) {
      resumo(`- Página do SINAPI respondeu ${r.status}; sigo pelo endereço direto.`);
      return new Map();
    }
    return acharZipsSinapi(await r.text(), paginaUrl);
  } catch (e) {
    resumo(`- Página do SINAPI não abriu (${(e as Error).message}); sigo pelo endereço direto.`);
    return new Map();
  }
}

/** Baixa o zip. `null` quando o mês ainda não foi publicado (404 ou a Caixa devolvendo uma página no lugar). */
async function baixarZip(arquivo: ArquivoSinapi): Promise<Uint8Array | null> {
  const r = await buscar(arquivo.url);
  if (r.status === 404) {
    await r.body?.cancel();
    return null;
  }
  if (!r.ok) throw new Error(`Download de ${arquivo.nome} respondeu ${r.status}.`);
  if ((r.headers.get("content-type") ?? "").includes("text/html")) {
    await r.body?.cancel();
    return null;
  }
  const bytes = await corpoLimitado(r, TAMANHO_MAXIMO_ZIP, arquivo.nome);
  // Zip começa com "PK".
  return bytes[0] === 0x50 && bytes[1] === 0x4b ? bytes : null;
}

function abasDoZip(zip: Uint8Array, mes: MesBase): AbaSinapi[] {
  // Só descompacta a planilha do mês; as outras (composições, manuais) passam de 50 MB e não são lidas.
  const conteudo = unzipSync(zip, { filter: (f) => planilhaDoZip([f.name], mes) !== null });
  const nomes = Object.keys(conteudo);
  if (nomes.length !== 1) {
    throw new Error(
      `O zip deveria ter uma planilha SINAPI_Referência_${mes.slice(0, 4)}_${mes.slice(5, 7)}.xlsx e tem ${nomes.length}.`
    );
  }
  const livro = XLSX.read(conteudo[nomes[0]], { type: "array", sheets: ["ISD", "ICD"] });
  return ["ISD", "ICD"].flatMap((aba) => {
    const folha = livro.Sheets[aba];
    if (!folha) return [];
    return [{ nome: aba, celulas: XLSX.utils.sheet_to_json<unknown[]>(folha, { header: 1, raw: true, defval: "" }) }];
  });
}

async function coletarSinapi(db: Banco): Promise<void> {
  const lido = lerParametros(await db.parametros());
  if (!lido.ok) throw new Error(lido.mensagem);
  const catalogo = codigosDoCatalogo(lido.parametros.adicionais);

  const forcado = env("SINAPI_MES");
  const achados = await linksDaPagina(env("SINAPI_PAGINA_URL") || PAGINA_PADRAO);
  const base = env("SINAPI_DOWNLOAD_BASE") || DOWNLOAD_PADRAO;

  let meses: MesBase[];
  if (forcado) {
    const mes = `${forcado}-01`;
    if (!mesValido(mes)) throw new Error(`SINAPI_MES deve ser AAAA-MM (veio "${forcado}").`);
    meses = [mes];
  } else {
    meses = mesesPendentes(await db.ultimoMes("sinapi_precos_insumo"), new Date());
    // Retificação de um mês já gravado: a Caixa republica com o sufixo _RetificacaoNN.
    for (const achado of achados.values()) {
      if (meses.includes(achado.mes) || achado.retificacao === 0) continue;
      const fonte = await db.fonteSinapi(achado.mes);
      if (fonte && precisaReimportar(fonte, achado)) meses.push(achado.mes);
    }
    meses.sort();
  }

  resumo(`### SINAPI${dryRun ? " (sem gravar)" : ""}`);
  if (meses.length === 0) {
    resumo("- Nada a buscar: o banco já tem o mês mais recente.");
    return;
  }

  for (const mes of meses) {
    const arquivo = arquivoDoMes(mes, achados, base);
    const zip = await baixarZip(arquivo);
    if (!zip) {
      resumo(`- ${arquivo.nome}: ainda não publicado.`);
      continue;
    }
    const resultado = interpretarSinapi(abasDoZip(zip, mes), catalogo);
    if (resultado.erroGeral) throw new Error(`${arquivo.nome}: ${resultado.erroGeral}`);
    if (resultado.erros.length > 0) {
      const primeiros = resultado.erros.slice(0, 10).map((e) => `aba ${e.aba}, linha ${e.linha}: ${e.mensagem}`);
      throw new Error(
        `${arquivo.nome}: ${resultado.erros.length} linhas com erro, nada gravado.\n${primeiros.join("\n")}`
      );
    }
    if (resultado.mesBase !== mes) {
      throw new Error(`${arquivo.nome} diz ser de ${resultado.mesBase}, não de ${mes}. Nada gravado.`);
    }
    if (resultado.regimes.length < 2) {
      throw new Error(`${arquivo.nome} só tem o regime ${resultado.regimes.join(", ")}. Nada gravado.`);
    }
    if (!dryRun) await db.gravarSinapi(resultado.linhas, fonteDaColeta(arquivo));
    resumo(
      `- ${arquivo.nome}: ${resultado.linhas.length} preços ${dryRun ? "lidos" : "gravados"}` +
        (resultado.semPreco.length
          ? `; sem preço em nenhuma UF: ${resultado.semPreco.map((s) => `${s.codigo} (${s.rotulo})`).join(", ")}`
          : "") +
        "."
    );
  }
}

// ─── CUB ───────────────────────────────────────────────────────────────────

const CUB_BASE_PADRAO = "http://www.cub.org.br";
const CUB_PAUSA_MS = 1_500;
const TAMANHO_MAXIMO_PDF = 15_000_000;

async function textoDoPdf(pdf: Uint8Array): Promise<ItemDeTexto[][]> {
  const doc = await getDocumentProxy(pdf);
  const paginas: ItemDeTexto[][] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 20); n++) {
    const conteudo = await (await doc.getPage(n)).getTextContent();
    paginas.push(
      conteudo.items.flatMap((item) =>
        "str" in item ? [{ texto: item.str, x: item.transform[4], y: item.transform[5] }] : []
      )
    );
  }
  return paginas;
}

/** O que uma fonte devolve para um mês e regime: linhas aceitas, "não tem" (tenta a próxima) ou recusa com motivo. */
type Resultado =
  | { tipo: "ok"; linhas: LinhaCub[]; fonte: string }
  | { tipo: "indisponivel"; motivo: string }
  | { tipo: "recusado"; motivo: string };

interface FonteCub {
  nome: string;
  ler(mes: MesBase, regime: Regime): Promise<Resultado>;
}

/** Portal da CBIC: uma página por UF com formulário Django que devolve o PDF da tabela do mês. */
async function fonteCbic(base: string, uf: Uf, fixos: Partial<Record<Uf, string>>): Promise<FonteCub | string> {
  const url = `${base}/cub-m2-estadual/${uf}/`;
  const r = await fetch(url, { headers: NAVEGADOR, signal: AbortSignal.timeout(30_000) });
  if (r.status === 404) {
    await r.body?.cancel();
    return "não está no portal da CBIC";
  }
  if (!r.ok) {
    await r.body?.cancel();
    return `portal da CBIC respondeu ${r.status}`;
  }
  const html = await r.text();
  const opcoes = lerOpcoesSinduscon(html);
  if (opcoes.length === 0) return "não está no portal da CBIC (sem Sinduscon no formulário)";
  const sinduscon = escolherSinduscon(uf, opcoes, fixos);
  if (!sinduscon) {
    return `portal da CBIC tem mais de um Sinduscon (${opcoes.map((o) => `${o.valor}=${o.rotulo}`).join(", ")}): fixe um em CUB_SINDUSCON`;
  }
  const setCookies = r.headers.getSetCookie();
  const csrf = lerCsrf(html, setCookies.join(", "));
  if (!csrf) return "portal da CBIC sem o token do formulário";
  const cookie = cookiesDaResposta(setCookies);

  return {
    nome: `cub.org.br, ${sinduscon.rotulo}`,
    async ler(mes, regime) {
      await pausa(CUB_PAUSA_MS + Math.random() * 1_000);
      const resp = await fetch(url, {
        method: "POST",
        headers: { ...NAVEGADOR, "Content-Type": "application/x-www-form-urlencoded", Referer: url, Cookie: cookie },
        body: new URLSearchParams(formularioCub(uf, sinduscon.valor, mes, regime, csrf)),
        signal: AbortSignal.timeout(60_000),
      });
      if (!resp.ok) {
        await resp.body?.cancel();
        return { tipo: "indisponivel", motivo: `pedido do PDF respondeu ${resp.status}` };
      }
      const bytes = await corpoLimitado(resp, TAMANHO_MAXIMO_PDF, "PDF da CBIC");
      if (!ehPdf(bytes)) return { tipo: "indisponivel", motivo: "mês ainda não publicado no portal da CBIC" };
      const leitura = lerPdfCub(await textoDoPdf(bytes), uf, mes, regime);
      return leitura.erro
        ? { tipo: "recusado", motivo: `CBIC: ${leitura.erro}` }
        : { tipo: "ok", linhas: leitura.linhas, fonte: `cub.org.br, ${sinduscon.rotulo}` };
    },
  };
}

/** Portal do Sinduscon: acha os PDFs na página do CUB e na listagem do WordPress, e lê o do mês. */
async function fontePortal(portal: PortalEstadual): Promise<FonteCub | string> {
  const links: LinkPdf[] = [];
  const problemas: string[] = [];
  for (const pagina of portal.paginas) {
    try {
      const r = await buscar(pagina, 30_000);
      if (r.ok) links.push(...linksPdfDaPagina(await r.text(), r.url || pagina));
      else {
        problemas.push(`${pagina} respondeu ${r.status}`);
        await r.body?.cancel();
      }
    } catch (e) {
      problemas.push(`${pagina}: ${(e as Error).message}`);
    }
    try {
      const r = await buscar(urlWordpressMedia(pagina), 30_000);
      if (r.ok && (r.headers.get("content-type") ?? "").includes("json"))
        links.push(...linksPdfDoWordpress(await r.json()));
      else await r.body?.cancel();
    } catch {
      // Sem WordPress: fica só com os links da página.
    }
  }
  if (links.length === 0) {
    return `portal do Sinduscon sem PDF à vista${problemas.length ? ` (${problemas.join("; ")})` : ""}`;
  }
  const lidos = new Map<string, ItemDeTexto[][]>();

  return {
    nome: `portal do Sinduscon-${portal.uf}`,
    async ler(mes, regime) {
      const candidatos = candidatosDoMes(links, mes, regime, portal.mesNoArquivo);
      if (candidatos.length === 0) return { tipo: "indisponivel", motivo: "portal do Sinduscon sem PDF deste mês" };
      if (candidatos.length > 5)
        return { tipo: "recusado", motivo: `portal: ${candidatos.length} PDFs do mês, ambíguo` };
      const aceitas: { linhas: LinhaCub[]; url: string }[] = [];
      const erros: string[] = [];
      let semRegime = 0;
      for (const c of candidatos) {
        let paginas = lidos.get(c.url);
        if (!paginas) {
          await pausa(CUB_PAUSA_MS);
          const r = await buscar(c.url, 60_000);
          if (!r.ok) {
            await r.body?.cancel();
            erros.push(`${c.url} respondeu ${r.status}`);
            continue;
          }
          const bytes = await corpoLimitado(r, TAMANHO_MAXIMO_PDF, c.url);
          if (!ehPdf(bytes)) {
            erros.push(`${c.url} não é PDF`);
            continue;
          }
          paginas = await textoDoPdf(bytes);
          lidos.set(c.url, paginas);
        }
        const leitura = lerPdfCub(paginas, portal.uf, mes, regime, { exigirRegimeNoTexto: true });
        if (!leitura.erro) aceitas.push({ linhas: leitura.linhas, url: c.url });
        else if (c.semMarcaDeRegime && leitura.erro.includes("não diz que é com desoneração")) semRegime++;
        else erros.push(`${c.url.split("/").pop()}: ${leitura.erro}`);
      }
      const distintas = new Set(aceitas.map((a) => a.linhas.map((l) => `${l.subtipo}${l.padrao}${l.valor_m2}`).join()));
      if (distintas.size > 1) return { tipo: "recusado", motivo: "portal: dois PDFs do mês com valores diferentes" };
      if (aceitas.length === 0 && erros.length === 0 && semRegime > 0) {
        return { tipo: "indisponivel", motivo: "portal do Sinduscon sem a versão com desoneração deste mês" };
      }
      if (aceitas.length === 0) return { tipo: "recusado", motivo: `portal: ${erros.join("; ")}` };
      const arquivo = decodeURIComponent(aceitas[0].url.split("/").pop() ?? "");
      return { tipo: "ok", linhas: aceitas[0].linhas, fonte: `${new URL(aceitas[0].url).host}, ${arquivo}` };
    },
  };
}

const mesAnterior = (mes: MesBase): MesBase => {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
};

async function coletarCub(db: Banco): Promise<void> {
  const base = (env("CUB_BASE_URL") || CUB_BASE_PADRAO).replace(/\/+$/, "");
  const fixos = lerFixos(env("CUB_SINDUSCON"));
  const extras = lerPortaisExtras(env("CUB_PORTAIS"));
  const filtro = env("CUB_UFS")
    .split(",")
    .map((u) => u.trim().toUpperCase())
    .filter(Boolean);
  const ufs = (UFS as readonly Uf[]).filter((u) => filtro.length === 0 || filtro.includes(u));

  const forcado = env("CUB_MES");
  let meses: MesBase[];
  if (forcado) {
    if (!mesValido(`${forcado}-01`)) throw new Error(`CUB_MES deve ser AAAA-MM (veio "${forcado}").`);
    meses = [`${forcado}-01`];
  } else {
    // O mês passado e, se faltou, o retrasado.
    meses = mesesPendentes(null, new Date(), 2);
  }
  const gravado: CubGravado[] = await db.cubDesde(mesAnterior(meses[0]));
  const tem = (uf: Uf, mes: MesBase, regime: Regime) =>
    gravado.some((l) => l.uf === uf && l.mes_base === mes && l.regime === regime);

  resumo(`### CUB${dryRun ? " (sem gravar)" : ""}`);
  const falhas: string[] = [];
  const semFonte: string[] = [];
  let total = 0;

  for (const uf of ufs) {
    const pendentes = meses.flatMap((mes) =>
      (["onerado", "desonerado"] as Regime[])
        .filter((r) => Boolean(forcado) || !tem(uf, mes, r))
        .map((regime) => ({ mes, regime }))
    );
    if (pendentes.length === 0) continue;

    // Fontes da UF em ordem. SP e RS publicam só no portal próprio.
    const portal = portaisDaUf(uf, extras);
    const fontes: FonteCub[] = [];
    const avisos: string[] = [];
    const abrir = async (f: () => Promise<FonteCub | string>) => {
      try {
        const aberta = await f();
        if (typeof aberta === "string") avisos.push(aberta);
        else fontes.push(aberta);
      } catch (e) {
        avisos.push((e as Error).message);
      }
    };
    if (!portal?.soPortal) await abrir(() => fonteCbic(base, uf, fixos));
    if (portal) await abrir(() => fontePortal(portal));
    if (fontes.length === 0) {
      semFonte.push(`${uf} (${avisos.join("; ") || "sem fonte configurada"})`);
      continue;
    }

    for (const { mes, regime } of pendentes) {
      const rotulo = `${uf} ${mes.slice(5, 7)}/${mes.slice(0, 4)} ${regime === "desonerado" ? "com" : "sem"} desoneração`;
      const motivos: string[] = [];
      let aceito: { linhas: LinhaCub[]; fonte: string } | null = null;
      let recusado = false;
      for (const fonte of fontes) {
        let r: Resultado;
        try {
          r = await fonte.ler(mes, regime);
        } catch (e) {
          r = { tipo: "recusado", motivo: `${fonte.nome}: ${(e as Error).message}` };
        }
        if (r.tipo === "ok") {
          const anteriores = gravado.filter(
            (l) => l.uf === uf && l.regime === regime && l.mes_base === mesAnterior(mes)
          );
          const salto = saltoSuspeito(r.linhas, anteriores as LinhaCub[]);
          if (salto) r = { tipo: "recusado", motivo: `${r.fonte}: variação suspeita contra o mês anterior. ${salto}` };
          else if (igualAoAnterior(r.linhas, anteriores as LinhaCub[])) {
            r = { tipo: "recusado", motivo: `${r.fonte}: valores idênticos ao mês anterior (arquivo repetido)` };
          } else {
            aceito = { linhas: r.linhas, fonte: r.fonte };
            break;
          }
        }
        if (r.tipo === "recusado") recusado = true;
        motivos.push(r.motivo);
      }
      if (!aceito) {
        if (recusado) falhas.push(`${rotulo}: ${motivos.join(" | ")}`);
        else resumo(`- ${rotulo}: ainda não publicado (${motivos.join("; ")}).`);
        continue;
      }
      const linhas = paraGravar(aceito.linhas);
      const fonte = `CUB ${mes.slice(5, 7)}/${mes.slice(0, 4)} (coleta automática: ${aceito.fonte})`.slice(0, 200);
      if (!dryRun) await db.gravarCub(linhas, fonte);
      gravado.push(...linhas);
      total += linhas.length;
      resumo(`- ${rotulo}: ${linhas.length} valores ${dryRun ? "lidos" : "gravados"} (${aceito.fonte}).`);
    }
  }

  if (semFonte.length > 0) resumo(`- Sem fonte automática, fica na importação manual: ${semFonte.join("; ")}.`);
  resumo(`- Total: ${total} valores ${dryRun ? "lidos" : "gravados"}.`);
  if (falhas.length > 0) {
    for (const f of falhas) resumo(`- RECUSADO ${f}`);
    throw new Error(`CUB: ${falhas.length} leitura(s) recusada(s), nada gravado nelas; o resto foi gravado.`);
  }
}

// ─── Conferência de atraso ─────────────────────────────────────────────────

async function conferir(db: Banco): Promise<void> {
  const hoje = new Date();
  const tabelas: Record<Base, "cub_valores" | "sinapi_precos_insumo"> = {
    cub: "cub_valores",
    sinapi: "sinapi_precos_insumo",
  };
  const atrasos = [];
  resumo("### Preços de referência");
  for (const base of ["cub", "sinapi"] as Base[]) {
    const ultimo = await db.ultimoMes(tabelas[base]);
    const a = atraso(base, ultimo, hoje);
    resumo(
      `- ${base.toUpperCase()}: último mês com os dois regimes ${ultimo ?? "nenhum"}${a ? `, esperado ${a.esperado} (ATRASADO)` : " (em dia)"}.`
    );
    if (a) atrasos.push(a);
  }
  if (atrasos.length > 0) {
    throw new Error(
      `Preço de referência atrasado: ${atrasos.map((a) => a.base.toUpperCase()).join(" e ")}. ` +
        "Importe em Ultra > Estimativa de obra (docs/operations/ESTIMATIVA_IMPORTAR_PRECOS_MENSAL.md)."
    );
  }
}

// ─── Sondagem (sem banco) ──────────────────────────────────────────────────

/** Parâmetros do motor como as migrations semeiam: o catálogo do SINAPI sem precisar do banco. */
function parametrosDasMigrations(): unknown {
  const pasta = new URL("../../supabase/migrations/", import.meta.url);
  const ler = (arquivo: string) => {
    const sql = Deno.readTextFileSync(new URL(arquivo, pasta));
    const json = /\$json\$([\s\S]*?)\$json\$/.exec(sql)?.[1];
    if (!json) throw new Error(`JSON de parâmetros não encontrado em ${arquivo}`);
    return JSON.parse(json) as Record<string, unknown>;
  };
  const base = ler("20261114000100_estimativa_obra.sql");
  const { adicionais: itens, ...outros } = ler("20261117000100_estimativa_itens_catalogo.sql");
  return {
    ...base,
    ...outros,
    natureza_base: ler("20261116000200_estimativa_natureza_cub.sql"),
    adicionais: {
      ...(base.adicionais as Record<string, unknown>),
      ...ler("20261116000100_estimativa_terreno_inclinado.sql"),
      ...(itens as Record<string, unknown>),
    },
  };
}

/**
 * Lê as fontes reais e roda todas as conferências sem banco e sem gravar. Não falha por causa de site fora do
 * ar: o resultado é o resumo (roda no PR que mexe no coletor, para ver o comportamento contra os sites de verdade).
 */
async function sondar(): Promise<void> {
  dryRun = true;
  const hoje = new Date();
  const tresAtras = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 3, 1)).toISOString().slice(0, 10);
  const db = bancoDeSondagem(parametrosDasMigrations(), tresAtras);
  resumo("## Sondagem das fontes reais (nada é gravado)");
  for (const [nome, etapa] of [
    ["SINAPI", coletarSinapi],
    ["CUB", coletarCub],
  ] as const) {
    try {
      await etapa(db);
    } catch (e) {
      resumo(`- ${nome}: ${(e as Error).message}`);
    }
  }
}

const comandos: Record<string, (db: Banco) => Promise<void>> = { sinapi: coletarSinapi, cub: coletarCub, conferir };
const nome = Deno.args[0] ?? "";
if (nome === "sondar") {
  await sondar();
  Deno.exit(0);
}
const comando = comandos[nome];
if (!comando) {
  console.error("Uso: coletar.ts sinapi | cub | conferir | sondar");
  Deno.exit(2);
}
let db: Banco | null = null;
let codigo = 0;
try {
  db = abrirBanco(env("SUPABASE_DB_URL"));
  await comando(db);
} catch (e) {
  console.error(`::error::${(e as Error).message}`);
  codigo = 1;
} finally {
  await db?.fechar();
}
Deno.exit(codigo);
