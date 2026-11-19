// SPEC 172 fase 0: lê a planilha de leads (XLSX ou CSV) no navegador. O arquivo nunca sobe para
// repositório nem passa por servidor: só os leads já normalizados vão para o banco, pelo RLS do
// ultra admin.
import { linhaParaLead, type LeadImportado, type MotivoDescarte } from "./prospeccaoLib";

export interface PlanilhaLida {
  linhas: number;
  leads: LeadImportado[];
  descartes: Record<MotivoDescarte, number>;
}

export const ROTULO_DESCARTE: Record<MotivoDescarte, string> = {
  sem_nome: "sem nome",
  segmento_desconhecido: "segmento fora da lista",
  sem_contato: "sem telefone nem e-mail",
};

/** Converte linhas (cabeçalho → valor) em leads, contando o que foi descartado e por quê. */
export function linhasParaLeads(linhas: Array<Record<string, unknown>>): PlanilhaLida {
  const leads: LeadImportado[] = [];
  const descartes: Record<MotivoDescarte, number> = { sem_nome: 0, segmento_desconhecido: 0, sem_contato: 0 };
  for (const linha of linhas) {
    const r = linhaParaLead(linha);
    if ("lead" in r) leads.push(r.lead);
    else descartes[r.descarte]++;
  }
  return { linhas: linhas.length, leads, descartes };
}

const CABECALHOS_DE_LEAD = ["Empresa", "Task Name"];

/** Lê o arquivo. No XLSX usa a aba "Todos os leads" ou a primeira que tiver coluna de empresa. */
export async function lerPlanilha(arquivo: File): Promise<PlanilhaLida> {
  const XLSX = await import("xlsx");
  const ehCsv = arquivo.name.toLowerCase().endsWith(".csv");
  const wb = ehCsv
    ? XLSX.read(await arquivo.text(), { type: "string" })
    : XLSX.read(await arquivo.arrayBuffer(), { type: "array" });

  const nomes = wb.SheetNames;
  const abas = nomes.map((n) => ({ nome: n, linhas: XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[n], { defval: "", raw: false }) }));
  const escolhida =
    abas.find((a) => a.nome === "Todos os leads") ??
    abas.find((a) => a.linhas[0] && CABECALHOS_DE_LEAD.some((c) => c in a.linhas[0])) ??
    abas[0];
  return linhasParaLeads(escolhida?.linhas ?? []);
}
