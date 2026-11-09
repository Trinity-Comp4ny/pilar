import type { ExtraidoRegistro } from "@/lib/registrosObra";
import type { EntradaEfetivo } from "@/pages/obras/hooks/useObraRdoEfetivo";
import type { EntradaImpedimento } from "@/pages/obras/hooks/useObraRdoImpedimentos";

/**
 * Resumo do dia (SPEC 135, fase B): junta o que a IA já extraiu de cada registro pronto do dia
 * num rascunho de RDO. É soma de dado já organizado, sem nova chamada de IA: não gasta token, não
 * demora e o gestor revisa tudo no formulário antes de salvar.
 */

type RegistroDoDia = {
  id: string;
  status: string;
  rdo_id: string | null;
  texto_organizado: string | null;
  extraido: ExtraidoRegistro | null;
};

/** O que vai preenchido no formulário do RDO quando o gestor fecha o dia. */
export interface RascunhoRdo {
  data: string;
  /** Registros que passam a apontar para o RDO quando ele for salvo. */
  registroIds: string[];
  campos?: { atividades: string; ocorrencias: string; pendencias: string; efetivo: string };
  efetivoLinhas: EntradaEfetivo[];
  impedimentoLinhas: EntradaImpedimento[];
}

export interface ResumoDia {
  /** Registros prontos que entraram na soma. */
  prontos: number;
  /** Registros do dia que ainda não foram organizados pela IA (não entram). */
  pendentes: number;
  /** Registros do dia que já apontam para um RDO. */
  fechados: number;
  efetivoTotal: number | null;
  equipes: Array<{ nome: string; quantidade: number }>;
  avancos: string[];
  ocorrencias: string[];
  pendencias: string[];
  materiaisFaltando: string[];
}

const VERBO: Record<string, string> = { comecou: "começou", avancou: "avançou", concluiu: "concluiu", parou: "parou" };

/** Mantém a primeira ocorrência, sem diferenciar caixa nem espaço nas pontas. */
function unicos(itens: string[]): string[] {
  const vistos = new Set<string>();
  return itens.flatMap((item) => {
    const texto = item.trim();
    const chave = texto.toLowerCase();
    if (!texto || vistos.has(chave)) return [];
    vistos.add(chave);
    return [texto];
  });
}

/**
 * Efetivo do dia sem contar a mesma equipe duas vezes: dois registros do dia podem citar o
 * mesmo time. Por equipe vale o maior número citado; sem equipe nenhuma, o maior total citado.
 */
function efetivoDoDia(extraidos: ExtraidoRegistro[]) {
  const porEquipe = new Map<string, { nome: string; quantidade: number }>();
  for (const e of extraidos) {
    for (const eq of e.equipes ?? []) {
      const chave = eq.nome.trim().toLowerCase();
      const atual = porEquipe.get(chave);
      if (!atual || eq.quantidade > atual.quantidade)
        porEquipe.set(chave, { nome: eq.nome.trim(), quantidade: eq.quantidade });
    }
  }
  const equipes = [...porEquipe.values()];
  if (equipes.length > 0) {
    return { efetivoTotal: equipes.reduce((soma, eq) => soma + eq.quantidade, 0), equipes };
  }
  const totais = extraidos.map((e) => e.efetivo_total).filter((n): n is number => typeof n === "number");
  return { efetivoTotal: totais.length > 0 ? Math.max(...totais) : null, equipes };
}

export function resumirDia(registros: RegistroDoDia[]): ResumoDia {
  const prontos = registros.filter((r) => r.status === "pronto");
  const extraidos = prontos.map((r) => r.extraido ?? {});

  const avancos = unicos(
    prontos.flatMap((r) => {
      const servicos = r.extraido?.servicos ?? [];
      if (servicos.length === 0) return r.texto_organizado ? [r.texto_organizado] : [];
      return servicos.map((s) => `${s.descricao} (${VERBO[s.resultado] ?? s.resultado})`);
    })
  );
  const materiaisFaltando = unicos(extraidos.flatMap((e) => e.materiais_faltando ?? []));

  return {
    prontos: prontos.length,
    pendentes: registros.filter((r) => r.status === "enviado" || r.status === "organizando").length,
    fechados: registros.filter((r) => r.rdo_id !== null).length,
    ...efetivoDoDia(extraidos),
    avancos,
    ocorrencias: unicos(extraidos.flatMap((e) => e.problemas ?? [])),
    pendencias: unicos(extraidos.flatMap((e) => e.pendencias ?? [])),
    materiaisFaltando,
  };
}

const lista = (itens: string[]) => itens.map((i) => `- ${i}`).join("\n");

/**
 * Rascunho do RDO a partir do resumo. Sem nada organizado ainda, devolve só a ligação dos
 * registros (o gestor preenche o dia à mão e os registros passam a apontar para o RDO).
 */
export function rascunhoDoRdo(data: string, registros: RegistroDoDia[]): RascunhoRdo {
  const resumo = resumirDia(registros);
  const registroIds = registros.map((r) => r.id);
  if (resumo.prontos === 0) return { data, registroIds, efetivoLinhas: [], impedimentoLinhas: [] };

  const ocorrencias = [...resumo.ocorrencias, ...resumo.materiaisFaltando.map((m) => `Faltou: ${m}`)];
  return {
    data,
    registroIds,
    campos: {
      atividades: lista(resumo.avancos),
      ocorrencias: lista(ocorrencias),
      pendencias: lista(resumo.pendencias),
      efetivo: resumo.efetivoTotal === null ? "" : String(resumo.efetivoTotal),
    },
    efetivoLinhas: resumo.equipes.map((e) => ({
      fornecedor_id: null,
      fornecedor_nome: e.nome,
      quantidade: e.quantidade,
    })),
    impedimentoLinhas: resumo.materiaisFaltando.map((descricao) => ({ descricao, tipo: "falta_material" as const })),
  };
}
