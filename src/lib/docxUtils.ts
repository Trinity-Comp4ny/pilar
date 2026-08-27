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
 * Variáveis que o sistema preenche automaticamente a partir dos dados.
 */
export const AUTO_VARIABLES: Record<string, string> = {
  CLIENTE_NOME: "Nome do cliente/lead",
  CLIENTE_EMAIL: "Email do cliente/lead",
  CLIENTE_CONTATO: "Telefone do cliente/lead",
  EMPRESA_NOME: "Nome da empresa",
  AREA_M2: "Área em m²",
  VALOR_PROPOSTO: "Valor proposto formatado",
  PRAZO_DIAS: "Prazo estimado em dias",
  LOCALIZACAO: "Localização da obra",
  CODIGO: "Código da proposta",
  TITULO: "Título da proposta",
  DATA_HOJE: "Data atual",
  VALIDADE: "Data de validade",
  DISCIPLINAS: "Lista de disciplinas",
  DISCIPLINAS_FASES: "Disciplinas, uma por linha (nome só)",
  DISCIPLINAS_COM_VALOR: "Disciplinas, uma por linha, com valor",
  DISCIPLINAS_DETALHADO: "Disciplinas, uma por linha, com horas + custo/h + valor",
  OBSERVACAO: "Observações",
};

/**
 * Monta os dados de variáveis a partir da proposta + lead + empresa.
 */
export function buildVariableData(params: {
  proposta: {
    codigo?: string | null;
    titulo: string;
    area_m2?: number | null;
    localizacao?: string | null;
    valor_proposto?: number | null;
    prazo_estimado_dias?: number | null;
    validade?: string | null;
    observacao?: string | null;
  };
  lead?: { nome?: string; email?: string; contato?: string } | null;
  cliente?: { nome?: string; email?: string; contato?: string } | null;
  empresaNome?: string;
  disciplinas?: { disciplina: string; horas_estimadas: number; custo_hora: number; valor_venda?: number }[];
}): Record<string, string> {
  const { proposta, lead, cliente, empresaNome, disciplinas } = params;
  const contact = cliente || lead;

  const formatCurrency = (v: number | null | undefined) =>
    v ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v) : "";

  const formatDate = (d: string | null | undefined) => (d ? new Date(d + "T00:00:00").toLocaleDateString("pt-BR") : "");

  const discList = disciplinas?.map((d) => d.disciplina).join(", ") || "";

  // Valor de cada disciplina: usa valor_venda quando existe; senão calcula
  // horas × custo_hora (propostas antigas podem não ter valor_venda salvo).
  const valorDisciplina = (d: NonNullable<typeof disciplinas>[number]) =>
    d.valor_venda ?? d.horas_estimadas * d.custo_hora;

  const disciplinasFases = disciplinas?.map((d) => d.disciplina).join("\n") || "";
  const disciplinasComValor =
    disciplinas?.map((d) => `${d.disciplina} — ${formatCurrency(valorDisciplina(d))}`).join("\n") || "";
  const disciplinasDetalhado =
    disciplinas
      ?.map(
        (d) =>
          `${d.disciplina} — ${d.horas_estimadas}h × ${formatCurrency(d.custo_hora)}/h — ${formatCurrency(valorDisciplina(d))}`
      )
      .join("\n") || "";

  return {
    CLIENTE_NOME: contact?.nome || "",
    CLIENTE_EMAIL: contact?.email || "",
    CLIENTE_CONTATO: contact?.contato || "",
    EMPRESA_NOME: empresaNome || "",
    AREA_M2: proposta.area_m2 ? String(proposta.area_m2) : "",
    VALOR_PROPOSTO: formatCurrency(proposta.valor_proposto),
    PRAZO_DIAS: proposta.prazo_estimado_dias ? String(proposta.prazo_estimado_dias) : "",
    LOCALIZACAO: proposta.localizacao || "",
    CODIGO: proposta.codigo || "",
    TITULO: proposta.titulo,
    DATA_HOJE: new Date().toLocaleDateString("pt-BR"),
    VALIDADE: formatDate(proposta.validade),
    DISCIPLINAS: discList,
    DISCIPLINAS_FASES: disciplinasFases,
    DISCIPLINAS_COM_VALOR: disciplinasComValor,
    DISCIPLINAS_DETALHADO: disciplinasDetalhado,
    OBSERVACAO: proposta.observacao || "",
  };
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
