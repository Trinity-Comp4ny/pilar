import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { ErroDeDocx } from "@/lib/erroDeDocx";

const OPCOES = {
  delimiters: { start: "{{", end: "}}" },
  paragraphLoop: true,
  linebreaks: true,
  // "{{ CODIGO }}" (com espaço) é como muita gente digita no Word. Sem o trim, o upload listava
  // CODIGO como variável válida mas a geração não achava a chave e escrevia "undefined".
  parser: (tag: string) => ({
    get: (scope: unknown) => {
      if (tag === ".") return scope;
      return scope && typeof scope === "object" ? (scope as Record<string, unknown>)[tag.trim()] : undefined;
    },
  }),
  // Variável sem valor sai em branco, não como o texto "undefined" no documento do cliente.
  nullGetter: () => "",
};

type ErroDocxtemplater = {
  properties?: { errors?: { properties?: { id?: string; context?: string; xtag?: string } }[] };
};

/**
 * O docxtemplater joga "Multi error" quando uma marcação {{ }} está mal formada, e esse texto
 * não diz nada a quem escreveu o Word. Traduz para onde olhar e o que fazer.
 */
function traduzirErro(err: unknown): ErroDeDocx {
  const erros = (err as ErroDocxtemplater)?.properties?.errors;
  if (Array.isArray(erros) && erros.length > 0) {
    const trechos = erros
      .slice(0, 3)
      .map((e) => `"${(e.properties?.context ?? e.properties?.xtag ?? "").trim()}"`)
      .join(", ");
    return new ErroDeDocx(
      `O Word tem ${erros.length} marcação(ões) {{ }} com problema, perto de ${trechos}. Confira se cada {{ tem o }} correspondente e se a variável foi digitada de uma vez, sem formatar só uma parte.`,
      err
    );
  }
  return new ErroDeDocx(
    "Não foi possível ler este arquivo como Word (.docx). Abra no Word, salve de novo e envie.",
    err
  );
}

function abrirDocx(arrayBuffer: ArrayBuffer): { zip: PizZip; doc: Docxtemplater } {
  try {
    const zip = new PizZip(arrayBuffer);
    return { zip, doc: new Docxtemplater(zip, OPCOES) };
  } catch (err) {
    throw traduzirErro(err);
  }
}

const REGEX_VARIAVEL = /\{\{([^}]+)\}\}/g;

function variaveisDoTexto(texto: string, destino: Set<string>) {
  for (const match of texto.matchAll(REGEX_VARIAVEL)) destino.add(match[1].trim());
}

/**
 * Extrai variáveis {{VAR}} de um arquivo DOCX (ArrayBuffer): corpo, cabeçalhos e rodapés.
 * Retorna array de nomes únicos, ex: ["CLIENTE_NOME", "VALOR_PROPOSTO"]
 */
export function extractVariablesFromDocx(arrayBuffer: ArrayBuffer): string[] {
  const { zip, doc } = abrirDocx(arrayBuffer);
  const vars = new Set<string>();
  variaveisDoTexto(doc.getFullText(), vars);

  // getFullText só lê o corpo. Cabeçalho e rodapé também são renderizados, então as
  // variáveis deles entram na lista (tirar as tags de XML junta o texto quebrado em runs).
  for (const parte of zip.file(/^word\/(header|footer)\d*\.xml$/)) {
    variaveisDoTexto(parte.asText().replace(/<[^>]+>/g, ""), vars);
  }

  return Array.from(vars);
}

/**
 * Gera DOCX final substituindo variáveis no template.
 * Retorna Blob do arquivo DOCX.
 */
export function generateDocx(templateArrayBuffer: ArrayBuffer, data: Record<string, string>): Blob {
  const { doc } = abrirDocx(templateArrayBuffer);

  try {
    doc.render(data);
  } catch (err) {
    throw traduzirErro(err);
  }

  return doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

/**
 * Nomes escritos com uma chave só, {CODIGO}, que o gerador não substitui. Serve para dar uma dica
 * específica quando o Word não tem nenhuma variável {{ }}.
 */
export function chavesSimplesNoDocx(arrayBuffer: ArrayBuffer): string[] {
  const { doc } = abrirDocx(arrayBuffer);
  const nomes = new Set<string>();
  for (const match of doc.getFullText().matchAll(/(?<![{])\{([A-Za-z][A-Za-z0-9_]{2,})\}(?![}])/g)) nomes.add(match[1]);
  return Array.from(nomes);
}
