// Coleta mensal dos preços de referência da estimativa de obra (Deno, roda no GitHub Actions).
//
//   deno run --config scripts/precos-referencia/deno.json -A scripts/precos-referencia/coletar.ts sinapi
//   deno run --config scripts/precos-referencia/deno.json -A scripts/precos-referencia/coletar.ts conferir
//
// `sinapi`: para cada mês que falta no banco (ou que a Caixa retificou), baixa o zip do mês, tira a planilha
// SINAPI_Referência, lê as abas ISD e ICD com o mesmo leitor da importação manual e grava só os códigos do
// catálogo. Mês ainda não publicado não é erro. Arquivo fora do formato é erro e nada é gravado.
// `cub`: para cada UF do portal da CBIC (cub.org.br) e cada mês e regime que faltam, pede o PDF da tabela do
// mês, lê com as conferências de `cub.ts` e grava. UF fora do portal (SP, RS e outras) fica na importação
// manual. UF com PDF que não passa nas conferências não grava nada e faz o job falhar no fim.
// `conferir`: falha quando o CUB ou o SINAPI do mês anterior não chegou no prazo, para abrir a issue do cron.
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_KEY (obrigatórias); DRY_RUN=1 lê e confere sem gravar;
// SINAPI_MES=AAAA-MM força um mês; SINAPI_PAGINA_URL e SINAPI_DOWNLOAD_BASE trocam os endereços da Caixa;
// CUB_MES=AAAA-MM força um mês do CUB; CUB_UFS="GO,MG" limita as UFs; CUB_SINDUSCON="MG=12" fixa o Sinduscon
// de uma UF com mais de um; CUB_BASE_URL troca o endereço do portal.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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
  lerCsrf,
  lerFixos,
  lerOpcoesSinduscon,
  lerPdfCub,
  saltoSuspeito,
  type ItemDeTexto,
  type LinhaCub,
} from "./cub.ts";

const PAGINA_PADRAO = "https://www.caixa.gov.br/poder-publico/modernizacao-gestao/sinapi/Paginas/default.aspx";
const DOWNLOAD_PADRAO = "https://www.caixa.gov.br/Downloads/sinapi-relatorios-mensais";
const TAMANHO_MAXIMO_ZIP = 300_000_000;
const TAMANHO_LOTE = 500;
const TEMPO_LIMITE_MS = 180_000;
// A Caixa recusa alguns clientes sem User-Agent de navegador.
const CABECALHOS = { "User-Agent": "Mozilla/5.0 (compatible; coleta-precos-referencia/1.0)" };

const env = (nome: string) => Deno.env.get(nome)?.trim() ?? "";
const dryRun = env("DRY_RUN") === "1" || env("DRY_RUN") === "true";

function resumo(linha: string): void {
  console.warn(linha);
  const arquivo = env("GITHUB_STEP_SUMMARY");
  if (arquivo) Deno.writeTextFileSync(arquivo, `${linha}\n`, { append: true });
}

function cliente(): SupabaseClient {
  const url = env("SUPABASE_URL");
  const chave = env("SUPABASE_SERVICE_KEY");
  if (!url || !chave) throw new Error("Faltam SUPABASE_URL e SUPABASE_SERVICE_KEY.");
  return createClient(url, chave, { auth: { persistSession: false } });
}

async function ultimoMes(db: SupabaseClient, tabela: "cub_valores" | "sinapi_precos_insumo"): Promise<MesBase | null> {
  // O mês só conta como em dia quando os dois regimes chegaram: o mais velho dos dois manda.
  const meses: (MesBase | null)[] = [];
  for (const regime of ["onerado", "desonerado"]) {
    const { data, error } = await db
      .from(tabela)
      .select("mes_base")
      .eq("regime", regime)
      .order("mes_base", { ascending: false })
      .limit(1);
    if (error) throw new Error(`Falha ao ler ${tabela}: ${error.message}`);
    meses.push((data?.[0]?.mes_base as string | undefined) ?? null);
  }
  if (meses.some((m) => m === null)) return null;
  return (meses as MesBase[]).sort()[0];
}

async function buscar(url: string): Promise<Response> {
  return await fetch(url, { headers: CABECALHOS, signal: AbortSignal.timeout(TEMPO_LIMITE_MS), redirect: "follow" });
}

/** Lê a página da Caixa atrás dos links. Página fora do ar não impede a coleta: sobra o endereço direto. */
async function linksDaPagina(paginaUrl: string): Promise<Map<MesBase, ArquivoSinapi>> {
  try {
    const r = await buscar(paginaUrl);
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
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`Download de ${arquivo.nome} respondeu ${r.status}.`);
  const tipo = r.headers.get("content-type") ?? "";
  if (tipo.includes("text/html")) return null;
  const tamanho = Number(r.headers.get("content-length") ?? 0);
  if (tamanho > TAMANHO_MAXIMO_ZIP) throw new Error(`${arquivo.nome} passa de ${TAMANHO_MAXIMO_ZIP} bytes.`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > TAMANHO_MAXIMO_ZIP) throw new Error(`${arquivo.nome} passa de ${TAMANHO_MAXIMO_ZIP} bytes.`);
  // Zip começa com "PK".
  if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return null;
  return bytes;
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
  const nome = nomes[0];
  const livro = XLSX.read(conteudo[nome], { type: "array", sheets: ["ISD", "ICD"] });
  return ["ISD", "ICD"].flatMap((aba) => {
    const folha = livro.Sheets[aba];
    if (!folha) return [];
    return [{ nome: aba, celulas: XLSX.utils.sheet_to_json<unknown[]>(folha, { header: 1, raw: true, defval: "" }) }];
  });
}

async function fonteGravada(db: SupabaseClient, mes: MesBase): Promise<string | null> {
  const { data, error } = await db.from("sinapi_precos_insumo").select("fonte").eq("mes_base", mes).limit(1);
  if (error) throw new Error(`Falha ao ler sinapi_precos_insumo: ${error.message}`);
  return (data?.[0]?.fonte as string | undefined) ?? null;
}

async function gravar(db: SupabaseClient, linhas: Record<string, unknown>[]): Promise<void> {
  for (let i = 0; i < linhas.length; i += TAMANHO_LOTE) {
    const lote = linhas.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await db
      .from("sinapi_precos_insumo")
      .upsert(lote, { onConflict: "codigo,uf,regime,mes_base" })
      .select("codigo");
    if (error) throw new Error(`O banco recusou o lote ${i / TAMANHO_LOTE + 1}: ${error.message}`);
    if ((data?.length ?? 0) < lote.length) throw new Error("O banco não aceitou todas as linhas do lote.");
  }
}

async function coletarSinapi(): Promise<void> {
  const db = cliente();
  const hoje = new Date();

  const { data: param, error } = await db
    .from("estimativa_parametros")
    .select("parametros")
    .eq("id", "default")
    .single();
  if (error) throw new Error(`Falha ao ler os parâmetros da estimativa: ${error.message}`);
  const lido = lerParametros(param.parametros);
  if (!lido.ok) throw new Error(lido.mensagem);
  const catalogo = codigosDoCatalogo(lido.parametros.adicionais);

  const forcado = env("SINAPI_MES");
  const pagina = env("SINAPI_PAGINA_URL") || PAGINA_PADRAO;
  const base = env("SINAPI_DOWNLOAD_BASE") || DOWNLOAD_PADRAO;
  const achados = await linksDaPagina(pagina);

  let meses: MesBase[];
  if (forcado) {
    const mes = `${forcado}-01`;
    if (!mesValido(mes)) throw new Error(`SINAPI_MES deve ser AAAA-MM (veio "${forcado}").`);
    meses = [mes];
  } else {
    meses = mesesPendentes(await ultimoMes(db, "sinapi_precos_insumo"), hoje);
    // Retificação de um mês já gravado: a Caixa republica com o sufixo _RetificacaoNN.
    for (const achado of achados.values()) {
      if (meses.includes(achado.mes) || achado.retificacao === 0) continue;
      const fonte = await fonteGravada(db, achado.mes);
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
    const fonte = fonteDaColeta(arquivo);
    if (!dryRun)
      await gravar(
        db,
        resultado.linhas.map((l) => ({ ...l, fonte }))
      );
    resumo(
      `- ${arquivo.nome}: ${resultado.linhas.length} preços ${dryRun ? "lidos" : "gravados"}` +
        (resultado.semPreco.length
          ? `; sem preço em nenhuma UF: ${resultado.semPreco.map((s) => `${s.codigo} (${s.rotulo})`).join(", ")}`
          : "") +
        "."
    );
  }
}

async function conferir(): Promise<void> {
  const db = cliente();
  const hoje = new Date();
  const tabelas: Record<Base, "cub_valores" | "sinapi_precos_insumo"> = {
    cub: "cub_valores",
    sinapi: "sinapi_precos_insumo",
  };
  const atrasos = [];
  resumo("### Preços de referência");
  for (const base of ["cub", "sinapi"] as Base[]) {
    const ultimo = await ultimoMes(db, tabelas[base]);
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

// ─── CUB (portal da CBIC) ───────────────────────────────────────────────────

const CUB_BASE_PADRAO = "http://www.cub.org.br";
const CUB_PAUSA_MS = 1_500;
const CUB_TAMANHO_MAXIMO_PDF = 10_000_000;
// Navegador comum: o portal é um Django que espera formulário enviado de navegador.
const CUB_CABECALHOS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function textoDoPdf(pdf: Uint8Array): Promise<ItemDeTexto[][]> {
  const doc = await getDocumentProxy(pdf);
  const paginas: ItemDeTexto[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const conteudo = await (await doc.getPage(n)).getTextContent();
    paginas.push(
      conteudo.items.flatMap((item) =>
        "str" in item ? [{ texto: item.str, x: item.transform[4], y: item.transform[5] }] : []
      )
    );
  }
  return paginas;
}

interface SessaoCub {
  url: string;
  csrf: string;
  cookie: string;
  sinduscon: { valor: string; rotulo: string };
}

/** Abre a página da UF: token, cookies e o Sinduscon. `null` com motivo quando a UF não está no portal. */
async function abrirUf(base: string, uf: Uf, fixos: Partial<Record<Uf, string>>): Promise<SessaoCub | string> {
  const url = `${base}/cub-m2-estadual/${uf}/`;
  const r = await fetch(url, { headers: CUB_CABECALHOS, signal: AbortSignal.timeout(30_000) });
  if (r.status === 404) return "fora do portal da CBIC";
  if (!r.ok) throw new Error(`${uf}: a página do portal respondeu ${r.status}.`);
  const html = await r.text();
  const opcoes = lerOpcoesSinduscon(html);
  if (opcoes.length === 0) return "fora do portal da CBIC (sem Sinduscon no formulário)";
  const sinduscon = escolherSinduscon(uf, opcoes, fixos);
  if (!sinduscon) {
    return `mais de um Sinduscon (${opcoes.map((o) => `${o.valor}=${o.rotulo}`).join(", ")}): fixe um em CUB_SINDUSCON`;
  }
  const setCookies = r.headers.getSetCookie();
  const csrf = lerCsrf(html, setCookies.join(", "));
  if (!csrf) throw new Error(`${uf}: a página do portal não trouxe o token do formulário.`);
  return { url, csrf, cookie: cookiesDaResposta(setCookies), sinduscon };
}

/** Pede o PDF do mês. `null` quando o mês ainda não saiu (o portal devolve uma página no lugar do PDF). */
async function pdfDoMes(s: SessaoCub, uf: Uf, mes: MesBase, regime: Regime): Promise<Uint8Array | null> {
  const r = await fetch(s.url, {
    method: "POST",
    headers: {
      ...CUB_CABECALHOS,
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: s.url,
      Cookie: s.cookie,
    },
    body: new URLSearchParams(formularioCub(uf, s.sinduscon.valor, mes, regime, s.csrf)),
    signal: AbortSignal.timeout(60_000),
  });
  if (!r.ok) throw new Error(`${uf}: o pedido do PDF respondeu ${r.status}.`);
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes.length > CUB_TAMANHO_MAXIMO_PDF) throw new Error(`${uf}: PDF passa de ${CUB_TAMANHO_MAXIMO_PDF} bytes.`);
  const ehPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  return ehPdf ? bytes : null;
}

interface CubGravado {
  uf: string;
  subtipo: string;
  padrao: string;
  mes_base: string;
  regime: string;
  valor_m2: number;
}

async function cubGravado(db: SupabaseClient, desde: MesBase): Promise<CubGravado[]> {
  const { data, error } = await db
    .from("cub_valores")
    .select("uf, subtipo, padrao, mes_base, regime, valor_m2")
    .gte("mes_base", desde)
    .limit(20_000);
  if (error) throw new Error(`Falha ao ler cub_valores: ${error.message}`);
  return (data ?? []).map((l) => ({ ...l, valor_m2: Number(l.valor_m2) })) as CubGravado[];
}

async function gravarCub(db: SupabaseClient, linhas: LinhaCub[], fonte: string): Promise<void> {
  const { data, error } = await db
    .from("cub_valores")
    .upsert(
      linhas.map((l) => ({ ...l, fonte })),
      { onConflict: "uf,subtipo,padrao,mes_base,regime" }
    )
    .select("id");
  if (error) throw new Error(`O banco recusou o CUB: ${error.message}`);
  if ((data?.length ?? 0) < linhas.length) throw new Error("O banco não aceitou todas as linhas do CUB.");
}

function mesAnterior(mes: MesBase): MesBase {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

async function coletarCub(): Promise<void> {
  const db = cliente();
  const base = (env("CUB_BASE_URL") || CUB_BASE_PADRAO).replace(/\/+$/, "");
  const fixos = lerFixos(env("CUB_SINDUSCON"));
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
    // Os dois últimos meses: o do mês passado e, se faltou, o retrasado.
    meses = mesesPendentes(null, new Date(), 2);
  }
  const gravado = await cubGravado(db, mesAnterior(meses[0]));
  const tem = (uf: Uf, mes: MesBase, regime: Regime) =>
    gravado.some((l) => l.uf === uf && l.mes_base === mes && l.regime === regime);

  resumo(`### CUB${dryRun ? " (sem gravar)" : ""}`);
  const falhas: string[] = [];
  const manuais: string[] = [];
  let gravadas = 0;
  for (const uf of ufs) {
    const pendentes = meses.flatMap((mes) =>
      (["onerado", "desonerado"] as Regime[])
        .filter((r) => forcado || !tem(uf, mes, r))
        .map((r) => ({ mes, regime: r }))
    );
    if (pendentes.length === 0) continue;
    let sessao: SessaoCub | string;
    try {
      sessao = await abrirUf(base, uf, fixos);
    } catch (e) {
      falhas.push((e as Error).message);
      continue;
    }
    if (typeof sessao === "string") {
      manuais.push(`${uf} (${sessao})`);
      continue;
    }
    for (const { mes, regime } of pendentes) {
      await pausa(CUB_PAUSA_MS + Math.random() * 1_000);
      const rotulo = `${uf} ${mes.slice(5, 7)}/${mes.slice(0, 4)} ${regime === "desonerado" ? "com" : "sem"} desoneração`;
      try {
        const pdf = await pdfDoMes(sessao, uf, mes, regime);
        if (!pdf) {
          resumo(`- ${rotulo}: ainda não publicado.`);
          continue;
        }
        const leitura = lerPdfCub(await textoDoPdf(pdf), uf, mes, regime);
        if (leitura.erro) throw new Error(`${rotulo}: ${leitura.erro}`);
        const anteriores = gravado.filter((l) => l.uf === uf && l.regime === regime && l.mes_base === mesAnterior(mes));
        const salto = saltoSuspeito(leitura.linhas, anteriores as Pick<LinhaCub, "subtipo" | "padrao" | "valor_m2">[]);
        if (salto) throw new Error(`${rotulo}: variação suspeita contra o mês anterior, nada gravado. ${salto}`);
        const fonte =
          `CUB ${mes.slice(5, 7)}/${mes.slice(0, 4)} (coleta automática: cub.org.br, ${sessao.sinduscon.rotulo})`.slice(
            0,
            200
          );
        if (!dryRun) await gravarCub(db, leitura.linhas, fonte);
        gravado.push(...leitura.linhas);
        gravadas += leitura.linhas.length;
        resumo(
          `- ${rotulo}: ${leitura.linhas.length} valores ${dryRun ? "lidos" : "gravados"} (${sessao.sinduscon.rotulo}).`
        );
      } catch (e) {
        falhas.push((e as Error).message);
      }
    }
  }
  if (manuais.length > 0) resumo(`- Fica na importação manual: ${manuais.join("; ")}.`);
  resumo(`- Total: ${gravadas} valores${dryRun ? " lidos" : " gravados"}.`);
  if (falhas.length > 0) {
    for (const f of falhas) resumo(`- FALHA ${f}`);
    throw new Error(`CUB: ${falhas.length} leitura(s) recusada(s); as demais UFs foram gravadas.`);
  }
}

const comandos: Record<string, () => Promise<void>> = { sinapi: coletarSinapi, cub: coletarCub, conferir };
const comando = comandos[Deno.args[0] ?? ""];
if (!comando) {
  console.error("Uso: coletar.ts sinapi | cub | conferir");
  Deno.exit(2);
}
try {
  await comando();
} catch (e) {
  console.error(`::error::${(e as Error).message}`);
  Deno.exit(1);
}
