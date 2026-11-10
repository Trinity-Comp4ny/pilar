// CUB das UFs que publicam no portal do próprio Sinduscon, fora (ou além) do portal da CBIC. Regras puras.
//
// Cada portal publica o PDF do mês num link da página do CUB; a maioria é WordPress e também lista os arquivos
// em `/wp-json/wp/v2/media`. Aqui só se escolhe QUAL PDF é o do mês e do regime: a leitura e as conferências
// são as mesmas do portal da CBIC (`lerPdfCub`), então um link errado vira recusa, não preço errado.
import type { Regime, Uf } from "@/schemas/estimativaObra";
import { textoPuro } from "./cub";

export interface PortalEstadual {
  uf: Uf;
  /** Páginas onde o Sinduscon lista os PDFs do CUB. */
  paginas: string[];
  /**
   * Mês que o nome do arquivo cita: o de referência do CUB, ou o de publicação (mês seguinte). O Sinduscon-RS
   * publica em fevereiro o "Preços e custos da construção" com o CUB de janeiro.
   */
  mesNoArquivo: "referencia" | "publicacao";
  /** Só o portal estadual (a UF não está no portal da CBIC). */
  soPortal: boolean;
}

/**
 * Portais conhecidos. Endereços tirados das publicações dos próprios Sinduscons; ainda sem execução contra o site
 * real (conferir no primeiro run em modo leitura). Outros entram pela variável `CUB_PORTAIS`, sem deploy.
 */
export const PORTAIS: PortalEstadual[] = [
  { uf: "SP", paginas: ["https://sindusconsp.com.br/servicos/cub/"], mesNoArquivo: "referencia", soPortal: true },
  {
    uf: "RS",
    paginas: ["https://sinduscon-rs.com.br/cub/", "https://sinduscon-rs.com.br/"],
    mesNoArquivo: "publicacao",
    soPortal: true,
  },
  { uf: "MS", paginas: ["https://sindusconms.com.br/cub/"], mesNoArquivo: "referencia", soPortal: false },
];

/**
 * `CUB_PORTAIS="TO=https://exemplo/cub/;AL=https://outro/cub/|publicacao"` acrescenta ou troca portais.
 * Endereço que não é https é ignorado.
 */
export function lerPortaisExtras(texto: string): PortalEstadual[] {
  const extras: PortalEstadual[] = [];
  for (const parte of texto.split(";")) {
    const m = /^\s*([A-Z]{2})\s*=\s*(https:\/\/[^\s|]+)\s*(?:\|\s*(referencia|publicacao))?\s*$/.exec(parte);
    if (!m) continue;
    extras.push({
      uf: m[1] as Uf,
      paginas: [m[2]],
      mesNoArquivo: (m[3] as PortalEstadual["mesNoArquivo"]) ?? "referencia",
      soPortal: false,
    });
  }
  return extras;
}

export function portaisDaUf(uf: Uf, extras: PortalEstadual[]): PortalEstadual | null {
  return extras.find((p) => p.uf === uf) ?? PORTAIS.find((p) => p.uf === uf) ?? null;
}

export interface LinkPdf {
  url: string;
  texto: string;
  /**
   * O arquivo entrou como candidato a "com desoneração" sem dizer isso no nome (pode trazer os dois regimes).
   * Se a leitura não achar o regime no texto, o mês desonerado só não está disponível: não é recusa.
   */
  semMarcaDeRegime?: boolean;
}

const semMarca = (l: LinkPdf): LinkPdf => ({ ...l, semMarcaDeRegime: true });

/** Links para PDF numa página HTML, com o texto da âncora. Só https. */
export function linksPdfDaPagina(html: string, paginaUrl: string): LinkPdf[] {
  const links: LinkPdf[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].replace(/&amp;/g, "&");
    let url: string;
    try {
      url = new URL(href, paginaUrl).toString();
    } catch {
      continue;
    }
    if (!url.startsWith("https://") || !/\.pdf(\?|#|$)/i.test(url)) continue;
    links.push({ url, texto: textoPuro(m[2]) });
  }
  return links;
}

/** PDFs listados por `/wp-json/wp/v2/media` (campos `source_url` e `title.rendered`). */
export function linksPdfDoWordpress(json: unknown): LinkPdf[] {
  if (!Array.isArray(json)) return [];
  return json.flatMap((item) => {
    const url = typeof item?.source_url === "string" ? item.source_url : "";
    const texto = typeof item?.title?.rendered === "string" ? textoPuro(item.title.rendered) : "";
    return url.startsWith("https://") && /\.pdf$/i.test(url) ? [{ url, texto }] : [];
  });
}

/** Endereço da listagem de mídia do WordPress do site da página, procurando por "cub". */
export function urlWordpressMedia(paginaUrl: string): string {
  return `${new URL(paginaUrl).origin}/wp-json/wp/v2/media?search=cub&per_page=100&mime_type=application/pdf`;
}

const MESES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];
const ABREV = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const normalizar = (t: string) => decodeSeguro(t).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function decodeSeguro(t: string): string {
  try {
    return decodeURIComponent(t);
  } catch {
    return t;
  }
}

function somarMes(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** O link cita este mês? Aceita "outubro-2026", "out/2026", "10-2026", "2026-10", "102026". Ignora a pasta de upload do WordPress. */
function citaMes(link: LinkPdf, mes: string): boolean {
  const ano = mes.slice(0, 4);
  const mm = mes.slice(5, 7);
  const i = Number(mm) - 1;
  const alvo = normalizar(`${link.url.replace(/\/wp-content\/uploads\/\d{4}\/\d{2}\//i, "/")} ${link.texto}`);
  const nome = new RegExp(`(^|[^a-z])(${MESES[i]}|${ABREV[i]})[^a-z0-9]{0,3}(de[^a-z0-9]{0,3})?${ano}`);
  const numero = new RegExp(`(^|[^0-9])(${mm}[-_./ ]?${ano}|${ano}[-_./ ]?${mm})([^0-9]|$)`);
  return nome.test(alvo) || numero.test(alvo);
}

const DESONERADO = /desonera/;
const SEM_DESONERACAO = /(sem|nao)[^a-z]{0,3}desonera/;

/**
 * PDFs candidatos ao mês e ao regime. Sem desoneração: o que não diz "desonerado" ou diz "sem desoneração".
 * Com: o que diz "desonerado"; sem nenhum assim, o arquivo sem marca (pode ter os dois regimes, um por página).
 * A leitura do PDF decide, e exige o regime escrito no texto.
 */
export function candidatosDoMes(
  links: LinkPdf[],
  mes: string,
  regime: Regime,
  mesNoArquivo: PortalEstadual["mesNoArquivo"]
): LinkPdf[] {
  const mesDoArquivo = mesNoArquivo === "publicacao" ? somarMes(mes, 1) : mes;
  const vistos = new Set<string>();
  const doMes = links.filter((l) => {
    if (vistos.has(l.url) || !citaMes(l, mesDoArquivo)) return false;
    vistos.add(l.url);
    return true;
  });
  const marca = (l: LinkPdf) => {
    const t = normalizar(`${l.url} ${l.texto}`);
    if (SEM_DESONERACAO.test(t)) return "onerado";
    return DESONERADO.test(t) ? "desonerado" : "sem-marca";
  };
  // Sem desoneração é a série clássica: o arquivo sem marca também serve.
  if (regime === "onerado") return doMes.filter((l) => marca(l) !== "desonerado");
  const desonerados = doMes.filter((l) => marca(l) === "desonerado");
  return desonerados.length > 0 ? desonerados : doMes.filter((l) => marca(l) === "sem-marca").map(semMarca);
}
