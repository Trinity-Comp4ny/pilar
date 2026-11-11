import { addBusinessDays, formatDateLocal, isBusinessDay, nextBusinessDay, parseDateLocal } from "@/lib/businessDays";

/**
 * Projeção de datas e caminho crítico do fluxo de disciplinas (SPEC 162).
 *
 * Funções puras, sem React nem Supabase: recebem as disciplinas já com status e
 * datas gravadas e devolvem quando cada uma deve terminar de fato, a conclusão
 * estimada do fluxo e o caminho crítico. Nada aqui grava data: a previsão salva
 * continua sendo o compromisso, a projeção é só leitura na tela.
 */

export type StatusNoFluxo = "concluido" | "em_andamento" | "atrasado" | "nao_iniciado" | "pausado";

export interface NoFluxo {
  key: string;
  /** Posição/coluna no fluxo (`ordem`). Mesma coluna = paralelas. */
  coluna: number;
  status: StatusNoFluxo;
  /** Datas no formato yyyy-mm-dd. */
  dataInicio?: string;
  dataPrevisao?: string;
  dataFinal?: string;
  /** Dependências explícitas (fase 2). Ausente ou vazio = coluna anterior inteira. */
  dependeDe?: string[];
}

interface ProjecaoNo {
  key: string;
  inicioEstimado?: string;
  fimEstimado?: string;
  /** Dias úteis entre a previsão gravada e o fim estimado (0 quando não passa da previsão). */
  atrasoDiasUteis: number;
  critico: boolean;
}

export interface ProjecaoFluxo {
  porNo: Record<string, ProjecaoNo>;
  conclusaoEstimada?: string;
  /** Keys do caminho crítico, da primeira coluna à última. */
  caminhoCritico: string[];
  /** Disciplinas sem previsão gravada: ficam fora da projeção. */
  semData: number;
}

/** Dias úteis no intervalo (de, ate]: quantos `addBusinessDays` levam de `de` até `ate`. */
export function diasUteisEntre(de: string, ate: string): number {
  const inicio = parseDateLocal(de);
  const fim = parseDateLocal(ate);
  if (fim <= inicio) return 0;
  let total = 0;
  const atual = new Date(inicio);
  while (atual < fim) {
    atual.setDate(atual.getDate() + 1);
    if (isBusinessDay(atual)) total++;
  }
  return total;
}

function maiorData(a: string | undefined, b: string | undefined): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

/** Dependências efetivas: as explícitas, ou toda a coluna anterior existente. */
export function resolverDependencias(nos: NoFluxo[]): Record<string, string[]> {
  const keys = new Set(nos.map((n) => n.key));
  const colunas = Array.from(new Set(nos.map((n) => n.coluna))).sort((a, b) => a - b);
  const porColuna = new Map<number, string[]>();
  for (const n of nos) {
    porColuna.set(n.coluna, [...(porColuna.get(n.coluna) ?? []), n.key]);
  }

  const deps: Record<string, string[]> = {};
  for (const n of nos) {
    const explicitas = (n.dependeDe ?? []).filter((k) => keys.has(k) && k !== n.key);
    if (explicitas.length > 0) {
      deps[n.key] = explicitas;
      continue;
    }
    const idx = colunas.indexOf(n.coluna);
    deps[n.key] = idx > 0 ? (porColuna.get(colunas[idx - 1]) ?? []) : [];
  }
  return deps;
}

/** Dependentes diretos (o inverso de `resolverDependencias`). */
export function resolverDependentes(deps: Record<string, string[]>): Record<string, string[]> {
  const inverso: Record<string, string[]> = {};
  for (const key of Object.keys(deps)) inverso[key] ??= [];
  for (const [key, lista] of Object.entries(deps)) {
    for (const dep of lista) (inverso[dep] ??= []).push(key);
  }
  return inverso;
}

export function projetarFluxo(nos: NoFluxo[], hoje: string): ProjecaoFluxo {
  const deps = resolverDependencias(nos);
  const porKey = new Map(nos.map((n) => [n.key, n]));
  const resultado: Record<string, ProjecaoNo & { determinante?: string }> = {};
  const visitando = new Set<string>();

  const calcular = (key: string): (ProjecaoNo & { determinante?: string }) | undefined => {
    if (resultado[key]) return resultado[key];
    const no = porKey.get(key);
    // Ciclo (só possível com dependência explícita malformada): corta em vez de estourar a pilha.
    if (!no || visitando.has(key)) return undefined;
    visitando.add(key);

    let fimDeps: string | undefined;
    let determinante: string | undefined;
    for (const dep of deps[key]) {
      const fimDep = calcular(dep)?.fimEstimado;
      if (fimDep && (!fimDeps || fimDep > fimDeps)) {
        fimDeps = fimDep;
        determinante = dep;
      }
    }

    let inicio = no.dataInicio;
    let fim: string | undefined;

    if (no.status === "concluido") {
      fim = no.dataFinal ?? no.dataPrevisao;
    } else if (!no.dataPrevisao || no.status === "pausado") {
      // Sem previsão não há o que projetar; pausada tem o prazo congelado (spec 141).
      fim = no.dataPrevisao;
    } else {
      fim = no.dataPrevisao;
      // Só quem ainda não começou é empurrado pelas dependências: quem já está
      // rodando começou de fato, mesmo que a dependência tenha atrasado.
      if (no.status === "nao_iniciado" && fimDeps && no.dataInicio) {
        const inicioPossivel = formatDateLocal(nextBusinessDay(addBusinessDays(parseDateLocal(fimDeps), 1)));
        if (inicioPossivel > no.dataInicio) {
          const duracao = diasUteisEntre(no.dataInicio, no.dataPrevisao);
          inicio = inicioPossivel;
          fim = maiorData(fim, formatDateLocal(addBusinessDays(parseDateLocal(inicioPossivel), duracao)));
        }
      }
      // Atrasada nunca termina no passado: o mínimo honesto é hoje.
      if (fim && fim < hoje) fim = hoje;
    }

    const atraso =
      no.status !== "concluido" && no.dataPrevisao && fim && fim > no.dataPrevisao
        ? diasUteisEntre(no.dataPrevisao, fim)
        : 0;

    visitando.delete(key);
    resultado[key] = {
      key,
      inicioEstimado: inicio,
      fimEstimado: fim,
      atrasoDiasUteis: atraso,
      critico: false,
      determinante: no.dataPrevisao || no.dataFinal ? determinante : undefined,
    };
    return resultado[key];
  };

  for (const n of nos) calcular(n.key);

  // Caminho crítico: do maior fim estimado (empate: coluna mais à direita), voltando
  // pela dependência que terminou por último.
  let fimDoFluxo: ProjecaoNo | undefined;
  for (const n of nos) {
    const p = resultado[n.key];
    if (!p?.fimEstimado) continue;
    const atualColuna = fimDoFluxo ? porKey.get(fimDoFluxo.key)!.coluna : -Infinity;
    if (
      !fimDoFluxo ||
      p.fimEstimado > fimDoFluxo.fimEstimado! ||
      (p.fimEstimado === fimDoFluxo.fimEstimado && n.coluna > atualColuna)
    ) {
      fimDoFluxo = p;
    }
  }

  const caminho: string[] = [];
  let cursor: string | undefined = fimDoFluxo?.key;
  while (cursor && !caminho.includes(cursor)) {
    caminho.unshift(cursor);
    resultado[cursor].critico = true;
    cursor = resultado[cursor].determinante;
  }

  const porNo: Record<string, ProjecaoNo> = {};
  for (const [key, { determinante: _determinante, ...p }] of Object.entries(resultado)) porNo[key] = p;

  return {
    porNo,
    conclusaoEstimada: fimDoFluxo?.fimEstimado,
    caminhoCritico: caminho,
    semData: nos.filter((n) => n.status !== "concluido" && !n.dataPrevisao).length,
  };
}
