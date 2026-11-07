import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Agente, N } from "./schemas.ts";

// ---------------------------------------------------------------------------
// Agentes de domínio (read-only) — coletam dados via RLS
// ---------------------------------------------------------------------------
// A função roda em UTC; o escritório vive no horário de Brasília. Depois das 21h
// o dia UTC já virou e o que vence hoje apareceria como vencido.
const FUSO = "America/Sao_Paulo";

/** Data de hoje (YYYY-MM-DD) no horário de Brasília. */
export function hojeBrasilia(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    agora
  );
}

export function inicioDoMes(agora: Date = new Date()): string {
  return `${hojeBrasilia(agora).slice(0, 7)}-01`;
}

export async function coletarFinanceiro(db: SupabaseClient, empresaId: string): Promise<Record<string, unknown>> {
  const inicio = inicioDoMes();
  const hoje = hojeBrasilia();
  const [receitasMes, aReceber, despesasMes, aPagar, receitasVencidas, despesasVencidas, folhaMes] = await Promise.all([
    db
      .from("receitas")
      .select("valor")
      .eq("empresa_id", empresaId)
      .eq("status", "Recebido")
      .gte("data_recebimento", inicio),
    db.from("receitas").select("valor").eq("empresa_id", empresaId).eq("status", "Pendente"),
    db
      .from("despesas")
      .select("valor")
      .eq("empresa_id", empresaId)
      .in("status", ["Pago"])
      .eq("is_fatura_payment", false)
      .gte("data_pagamento", inicio),
    db
      .from("despesas")
      .select("valor")
      .eq("empresa_id", empresaId)
      .eq("status", "Pendente")
      .eq("is_fatura_payment", false),
    // Vencidos = pendentes com vencimento antes de hoje (o que o sócio mais quer ver).
    db
      .from("receitas")
      .select("valor")
      .eq("empresa_id", empresaId)
      .eq("status", "Pendente")
      .lt("data_vencimento", hoje),
    db
      .from("despesas")
      .select("valor")
      .eq("empresa_id", empresaId)
      .eq("status", "Pendente")
      .eq("is_fatura_payment", false)
      .lt("data_vencimento", hoje),
    db
      .from("folha_pagamento")
      .select("total_receber")
      .eq("empresa_id", empresaId)
      .eq("mes", Number(hojeBrasilia().slice(5, 7)))
      .eq("ano", Number(hojeBrasilia().slice(0, 4))),
  ]);
  const soma = (rows: { valor: number }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.valor || 0), 0);
  const custoFolha = ((folhaMes.data as { total_receber: number }[] | null) ?? []).reduce(
    (s, r) => s + Number(r.total_receber || 0),
    0
  );
  const recebido = soma(receitasMes.data as { valor: number }[] | null);
  const despesas = soma(despesasMes.data as { valor: number }[] | null);
  return {
    hoje,
    mes_atual: {
      recebido_no_mes: recebido,
      despesas_pagas_no_mes: despesas,
      saldo_no_mes: recebido - despesas,
    },
    a_receber_pendente_total: soma(aReceber.data as { valor: number }[] | null),
    a_pagar_pendente_total: soma(aPagar.data as { valor: number }[] | null),
    a_receber_vencido_total: soma(receitasVencidas.data as { valor: number }[] | null),
    a_pagar_vencido_total: soma(despesasVencidas.data as { valor: number }[] | null),
    custo_folha_mes_atual: custoFolha,
  };
}

export const STATUS_ATIVOS = ["Planejamento", "Execução", "Em andamento", "Revisão"];

export type ProjetoRow = {
  nome: string;
  status: string;
  prioridade: string | null;
  valor_contrato: number | null;
  pode_ver_valor: boolean | null;
  data_inicio: string | null;
  data_previsao: string | null;
  data_final: string | null;
  cliente_id: string | null;
};

/**
 * Projetos da empresa pela view projetos_safe: `valor_contrato` na tabela base tem SELECT
 * revogado (ADR 0034), e ler a coluna direto derruba a consulta inteira, o que aqui virava
 * "0 projetos" sem aviso. Quem não pode ver dinheiro recebe o projeto sem o valor.
 */
export async function coletarProjetos(db: SupabaseClient, empresaId: string): Promise<Record<string, unknown>> {
  const hoje = hojeBrasilia();
  const { data, error } = await db
    .from("projetos_safe")
    .select(
      "nome, status, prioridade, valor_contrato, pode_ver_valor, data_inicio, data_previsao, data_final, cliente_id"
    )
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);
  if (error) throw new Error(`falha ao ler projetos: ${error.message}`);
  const projetos = (data ?? []) as unknown as ProjetoRow[];

  const clienteIds = [...new Set(projetos.map((p) => p.cliente_id).filter((id): id is string => !!id))];
  const nomeCliente = new Map<string, string>();
  if (clienteIds.length > 0) {
    const { data: clientes } = await db.from("clientes").select("id, nome").in("id", clienteIds);
    for (const c of (clientes ?? []) as { id: string; nome: string }[]) nomeCliente.set(c.id, c.nome);
  }

  const porStatus: Record<string, number> = {};
  for (const p of projetos) porStatus[p.status] = (porStatus[p.status] ?? 0) + 1;
  const ativos = projetos.filter((p) => STATUS_ATIVOS.includes(p.status));
  const veValor = projetos.some((p) => p.pode_ver_valor === true);
  const detalhe = (p: ProjetoRow) => ({
    nome: p.nome,
    status: p.status,
    prioridade: p.prioridade,
    cliente: p.cliente_id ? (nomeCliente.get(p.cliente_id) ?? null) : null,
    ...(p.pode_ver_valor ? { valor_contrato: Number(p.valor_contrato || 0) } : {}),
    data_inicio: p.data_inicio,
    data_previsao_entrega: p.data_previsao,
    data_conclusao: p.data_final,
    // Atrasado = tinha previsão, ainda não concluiu e a previsão já passou.
    atrasado: !!p.data_previsao && !p.data_final && p.data_previsao < hoje,
  });
  const ativosDetalhe = ativos.map(detalhe);
  return {
    hoje,
    total_projetos: projetos.length,
    projetos_ativos: ativos.length,
    por_status: porStatus,
    ...(veValor
      ? { valor_em_contratos_ativos: ativos.reduce((s, p) => s + Number(p.valor_contrato || 0), 0) }
      : { valores_ocultos: "O perfil de quem pergunta não vê valores de contrato." }),
    projetos_com_prazo_estourado: ativosDetalhe.filter((p) => p.atrasado).length,
    // Lista dos ativos com datas/prazos (limite p/ caber no contexto do modelo).
    projetos_ativos_detalhe: ativosDetalhe.slice(0, 30),
  };
}

export type ClienteRow = {
  nome: string;
  email: string | null;
  contato: string | null;
  tipo_pessoa: string | null;
  origem: string | null;
};

export async function coletarComercial(db: SupabaseClient, empresaId: string): Promise<Record<string, unknown>> {
  const [propostas, leads, clientes] = await Promise.all([
    db.from("propostas").select("status").eq("empresa_id", empresaId).is("deleted_at", null),
    db.from("leads").select("status").eq("empresa_id", empresaId).is("deleted_at", null),
    db
      .from("clientes")
      .select("nome, email, contato, tipo_pessoa, origem")
      .eq("empresa_id", empresaId)
      .is("deleted_at", null),
  ]);
  const props = (propostas.data ?? []) as { status: string }[];
  const propPorStatus: Record<string, number> = {};
  for (const p of props) propPorStatus[p.status] = (propPorStatus[p.status] ?? 0) + 1;
  const lds = (leads.data ?? []) as { status: string }[];
  const leadsPorStatus: Record<string, number> = {};
  for (const l of lds) leadsPorStatus[l.status] = (leadsPorStatus[l.status] ?? 0) + 1;
  const cls = (clientes.data ?? []) as ClienteRow[];
  return {
    total_propostas: props.length,
    propostas_por_status: propPorStatus,
    total_leads: lds.length,
    leads_por_status: leadsPorStatus,
    total_clientes: cls.length,
    // Lista de clientes (limite p/ caber no contexto do modelo).
    clientes: cls.slice(0, 50).map((c) => ({
      nome: c.nome,
      email: c.email,
      contato: c.contato,
      tipo: c.tipo_pessoa,
      origem: c.origem,
    })),
  };
}

export type PessoaRow = { nome: string; cargo: string | null; tipo_contrato: string | null; status: string | null };

export async function coletarEquipe(db: SupabaseClient, empresaId: string): Promise<Record<string, unknown>> {
  const { data } = await db
    .from("pessoas")
    .select("nome, cargo, tipo_contrato, status")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null);
  const pessoas = (data ?? []) as PessoaRow[];
  return {
    total_pessoas: pessoas.length,
    equipe: pessoas
      .slice(0, 50)
      .map((p) => ({ nome: p.nome, cargo: p.cargo, contrato: p.tipo_contrato, status: p.status })),
  };
}

export type ObraRow = {
  id: string;
  nome: string;
  status: string;
  data_fim_prevista: string | null;
  data_fim_real: string | null;
  projetos: { nome: string } | null;
};

export type ObraRdoRow = {
  obra_id: string;
  data: string;
  clima: string | null;
  condicao_trabalho: string | null;
  efetivo: number | null;
  ocorrencias: string | null;
};

/** Obras ativas da empresa + o RDO mais recente de cada uma (cap 30 pra caber no contexto). */
export async function coletarObras(db: SupabaseClient, empresaId: string): Promise<Record<string, unknown>> {
  const hoje = hojeBrasilia();
  const { data } = await db
    .from("obras")
    .select("id, nome, status, data_fim_prevista, data_fim_real, projetos(nome)")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(30);
  const obras = (data ?? []) as unknown as ObraRow[];

  const porStatus: Record<string, number> = {};
  for (const o of obras) porStatus[o.status] = (porStatus[o.status] ?? 0) + 1;
  const atrasada = (o: ObraRow) => !!o.data_fim_prevista && !o.data_fim_real && o.data_fim_prevista < hoje;

  // Um RDO por obra (o mais recente): busca todos de uma vez (evita N+1) e fica só com o 1º de
  // cada, já que a query vem ordenada por data desc.
  const ids = obras.map((o) => o.id);
  const rdoPorObra = new Map<string, ObraRdoRow>();
  if (ids.length > 0) {
    const { data: rdos } = await db
      .from("obra_rdo")
      .select("obra_id, data, clima, condicao_trabalho, efetivo, ocorrencias")
      .in("obra_id", ids)
      .order("data", { ascending: false });
    for (const r of (rdos ?? []) as ObraRdoRow[]) {
      if (!rdoPorObra.has(r.obra_id)) rdoPorObra.set(r.obra_id, r);
    }
  }

  return {
    hoje,
    total_obras: obras.length,
    por_status: porStatus,
    obras_atrasadas: obras.filter(atrasada).length,
    obras_detalhe: obras.map((o) => {
      const rdo = rdoPorObra.get(o.id);
      return {
        nome: o.nome,
        projeto: o.projetos?.nome ?? null,
        status: o.status,
        atrasada: atrasada(o),
        ultimo_rdo: rdo
          ? {
              data: rdo.data,
              clima: rdo.clima,
              condicao_trabalho: rdo.condicao_trabalho,
              efetivo: rdo.efetivo,
              ocorrencias: rdo.ocorrencias,
            }
          : null,
      };
    }),
  };
}

export async function coletarDados(
  agente: Agente,
  db: SupabaseClient,
  empresaId: string
): Promise<Record<string, unknown>> {
  switch (agente) {
    case "financeiro":
      return coletarFinanceiro(db, empresaId);
    case "projetos":
      return coletarProjetos(db, empresaId);
    case "comercial":
      return coletarComercial(db, empresaId);
    case "obras":
      return coletarObras(db, empresaId);
    case "equipe":
      return coletarEquipe(db, empresaId);
    case "geral": {
      // Pergunta genérica: dá ao agente uma visão dos domínios de uma vez.
      const [financeiro, projetos, comercial, obras, equipe] = await Promise.all([
        coletarFinanceiro(db, empresaId),
        coletarProjetos(db, empresaId),
        coletarComercial(db, empresaId),
        coletarObras(db, empresaId),
        coletarEquipe(db, empresaId),
      ]);
      return { financeiro, projetos, comercial, obras, equipe };
    }
  }
}
