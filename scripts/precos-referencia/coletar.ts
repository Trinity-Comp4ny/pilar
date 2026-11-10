// Coleta mensal dos preços de referência da estimativa de obra (Deno, roda no GitHub Actions).
//
//   deno run --config scripts/precos-referencia/deno.json -A scripts/precos-referencia/coletar.ts sinapi
//   deno run --config scripts/precos-referencia/deno.json -A scripts/precos-referencia/coletar.ts conferir
//
// `sinapi`: para cada mês que falta no banco (ou que a Caixa retificou), baixa o zip do mês, tira a planilha
// SINAPI_Referência, lê as abas ISD e ICD com o mesmo leitor da importação manual e grava só os códigos do
// catálogo. Mês ainda não publicado não é erro. Arquivo fora do formato é erro e nada é gravado.
// `conferir`: falha quando o CUB ou o SINAPI do mês anterior não chegou no prazo, para abrir a issue do cron.
//
// Variáveis: SUPABASE_URL, SUPABASE_SERVICE_KEY (obrigatórias); DRY_RUN=1 lê e confere sem gravar;
// SINAPI_MES=AAAA-MM força um mês; SINAPI_PAGINA_URL e SINAPI_DOWNLOAD_BASE trocam os endereços da Caixa.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { unzipSync } from "fflate";
import * as XLSX from "xlsx";
import { lerParametros } from "@/lib/estimativaObra";
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

const comandos: Record<string, () => Promise<void>> = { sinapi: coletarSinapi, conferir };
const comando = comandos[Deno.args[0] ?? ""];
if (!comando) {
  console.error("Uso: coletar.ts sinapi | conferir");
  Deno.exit(2);
}
try {
  await comando();
} catch (e) {
  console.error(`::error::${(e as Error).message}`);
  Deno.exit(1);
}
