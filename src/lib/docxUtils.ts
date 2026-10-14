import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";

/**
 * Extrai variáveis {{VAR}} de um arquivo DOCX (ArrayBuffer).
 * Retorna array de nomes únicos, ex: ["CLIENTE_NOME", "VALOR_PROPOSTO"]
 */
export function extractVariablesFromDocx(arrayBuffer: ArrayBuffer): string[] {
  const zip = new PizZip(arrayBuffer);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
  });

  // Extrai texto completo do doc
  const fullText = doc.getFullText();

  // Regex pra encontrar {{VARIAVEL}}
  const regex = /\{\{([^}]+)\}\}/g;
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(fullText)) !== null) {
    vars.add(match[1].trim());
  }

  return Array.from(vars);
}

/**
 * Gera DOCX final substituindo variáveis no template.
 * Retorna Blob do arquivo DOCX.
 */
export function generateDocx(templateArrayBuffer: ArrayBuffer, data: Record<string, string>): Blob {
  const zip = new PizZip(templateArrayBuffer);
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render(data);

  const output = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return output;
}
