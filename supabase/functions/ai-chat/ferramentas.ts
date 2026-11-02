// Ferramentas de consulta do chat (SPEC 147). Cada uma lê um recorte específico via RLS do
// usuário (nunca service_role) e devolve linhas reais, com id e link, para o agente responder
// "qual parcela vence essa semana?" com a parcela, não com o total.
//
// Regras:
//  - só leitura: escrita continua no fluxo de ação/operação, com card de confirmação;
//  - argumento validado por schema antes de tocar o banco; erro volta como observação, para o
//    planejador corrigir, e não derruba a conversa;
//  - no máximo LIMITE_LINHAS por chamada, com o total informado, para caber no contexto.

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "../_shared/schemas.ts";
import { coletarDados, STATUS_ATIVOS } from "./coleta.ts";

export const LIMITE_LINHAS = 25;

export type ContextoFerramenta = { db: SupabaseClient; empresaId: string };

export interface Ferramenta {
  nome: string;
  /** Texto que o planejador lê para escolher a ferramenta. */
  descricao: string;
  args: z.ZodTypeAny;
  executar: (ctx: ContextoFerramenta, args: Record<string, unknown>) => Promise<unknown>;
}

type Linhas = { total: number; mostrando: number; linhas: Record<string, unknown>[] };

/** Data de hoje no fuso de Brasília (o servidor roda em UTC e viraria o dia às 21h). */
export function hojeBR(agora = new Date()): string {
  return new Date(agora.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);
}

function pagina(linhas: Record<string, unknown>[], total: number | null): Linhas {
  return { total: total ?? linhas.length, mostrando: linhas.length, linhas };
}

/** Escapa curinga de ILIKE para a busca do usuário valer literal. */
function termoBusca(busca: string): string {
  return `%${busca.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

async function idsProjetosPorNome(db: SupabaseClient, empresaId: string, busca: string): Promise<string[]> {
  const { data, error } = await db
    .from("projetos_safe")
    .select("id")
    .eq("empresa_id", empresaId)
    .is("deleted_at", null)
    .ilike("nome", termoBusca(busca))
    .limit(20);
  if (error) throw new Error(`falha ao buscar projeto: ${error.message}`);
  return (data ?? []).map((p) => (p as { id: string }).id);
}

function nomeEmbutido(rel: unknown): string | null {
  const alvo = Array.isArray(rel) ? rel[0] : rel;
  if (alvo && typeof alvo === "object" && "nome" in alvo && typeof (alvo as { nome: unknown }).nome === "string") {
    return (alvo as { nome: string }).nome;
  }
  return null;
}

const busca = z.string().trim().min(2).max(80);

// ---------------------------------------------------------------------------
// Financeiro
// ---------------------------------------------------------------------------
const ArgsRecebimentos = z.object({
  situacao: z.enum(["atrasados", "a_vencer", "recebidos"]),
  dias: z.number().int().min(1).max(90).default(7),
  projeto: busca.optional(),
});

async function listarRecebimentos(ctx: ContextoFerramenta, raw: Record<string, unknown>): Promise<Linhas> {
  const a = ArgsRecebimentos.parse(raw);
  const hoje = hojeBR();
  let q = ctx.db
    .from("receitas")
    .select(
      "id, descricao, valor, status, data_vencimento, data_recebimento, parcela_numero, parcela_total, projeto_id, projetos(nome), clientes(nome)",
      { count: "exact" }
    )
    .eq("empresa_id", ctx.empresaId)
    .is("deleted_at", null);

  if (a.projeto) {
    const ids = await idsProjetosPorNome(ctx.db, ctx.empresaId, a.projeto);
    if (ids.length === 0) return pagina([], 0);
    q = q.in("projeto_id", ids);
  }
  if (a.situacao === "atrasados") {
    q = q
      .in("status", ["Pendente", "Atrasado"])
      .lt("data_vencimento", hoje)
      .order("data_vencimento", { ascending: true });
  } else if (a.situacao === "a_vencer") {
    q = q
      .eq("status", "Pendente")
      .gte("data_vencimento", hoje)
      .lte("data_vencimento", somarDias(hoje, a.dias))
      .order("data_vencimento", { ascending: true });
  } else {
    q = q
      .eq("status", "Recebido")
      .gte("data_recebimento", somarDias(hoje, -a.dias))
      .order("data_recebimento", { ascending: false });
  }

  const { data, count, error } = await q.limit(LIMITE_LINHAS);
  if (error) throw new Error(`falha ao ler recebimentos: ${error.message}`);
  const linhas = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const venc = row.data_vencimento as string | null;
    return {
      id: row.id,
      descricao: row.descricao,
      valor: Number(row.valor),
      status: row.status,
      vencimento: venc,
      recebido_em: row.data_recebimento,
      dias: venc ? diasEntre(hoje, venc) : null, // negativo = atrasado
      parcela: row.parcela_total ? `${row.parcela_numero}/${row.parcela_total}` : null,
      projeto: nomeEmbutido(row.projetos),
      cliente: nomeEmbutido(row.clientes),
      link: row.projeto_id ? `/projetos/${row.projeto_id}` : "/gestao/financeiro",
    };
  });
  return pagina(linhas, count);
}

const ArgsPagamentos = z.object({
  situacao: z.enum(["atrasados", "a_vencer", "pagos"]),
  dias: z.number().int().min(1).max(90).default(7),
  projeto: busca.optional(),
});

async function listarPagamentos(ctx: ContextoFerramenta, raw: Record<string, unknown>): Promise<Linhas> {
  const a = ArgsPagamentos.parse(raw);
  const hoje = hojeBR();
  let q = ctx.db
    .from("despesas")
    .select(
      "id, descricao, valor, status, data_vencimento, data_pagamento, parcela_numero, parcela_total, projeto_id, projetos(nome), fornecedores(nome)",
      { count: "exact" }
    )
    .eq("empresa_id", ctx.empresaId)
    .is("deleted_at", null)
    .eq("is_fatura_payment", false);

  if (a.projeto) {
    const ids = await idsProjetosPorNome(ctx.db, ctx.empresaId, a.projeto);
    if (ids.length === 0) return pagina([], 0);
    q = q.in("projeto_id", ids);
  }
  if (a.situacao === "atrasados") {
    q = q
      .in("status", ["Pendente", "Atrasado"])
      .lt("data_vencimento", hoje)
      .order("data_vencimento", { ascending: true });
  } else if (a.situacao === "a_vencer") {
    q = q
      .eq("status", "Pendente")
      .gte("data_vencimento", hoje)
      .lte("data_vencimento", somarDias(hoje, a.dias))
      .order("data_vencimento", { ascending: true });
  } else {
    q = q
      .eq("status", "Pago")
      .gte("data_pagamento", somarDias(hoje, -a.dias))
      .order("data_pagamento", { ascending: false });
  }

  const { data, count, error } = await q.limit(LIMITE_LINHAS);
  if (error) throw new Error(`falha ao ler pagamentos: ${error.message}`);
  const linhas = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const venc = row.data_vencimento as string | null;
    return {
      id: row.id,
      descricao: row.descricao,
      valor: Number(row.valor),
      status: row.status,
      vencimento: venc,
      pago_em: row.data_pagamento,
      dias: venc ? diasEntre(hoje, venc) : null,
      parcela: row.parcela_total ? `${row.parcela_numero}/${row.parcela_total}` : null,
      projeto: nomeEmbutido(row.projetos),
      fornecedor: nomeEmbutido(row.fornecedores),
      link: row.projeto_id ? `/projetos/${row.projeto_id}` : "/gestao/financeiro",
    };
  });
  return pagina(linhas, count);
}

// ---------------------------------------------------------------------------
// Projetos
// ---------------------------------------------------------------------------
const ArgsProjetos = z.object({
  situacao: z.enum(["atrasados", "prazo_proximo", "ativos", "concluidos"]),
  dias: z.number().int().min(1).max(90).default(14),
  busca: busca.optional(),
});

async function listarProjetos(ctx: ContextoFerramenta, raw: Record<string, unknown>): Promise<Linhas> {
  const a = ArgsProjetos.parse(raw);
  const hoje = hojeBR();
  let q = ctx.db
    .from("projetos_safe")
    .select(
      "id, nome, status, prioridade, data_inicio, data_previsao, data_final, valor_contrato, pode_ver_valor, cliente_id",
      {
        count: "exact",
      }
    )
    .eq("empresa_id", ctx.empresaId)
    .is("deleted_at", null);

  if (a.busca) q = q.ilike("nome", termoBusca(a.busca));
  if (a.situacao === "concluidos") {
    q = q.eq("status", "Concluído").order("data_final", { ascending: false });
  } else {
    q = q.in("status", STATUS_ATIVOS).is("data_final", null);
    if (a.situacao === "atrasados") q = q.lt("data_previsao", hoje).order("data_previsao", { ascending: true });
    else if (a.situacao === "prazo_proximo") {
      q = q
        .gte("data_previsao", hoje)
        .lte("data_previsao", somarDias(hoje, a.dias))
        .order("data_previsao", { ascending: true });
    } else q = q.order("data_previsao", { ascending: true, nullsFirst: false });
  }

  const { data, count, error } = await q.limit(LIMITE_LINHAS);
  if (error) throw new Error(`falha ao ler projetos: ${error.message}`);
  const linhas = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const prev = row.data_previsao as string | null;
    return {
      id: row.id,
      nome: row.nome,
      status: row.status,
      prioridade: row.prioridade,
      previsao_entrega: prev,
      dias_para_entrega: prev ? diasEntre(hoje, prev) : null, // negativo = atrasado
      ...(row.pode_ver_valor ? { valor_contrato: Number(row.valor_contrato || 0) } : {}),
      link: `/projetos/${row.id}`,
    };
  });
  return pagina(linhas, count);
}

const ArgsDetalheProjeto = z.object({ busca });

async function detalharProjeto(ctx: ContextoFerramenta, raw: Record<string, unknown>): Promise<unknown> {
  const a = ArgsDetalheProjeto.parse(raw);
  const { data: achados, error } = await ctx.db
    .from("projetos_safe")
    .select("id, nome, status, prioridade, data_inicio, data_previsao, data_final, valor_contrato, pode_ver_valor")
    .eq("empresa_id", ctx.empresaId)
    .is("deleted_at", null)
    .ilike("nome", termoBusca(a.busca))
    .limit(5);
  if (error) throw new Error(`falha ao buscar projeto: ${error.message}`);
  const candidatos = (achados ?? []) as Record<string, unknown>[];
  if (candidatos.length === 0) return { encontrado: false, aviso: "Nenhum projeto com esse nome." };
  if (candidatos.length > 1) {
    return {
      encontrado: false,
      aviso: "Mais de um projeto combina. Peça ao usuário para escolher.",
      candidatos: candidatos.map((p) => ({ id: p.id, nome: p.nome, status: p.status })),
    };
  }
  const p = candidatos[0];
  const projetoId = p.id as string;
  const hoje = hojeBR();

  const [disciplinas, marcos, parcelas, pendencias] = await Promise.all([
    ctx.db
      .from("projeto_disciplinas")
      .select("nome, status, data_inicio, data_fim, data_fim_real")
      .eq("projeto_id", projetoId)
      .order("data_fim", { ascending: true, nullsFirst: false })
      .limit(LIMITE_LINHAS),
    ctx.db
      .from("marcos_faturamento")
      .select("nome, valor, data_prevista, data_faturada, status")
      .eq("projeto_id", projetoId)
      .is("deleted_at", null)
      .order("data_prevista", { ascending: true })
      .limit(LIMITE_LINHAS),
    ctx.db
      .from("receitas")
      .select("descricao, valor, status, data_vencimento, parcela_numero, parcela_total")
      .eq("projeto_id", projetoId)
      .is("deleted_at", null)
      .in("status", ["Pendente", "Atrasado"])
      .order("data_vencimento", { ascending: true })
      .limit(LIMITE_LINHAS),
    ctx.db
      .from("agente_pendencias")
      .select("tipo, severidade, titulo, detalhe, vence_em")
      .eq("projeto_id", projetoId)
      .eq("status", "aberta")
      .limit(LIMITE_LINHAS),
  ]);

  const prev = p.data_previsao as string | null;
  return {
    encontrado: true,
    projeto: {
      id: projetoId,
      nome: p.nome,
      status: p.status,
      prioridade: p.prioridade,
      inicio: p.data_inicio,
      previsao_entrega: prev,
      dias_para_entrega: prev && !p.data_final ? diasEntre(hoje, prev) : null,
      concluido_em: p.data_final,
      ...(p.pode_ver_valor ? { valor_contrato: Number(p.valor_contrato || 0) } : {}),
      link: `/projetos/${projetoId}`,
    },
    disciplinas: disciplinas.data ?? [],
    // Marcos e parcelas só voltam para quem pode ver dinheiro (RLS devolve vazio para os demais).
    marcos_de_faturamento: marcos.data ?? [],
    parcelas_em_aberto: (parcelas.data ?? []).map((r) => {
      const row = r as Record<string, unknown>;
      return { ...row, valor: Number(row.valor) };
    }),
    pendencias_abertas: pendencias.data ?? [],
  };
}

// ---------------------------------------------------------------------------
// Obras
// ---------------------------------------------------------------------------
const ArgsTarefasObra = z.object({
  situacao: z.enum(["atrasadas", "vencendo", "abertas"]),
  dias: z.number().int().min(1).max(30).default(3),
  obra: busca.optional(),
});

async function listarTarefasObra(ctx: ContextoFerramenta, raw: Record<string, unknown>): Promise<Linhas> {
  const a = ArgsTarefasObra.parse(raw);
  const hoje = hojeBR();
  let q = ctx.db
    .from("tarefas")
    .select("id, titulo, status, prazo, prioridade, obra_id, obras!inner(nome)", { count: "exact" })
    .eq("empresa_id", ctx.empresaId)
    .not("obra_id", "is", null)
    .is("obras.deleted_at", null)
    .neq("status", "concluida");

  if (a.obra) q = q.ilike("obras.nome", termoBusca(a.obra));
  if (a.situacao === "atrasadas") q = q.lt("prazo", hoje);
  else if (a.situacao === "vencendo") q = q.gte("prazo", hoje).lte("prazo", somarDias(hoje, a.dias));
  q = q.order("prazo", { ascending: true, nullsFirst: false });

  const { data, count, error } = await q.limit(LIMITE_LINHAS);
  if (error) throw new Error(`falha ao ler tarefas da obra: ${error.message}`);
  const linhas = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const prazo = row.prazo as string | null;
    return {
      id: row.id,
      titulo: row.titulo,
      status: row.status,
      prioridade: row.prioridade,
      prazo,
      dias: prazo ? diasEntre(hoje, prazo) : null, // negativo = atrasada
      obra: nomeEmbutido(row.obras),
      link: `/obras/${row.obra_id}`,
    };
  });
  return pagina(linhas, count);
}

// ---------------------------------------------------------------------------
// Comercial
// ---------------------------------------------------------------------------
const ArgsLeads = z.object({
  situacao: z.enum(["abertos", "previsao_vencida"]),
  busca: busca.optional(),
});

async function listarLeads(ctx: ContextoFerramenta, raw: Record<string, unknown>): Promise<Linhas> {
  const a = ArgsLeads.parse(raw);
  const hoje = hojeBR();
  // valor_estimado tem SELECT fechado para leitura direta: fica de fora.
  let q = ctx.db
    .from("leads")
    .select("id, nome, empresa_lead, status, previsao_fechamento, created_at", { count: "exact" })
    .eq("empresa_id", ctx.empresaId)
    .is("deleted_at", null)
    .not("status", "in", "(Ganho,Perdido)");

  if (a.busca) q = q.ilike("nome", termoBusca(a.busca));
  if (a.situacao === "previsao_vencida") q = q.lt("previsao_fechamento", hoje);
  q = q.order("previsao_fechamento", { ascending: true, nullsFirst: false });

  const { data, count, error } = await q.limit(LIMITE_LINHAS);
  if (error) throw new Error(`falha ao ler leads: ${error.message}`);
  const linhas = (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const prev = row.previsao_fechamento as string | null;
    return {
      id: row.id,
      nome: row.nome,
      empresa: row.empresa_lead,
      status: row.status,
      previsao_fechamento: prev,
      dias: prev ? diasEntre(hoje, prev.slice(0, 10)) : null,
      link: "/gestao/leads",
    };
  });
  return pagina(linhas, count);
}

// ---------------------------------------------------------------------------
// Pendências do agente de acompanhamento (SPEC 146)
// ---------------------------------------------------------------------------
const AREAS = ["financeiro", "prazos", "orcamento", "obra", "planejamento", "comercial"] as const;
const ArgsPendencias = z.object({
  area: z.enum(AREAS).optional(),
  somente_urgentes: z.boolean().default(false),
});

const PESO_SEVERIDADE: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

async function listarPendencias(ctx: ContextoFerramenta, raw: Record<string, unknown>): Promise<unknown> {
  const a = ArgsPendencias.parse(raw);
  // Atualiza a fila da empresa se está velha (a função pula se rodou nos últimos 5 minutos).
  const { error: erroAtualizar } = await ctx.db.rpc("agente_pendencias_atualizar");
  if (erroAtualizar) throw new Error(`falha ao atualizar pendências: ${erroAtualizar.message}`);

  let q = ctx.db
    .from("agente_pendencias")
    .select("id, tipo, area, severidade, titulo, detalhe, dados, link, acao_sugerida, vence_em, primeira_deteccao", {
      count: "exact",
    })
    .eq("empresa_id", ctx.empresaId)
    .eq("status", "aberta");
  if (a.area) q = q.eq("area", a.area);
  if (a.somente_urgentes) q = q.in("severidade", ["critical", "high"]);

  const { data, count, error } = await q.limit(200);
  if (error) throw new Error(`falha ao ler pendências: ${error.message}`);
  const hoje = hojeBR();
  const ordenadas = ((data ?? []) as Record<string, unknown>[]).sort(
    (x, y) =>
      (PESO_SEVERIDADE[x.severidade as string] ?? 9) - (PESO_SEVERIDADE[y.severidade as string] ?? 9) ||
      String(x.primeira_deteccao).localeCompare(String(y.primeira_deteccao))
  );
  const porArea: Record<string, number> = {};
  for (const p of ordenadas) porArea[p.area as string] = (porArea[p.area as string] ?? 0) + 1;

  return {
    total: count ?? ordenadas.length,
    por_area: porArea,
    mostrando: Math.min(ordenadas.length, LIMITE_LINHAS),
    linhas: ordenadas.slice(0, LIMITE_LINHAS).map((p) => ({
      id: p.id,
      tipo: p.tipo,
      area: p.area,
      severidade: p.severidade,
      titulo: p.titulo,
      detalhe: p.detalhe,
      fatos: p.dados,
      em_aberto_ha_dias: diasEntre(String(p.primeira_deteccao).slice(0, 10), hoje),
      vence_em: p.vence_em,
      acao_sugerida: p.acao_sugerida,
      link: p.link,
    })),
  };
}

// ---------------------------------------------------------------------------
// Resumos agregados (os coletores que já existiam)
// ---------------------------------------------------------------------------
const ArgsResumo = z.object({ area: z.enum(["financeiro", "projetos", "comercial", "obras", "equipe"]) });

async function resumo(ctx: ContextoFerramenta, raw: Record<string, unknown>): Promise<unknown> {
  const a = ArgsResumo.parse(raw);
  return coletarDados(a.area, ctx.db, ctx.empresaId);
}

// ---------------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------------
export const FERRAMENTAS: Ferramenta[] = [
  {
    nome: "listar_pendencias",
    descricao:
      'O que está em aberto agora, já priorizado (parcelas e contas vencidas, prazos, orçamento, obra, planejamento). Args: {"area"?: financeiro|prazos|orcamento|obra|planejamento|comercial, "somente_urgentes"?: boolean}. Use em "o que está pendente?", "o que preciso resolver hoje?", "o que está atrasado?".',
    args: ArgsPendencias,
    executar: listarPendencias,
  },
  {
    nome: "listar_recebimentos",
    descricao:
      'Parcelas e receitas a receber, uma por linha. Args: {"situacao": atrasados|a_vencer|recebidos, "dias"?: 1-90 (padrão 7), "projeto"?: parte do nome}. Use em "quais parcelas vencem esta semana?", "quem está me devendo?".',
    args: ArgsRecebimentos,
    executar: listarRecebimentos,
  },
  {
    nome: "listar_pagamentos",
    descricao:
      'Contas e despesas a pagar, uma por linha. Args: {"situacao": atrasados|a_vencer|pagos, "dias"?: 1-90 (padrão 7), "projeto"?: parte do nome}. Use em "o que tenho a pagar?", "contas atrasadas".',
    args: ArgsPagamentos,
    executar: listarPagamentos,
  },
  {
    nome: "listar_projetos",
    descricao:
      'Projetos por situação, com prazo de entrega. Args: {"situacao": atrasados|prazo_proximo|ativos|concluidos, "dias"?: 1-90 (padrão 14), "busca"?: parte do nome}. Use em "quais projetos vencem este mês?", "o que está atrasado?".',
    args: ArgsProjetos,
    executar: listarProjetos,
  },
  {
    nome: "detalhar_projeto",
    descricao:
      'Um projeto por inteiro: disciplinas e prazos, marcos de faturamento, parcelas em aberto e pendências. Args: {"busca": parte do nome}. Use em "como está o projeto X?".',
    args: ArgsDetalheProjeto,
    executar: detalharProjeto,
  },
  {
    nome: "listar_tarefas_obra",
    descricao:
      'Tarefas do cronograma das obras. Args: {"situacao": atrasadas|vencendo|abertas, "dias"?: 1-30 (padrão 3), "obra"?: parte do nome}. Use em "o que vence na obra X?", "tarefas atrasadas das obras".',
    args: ArgsTarefasObra,
    executar: listarTarefasObra,
  },
  {
    nome: "listar_leads",
    descricao:
      'Leads em aberto no funil. Args: {"situacao": abertos|previsao_vencida, "busca"?: parte do nome}. Use em "quais leads estão parados?".',
    args: ArgsLeads,
    executar: listarLeads,
  },
  {
    nome: "resumo_da_area",
    descricao:
      'Totais e visão geral de uma área, sem linhas individuais. Args: {"area": financeiro|projetos|comercial|obras|equipe}. Use em "como está o caixa do mês?", "quantos projetos ativos?".',
    args: ArgsResumo,
    executar: resumo,
  },
];

export const FERRAMENTA_POR_NOME = new Map(FERRAMENTAS.map((f) => [f.nome, f]));
