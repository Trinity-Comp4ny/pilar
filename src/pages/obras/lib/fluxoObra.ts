// Fluxo de obra: modelo de cronograma (fase > etapa > serviço > tarefa) com duração e prestador padrão.
// A empresa monta uma vez; ao aplicar, o fluxo vira um plano de importação com as datas em cascata.
import type { ItemImportado, PlanoImportacao, TarefaImportada } from "./importarCronograma";

interface FluxoServico {
  nome: string;
  duracao_dias: number;
  /** Prestador padrão (fornecedor). */
  fornecedor_id: string | null;
  /** Roda junto do serviço anterior, em vez de esperar ele acabar. */
  paralelo: boolean;
  tarefas: string[];
}
interface FluxoEtapa {
  nome: string;
  servicos: FluxoServico[];
}
interface FluxoFase {
  nome: string;
  etapas: FluxoEtapa[];
}
export type EstruturaFluxo = FluxoFase[];

/** Uma linha do editor: o serviço com o caminho dele. */
export interface LinhaFluxo {
  fase: string;
  etapa: string;
  servico: string;
  duracao_dias: number;
  fornecedor_id: string | null;
  paralelo: boolean;
  tarefas: string;
}

export const DURACAO_PADRAO_DIAS = 5;

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const lista = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Lê o JSON do banco com tolerância: o que não faz sentido é descartado, nunca quebra a tela. */
export function normalizarEstrutura(json: unknown): EstruturaFluxo {
  return lista(json)
    .map((f) => {
      const fase = f as Record<string, unknown>;
      return {
        nome: texto(fase.nome),
        etapas: lista(fase.etapas).map((e) => {
          const etapa = e as Record<string, unknown>;
          return {
            nome: texto(etapa.nome),
            servicos: lista(etapa.servicos).map((s) => {
              const sv = s as Record<string, unknown>;
              const dias = Math.round(Number(sv.duracao_dias));
              return {
                nome: texto(sv.nome),
                duracao_dias: Number.isFinite(dias) && dias > 0 ? dias : DURACAO_PADRAO_DIAS,
                fornecedor_id: typeof sv.fornecedor_id === "string" && sv.fornecedor_id ? sv.fornecedor_id : null,
                paralelo: sv.paralelo === true,
                tarefas: lista(sv.tarefas).map(texto).filter(Boolean),
              };
            }),
          };
        }),
      };
    })
    .filter((f) => f.nome);
}

export function achatarEstrutura(estrutura: EstruturaFluxo): LinhaFluxo[] {
  return estrutura.flatMap((f) =>
    f.etapas.flatMap((e) =>
      e.servicos.map((s) => ({
        fase: f.nome,
        etapa: e.nome,
        servico: s.nome,
        duracao_dias: s.duracao_dias,
        fornecedor_id: s.fornecedor_id,
        paralelo: s.paralelo,
        tarefas: s.tarefas.join("; "),
      }))
    )
  );
}

/** Junta linhas seguidas com a mesma fase e etapa. Linha sem fase, etapa ou serviço é ignorada. */
export function agruparLinhas(linhas: ReadonlyArray<LinhaFluxo>): EstruturaFluxo {
  const fases: EstruturaFluxo = [];
  for (const l of linhas) {
    const fase = l.fase.trim();
    const etapa = l.etapa.trim();
    const servico = l.servico.trim();
    if (!fase || !etapa || !servico) continue;
    let f = fases[fases.length - 1];
    if (!f || f.nome !== fase) {
      f = { nome: fase, etapas: [] };
      fases.push(f);
    }
    let e = f.etapas[f.etapas.length - 1];
    if (!e || e.nome !== etapa) {
      e = { nome: etapa, servicos: [] };
      f.etapas.push(e);
    }
    const dias = Math.round(Number(l.duracao_dias));
    e.servicos.push({
      nome: servico,
      duracao_dias: Number.isFinite(dias) && dias > 0 ? dias : DURACAO_PADRAO_DIAS,
      fornecedor_id: l.fornecedor_id,
      paralelo: l.paralelo,
      tarefas: l.tarefas
        .split(/[;\n]/)
        .map((t) => t.trim())
        .filter(Boolean),
    });
  }
  return fases;
}

const DIA_MS = 86_400_000;
const paraData = (iso: string) => new Date(`${iso}T00:00:00Z`);
const paraIso = (d: Date) => d.toISOString().slice(0, 10);
const somarDias = (iso: string, n: number) => paraIso(new Date(paraData(iso).getTime() + n * DIA_MS));
const diasEntre = (a: string, b: string) => Math.round((paraData(b).getTime() - paraData(a).getTime()) / DIA_MS);

/**
 * Datas em cascata (dias corridos): cada serviço começa quando o anterior termina, ou junto dele quando é
 * paralelo. Etapa e fase cobrem o período dos serviços. O resultado é o mesmo plano da importação de planilha.
 */
export function planoDoFluxo(estrutura: EstruturaFluxo, inicio: string): PlanoImportacao {
  const itens: ItemImportado[] = [];
  const tarefas: TarefaImportada[] = [];
  let cursor = inicio;
  let ultimoInicio = inicio;

  estrutura.forEach((fase, fi) => {
    const chaveFase = `|f${fi}`;
    const itemFase: ItemImportado = {
      chave: chaveFase,
      paiChave: null,
      nivel: "fase",
      nome: fase.nome,
      inicio: null,
      fim: null,
    };
    itens.push(itemFase);
    fase.etapas.forEach((etapa, ei) => {
      const chaveEtapa = `${chaveFase}|e${ei}`;
      const itemEtapa: ItemImportado = {
        chave: chaveEtapa,
        paiChave: chaveFase,
        nivel: "etapa",
        nome: etapa.nome,
        inicio: null,
        fim: null,
      };
      itens.push(itemEtapa);
      etapa.servicos.forEach((sv, si) => {
        const chaveServico = `${chaveEtapa}|s${si}`;
        const comeco = sv.paralelo ? ultimoInicio : cursor;
        const fim = somarDias(comeco, sv.duracao_dias - 1);
        ultimoInicio = comeco;
        if (somarDias(fim, 1) > cursor) cursor = somarDias(fim, 1);
        itens.push({
          chave: chaveServico,
          paiChave: chaveEtapa,
          nivel: "servico",
          nome: sv.nome,
          inicio: comeco,
          fim,
          fornecedorId: sv.fornecedor_id,
        });
        for (const t of sv.tarefas) tarefas.push({ titulo: t, servicoChave: chaveServico, inicio: comeco, prazo: fim });
        for (const alvo of [itemEtapa, itemFase]) {
          if (!alvo.inicio || comeco < alvo.inicio) alvo.inicio = comeco;
          if (!alvo.fim || fim > alvo.fim) alvo.fim = fim;
        }
      });
    });
  });

  return {
    itens,
    tarefas,
    avisos: [],
    erro: itens.some((i) => i.nivel === "servico") ? null : "O fluxo não tem nenhum serviço.",
  };
}

/** Quantos dias o plano ocupa, do primeiro início ao último fim. */
export function duracaoTotalDias(plano: PlanoImportacao): number {
  const ini = plano.itens
    .map((i) => i.inicio)
    .filter((v): v is string => !!v)
    .sort()[0];
  const fim = plano.itens
    .map((i) => i.fim)
    .filter((v): v is string => !!v)
    .sort()
    .reverse()[0];
  return ini && fim ? diasEntre(ini, fim) + 1 : 0;
}

interface NoDeObra {
  id: string;
  parent_id: string | null;
  nivel: string;
  nome: string;
  ordem: number;
  created_at: string;
  data_inicio: string | null;
  data_fim: string | null;
  fornecedor_id?: string | null;
}
interface TarefaDeObra {
  obra_frente_id: string | null;
  titulo: string;
  data_inicio: string | null;
  prazo: string | null;
  created_at: string;
}

/** Transforma o cronograma de uma obra em fluxo: a duração vem das datas e "paralelo" de quem começa antes de o anterior acabar. */
export function estruturaDeObra(nos: ReadonlyArray<NoDeObra>, tarefas: ReadonlyArray<TarefaDeObra>): EstruturaFluxo {
  const ordenar = <T extends { ordem: number; created_at: string }>(l: T[]) =>
    [...l].sort((a, b) => a.ordem - b.ordem || a.created_at.localeCompare(b.created_at));
  const filhos = (paiId: string | null, nivel: string) =>
    ordenar(nos.filter((n) => (n.parent_id ?? null) === paiId && n.nivel === nivel));
  let fimAnterior: string | null = null;

  return filhos(null, "fase").map((fase) => ({
    nome: fase.nome,
    etapas: filhos(fase.id, "etapa").map((etapa) => ({
      nome: etapa.nome,
      servicos: filhos(etapa.id, "servico").map((sv) => {
        const dele = tarefas
          .filter((t) => t.obra_frente_id === sv.id)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));
        const inicios = [sv.data_inicio, ...dele.map((t) => t.data_inicio)].filter((v): v is string => !!v).sort();
        const fins = [sv.data_fim, ...dele.map((t) => t.prazo)].filter((v): v is string => !!v).sort();
        const ini = inicios[0] ?? null;
        const fim = fins[fins.length - 1] ?? null;
        const dias = ini && fim ? Math.max(1, diasEntre(ini, fim) + 1) : DURACAO_PADRAO_DIAS;
        const paralelo = !!ini && !!fimAnterior && ini <= fimAnterior;
        if (fim && (!fimAnterior || fim > fimAnterior)) fimAnterior = fim;
        return {
          nome: sv.nome,
          duracao_dias: dias,
          fornecedor_id: sv.fornecedor_id ?? null,
          paralelo,
          tarefas: dele.map((t) => t.titulo),
        };
      }),
    })),
  }));
}
