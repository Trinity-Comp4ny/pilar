/**
 * Ferramentas do conector da Pilar (SPEC 151). Todas só leem, e sempre com o cliente do
 * usuário (token dele): a RLS decide o que aparece, igual ao app. Ninguém aqui usa service
 * role. Valores de dinheiro chegam vazios para quem não vê financeiro (views *_safe e RLS).
 *
 * O modelo lê o resultado, então os nomes dos campos são em português e autoexplicativos, e
 * cada lista tem limite (o conector é para consulta, não para exportar a base).
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "../_shared/schemas.ts";
import { type DescricaoFerramenta, resultadoErro, resultadoOk, type ResultadoFerramenta } from "./protocolo.ts";

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 50;
/** Teto de lançamentos lidos para o resumo financeiro (acima disso o resumo avisa). */
const TETO_LANCAMENTOS = 5000;
const DIAS_MAXIMOS_DO_PERIODO = 366;

export const STATUS_PROJETO = [
  "Planejamento",
  "Em andamento",
  "Execução",
  "Revisão",
  "Paralisado",
  "Concluído",
  "Cancelado",
] as const;
export const STATUS_PROPOSTA = ["rascunho", "enviada", "aceita", "recusada", "expirada"] as const;
export const STATUS_LEAD = ["Novo", "Em contato", "Proposta", "Negociação", "Ganho", "Perdido"] as const;

/**
 * Texto de busca seguro para o filtro do PostgREST: tira o que muda a sintaxe do `or()`
 * (vírgula, ponto, parênteses, aspas, dois-pontos) e os curingas do ilike. Devolve null se sobrar nada.
 */
export function termoDeBusca(texto: string | undefined): string | null {
  if (!texto) return null;
  const limpo = texto
    .replace(/[,.()"'%_*:\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return limpo === "" ? null : limpo;
}

/** Data de hoje (AAAA-MM-DD) no fuso do Brasil, que é o do escritório. */
export function hojeNoBrasil(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

/** Primeiro e último dia do mês de uma data AAAA-MM-DD. */
export function mesDe(data: string): { inicio: string; fim: string } {
  const [ano, mes] = data.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const mm = String(mes).padStart(2, "0");
  return { inicio: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimoDia).padStart(2, "0")}` };
}

function diasEntre(inicio: string, fim: string): number {
  return Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000);
}

/** Soma em centavos para não acumular erro de ponto flutuante; devolve reais. */
function somar(valores: (number | null | undefined)[]): number {
  return valores.reduce<number>((total, v) => total + Math.round((v ?? 0) * 100), 0) / 100;
}

function nomeCompleto(nome: string | null | undefined, sobrenome: string | null | undefined): string | null {
  const partes = [nome, sobrenome].filter((p): p is string => Boolean(p && p.trim()));
  return partes.length > 0 ? partes.join(" ") : null;
}

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use datas no formato AAAA-MM-DD")
  .refine((d) => !Number.isNaN(Date.parse(`${d}T00:00:00Z`)), "Data inválida");

const limite = z.number().int().min(1).max(LIMITE_MAXIMO).default(LIMITE_PADRAO);
const busca = z.string().max(200).optional();

/** Mensagem curta para erro de banco: não vaza detalhe interno para o modelo. */
const ERRO_DE_LEITURA = "Não foi possível ler os dados agora. Tente de novo em instantes.";

class ErroDeLeitura extends Error {}

type Linha = Record<string, unknown>;

/** Linhas de uma consulta de lista; erro de banco vira mensagem curta para o modelo. */
function exigir<T = Linha[]>(resposta: { data: unknown; error: unknown }): T {
  if (resposta.error) throw new ErroDeLeitura(ERRO_DE_LEITURA);
  return (resposta.data ?? []) as T;
}

/** Uma linha (maybeSingle), ou null quando não existe ou a RLS não deixa ver. */
function exigirLinha(resposta: { data: unknown; error: unknown }): Linha | null {
  if (resposta.error) throw new ErroDeLeitura(ERRO_DE_LEITURA);
  return (resposta.data as Linha | null) ?? null;
}

async function nomesDeClientes(db: SupabaseClient, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unicos.length === 0) return new Map();
  const linhas = exigir<Linha[]>(await db.from("clientes").select("id, nome, sobrenome").in("id", unicos));
  return new Map(
    linhas.map((c) => [String(c.id), nomeCompleto(c.nome as string, c.sobrenome as string) ?? "Sem nome"])
  );
}

// ---------------------------------------------------------------------------
// Definição: descrição para o cliente + schema de validação + execução
// ---------------------------------------------------------------------------

interface Ferramenta<S extends z.ZodTypeAny> {
  descricao: DescricaoFerramenta;
  entrada: S;
  executar: (db: SupabaseClient, entrada: z.output<S>) => Promise<Record<string, unknown>>;
}

const SO_LEITURA = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

/** Ferramenta pronta para a lista: valida a entrada e executa, sem expor o tipo da entrada. */
interface FerramentaRegistrada {
  descricao: DescricaoFerramenta;
  rodar: (db: SupabaseClient, argumentos: Record<string, unknown>) => Promise<ResultadoFerramenta>;
}

/**
 * Entrada inválida e erro de leitura voltam como resultado com `isError`, para o modelo
 * corrigir ou explicar ao usuário. Outro erro sobe (vira 500 e vai para o Sentry).
 */
function definir<S extends z.ZodTypeAny>(f: Ferramenta<S>): FerramentaRegistrada {
  return {
    descricao: f.descricao,
    async rodar(db, argumentos) {
      const entrada = f.entrada.safeParse(argumentos);
      if (!entrada.success) {
        const problema = entrada.error.issues[0];
        const campo = problema.path.join(".");
        return resultadoErro(campo ? `Entrada inválida em "${campo}": ${problema.message}` : problema.message);
      }
      try {
        return resultadoOk(await f.executar(db, entrada.data));
      } catch (e) {
        if (e instanceof ErroDeLeitura) return resultadoErro(e.message);
        throw e;
      }
    },
  };
}

const propriedadeLimite = {
  type: "integer",
  minimum: 1,
  maximum: LIMITE_MAXIMO,
  default: LIMITE_PADRAO,
  description: `Quantos itens devolver (até ${LIMITE_MAXIMO}).`,
};

const buscarProjetos = definir({
  descricao: {
    name: "buscar_projetos",
    title: "Buscar projetos",
    description:
      "Lista os projetos do escritório, do mais recente para o mais antigo. Filtra por nome ou código e por status. Traz cliente, datas, prioridade e valor do contrato (vazio para quem não vê financeiro).",
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Parte do nome ou do código do projeto." },
        status: { type: "string", enum: [...STATUS_PROJETO], description: "Status do projeto." },
        limite: propriedadeLimite,
      },
      additionalProperties: false,
    },
    annotations: { title: "Buscar projetos", ...SO_LEITURA },
  },
  entrada: z.object({ busca, status: z.enum(STATUS_PROJETO).optional(), limite }),
  async executar(db, { busca, status, limite }) {
    let consulta = db
      .from("projetos_safe")
      .select(
        "id, codigo_projeto, nome, status, cliente_id, data_inicio, data_previsao, data_final, prioridade, valor_contrato, pode_ver_valor"
      )
      .is("deleted_at", null);
    const termo = termoDeBusca(busca);
    if (termo) consulta = consulta.or(`nome.ilike.*${termo}*,codigo_projeto.ilike.*${termo}*`);
    if (status) consulta = consulta.eq("status", status);
    const linhas = exigir<Linha[]>(await consulta.order("updated_at", { ascending: false }).limit(limite));
    const clientes = await nomesDeClientes(
      db,
      linhas.map((p) => p.cliente_id as string)
    );
    return {
      quantidade: linhas.length,
      projetos: linhas.map((p) => ({
        id: p.id,
        codigo: p.codigo_projeto,
        nome: p.nome,
        status: p.status,
        cliente: p.cliente_id ? (clientes.get(String(p.cliente_id)) ?? null) : null,
        inicio: p.data_inicio,
        previsao_de_entrega: p.data_previsao,
        concluido_em: p.data_final,
        prioridade: p.prioridade,
        valor_do_contrato: p.pode_ver_valor ? p.valor_contrato : null,
      })),
    };
  },
});

const detalharProjeto = definir({
  descricao: {
    name: "detalhar_projeto",
    title: "Detalhar projeto",
    description:
      "Detalhe de um projeto pelo id (use buscar_projetos para achar o id): dados gerais, cliente, disciplinas com status e horas, aditivos de escopo e, para quem vê financeiro, quanto já foi recebido e pago no projeto.",
    inputSchema: {
      type: "object",
      properties: { projeto_id: { type: "string", format: "uuid", description: "Id do projeto." } },
      required: ["projeto_id"],
      additionalProperties: false,
    },
    annotations: { title: "Detalhar projeto", ...SO_LEITURA },
  },
  entrada: z.object({ projeto_id: z.string().uuid("Informe o id do projeto (use buscar_projetos)") }),
  async executar(db, { projeto_id }) {
    const projeto = exigirLinha(
      await db
        .from("projetos_safe")
        .select(
          "id, codigo_projeto, nome, status, cliente_id, localizacao, area_m2, data_inicio, data_previsao, data_final, prioridade, observacao, valor_contrato, pode_ver_valor"
        )
        .eq("id", projeto_id)
        .is("deleted_at", null)
        .maybeSingle()
    );
    if (!projeto) throw new ErroDeLeitura("Projeto não encontrado, ou você não tem acesso a ele.");

    const podeVerValor = projeto.pode_ver_valor === true;
    const [clientes, disciplinas, aditivos, lancamentos] = await Promise.all([
      nomesDeClientes(db, [projeto.cliente_id as string]),
      db
        .from("projeto_disciplinas")
        .select("nome, codigo, status, data_inicio, data_fim, data_fim_real, horas_estimadas, horas_realizadas")
        .eq("projeto_id", projeto_id)
        .order("ordem_etapa", { ascending: true })
        .limit(LIMITE_MAXIMO),
      db
        .from("escopos_safe")
        .select("tipo, status, descricao, valor_aditivo, impacto_prazo_dias, aprovado_em, created_at, pode_ver_valor")
        .eq("projeto_id", projeto_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(LIMITE_MAXIMO),
      podeVerValor
        ? db
            .from("lancamentos")
            .select("tipo, status, valor")
            .eq("projeto_id", projeto_id)
            .is("deleted_at", null)
            .neq("status", "Cancelado")
            .limit(TETO_LANCAMENTOS)
        : Promise.resolve({ data: [], error: null }),
    ]);

    const linhasLancamento = exigir<Linha[]>(lancamentos);
    const doTipo = (tipo: string, status?: string[]) =>
      somar(
        linhasLancamento
          .filter((l) => l.tipo === tipo && (!status || status.includes(String(l.status))))
          .map((l) => l.valor as number)
      );

    return {
      projeto: {
        id: projeto.id,
        codigo: projeto.codigo_projeto,
        nome: projeto.nome,
        status: projeto.status,
        cliente: projeto.cliente_id ? (clientes.get(String(projeto.cliente_id)) ?? null) : null,
        localizacao: projeto.localizacao,
        area_m2: projeto.area_m2,
        inicio: projeto.data_inicio,
        previsao_de_entrega: projeto.data_previsao,
        concluido_em: projeto.data_final,
        prioridade: projeto.prioridade,
        observacao: projeto.observacao,
        valor_do_contrato: podeVerValor ? projeto.valor_contrato : null,
      },
      disciplinas: exigir<Linha[]>(disciplinas).map((d) => ({
        nome: d.nome,
        codigo: d.codigo,
        status: d.status,
        inicio: d.data_inicio,
        prazo: d.data_fim,
        concluida_em: d.data_fim_real,
        horas_estimadas: d.horas_estimadas,
        horas_realizadas: d.horas_realizadas,
      })),
      aditivos: exigir<Linha[]>(aditivos).map((a) => ({
        tipo: a.tipo,
        status: a.status,
        descricao: a.descricao,
        valor: a.pode_ver_valor ? a.valor_aditivo : null,
        impacto_no_prazo_dias: a.impacto_prazo_dias,
        aprovado_em: a.aprovado_em,
        criado_em: a.created_at,
      })),
      financeiro_do_projeto: podeVerValor
        ? {
            receitas_previstas: doTipo("receita"),
            recebido: doTipo("receita", ["Recebido", "Pago"]),
            despesas_previstas: doTipo("despesa"),
            pago: doTipo("despesa", ["Pago", "Recebido"]),
          }
        : null,
    };
  },
});

const buscarPropostas = definir({
  descricao: {
    name: "buscar_propostas",
    title: "Buscar propostas",
    description:
      "Lista as propostas comerciais, da mais recente para a mais antiga. Filtra por título ou código e por status (rascunho, enviada, aceita, recusada, expirada).",
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Parte do título ou do código da proposta." },
        status: { type: "string", enum: [...STATUS_PROPOSTA], description: "Status da proposta." },
        limite: propriedadeLimite,
      },
      additionalProperties: false,
    },
    annotations: { title: "Buscar propostas", ...SO_LEITURA },
  },
  entrada: z.object({ busca, status: z.enum(STATUS_PROPOSTA).optional(), limite }),
  async executar(db, { busca, status, limite }) {
    let consulta = db
      .from("propostas")
      .select(
        "id, codigo, titulo, status, cliente_id, valor_proposto, prazo_estimado_dias, validade, contrato_assinado, projeto_id, created_at"
      )
      .is("deleted_at", null);
    const termo = termoDeBusca(busca);
    if (termo) consulta = consulta.or(`titulo.ilike.*${termo}*,codigo.ilike.*${termo}*`);
    if (status) consulta = consulta.eq("status", status);
    const linhas = exigir<Linha[]>(await consulta.order("created_at", { ascending: false }).limit(limite));
    const clientes = await nomesDeClientes(
      db,
      linhas.map((p) => p.cliente_id as string)
    );
    return {
      quantidade: linhas.length,
      propostas: linhas.map((p) => ({
        id: p.id,
        codigo: p.codigo,
        titulo: p.titulo,
        status: p.status,
        cliente: p.cliente_id ? (clientes.get(String(p.cliente_id)) ?? null) : null,
        valor_proposto: p.valor_proposto,
        prazo_estimado_dias: p.prazo_estimado_dias,
        validade: p.validade,
        contrato_assinado: p.contrato_assinado,
        virou_projeto: Boolean(p.projeto_id),
        criada_em: p.created_at,
      })),
    };
  },
});

const buscarLeads = definir({
  descricao: {
    name: "buscar_leads",
    title: "Buscar leads",
    description:
      "Lista os leads do funil comercial, do mais recente para o mais antigo. Filtra por nome do contato ou da empresa e por status. Traz etapa do funil, origem, valor estimado e previsão de fechamento.",
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Parte do nome do contato ou da empresa do lead." },
        status: { type: "string", enum: [...STATUS_LEAD], description: "Status do lead." },
        limite: propriedadeLimite,
      },
      additionalProperties: false,
    },
    annotations: { title: "Buscar leads", ...SO_LEITURA },
  },
  entrada: z.object({ busca, status: z.enum(STATUS_LEAD).optional(), limite }),
  async executar(db, { busca, status, limite }) {
    let consulta = db
      .from("leads_safe")
      .select(
        "id, nome, sobrenome, empresa_lead, status, origem, etapa_id, valor_estimado, pode_ver_valor, previsao_fechamento, motivo_perda, created_at"
      )
      .is("deleted_at", null);
    const termo = termoDeBusca(busca);
    if (termo) consulta = consulta.or(`nome.ilike.*${termo}*,sobrenome.ilike.*${termo}*,empresa_lead.ilike.*${termo}*`);
    if (status) consulta = consulta.eq("status", status);
    const linhas = exigir<Linha[]>(await consulta.order("created_at", { ascending: false }).limit(limite));

    const etapaIds = [...new Set(linhas.map((l) => l.etapa_id).filter((id): id is string => typeof id === "string"))];
    const etapas =
      etapaIds.length > 0
        ? new Map(
            exigir<Linha[]>(await db.from("lead_etapas").select("id, nome").in("id", etapaIds)).map((e) => [
              String(e.id),
              String(e.nome),
            ])
          )
        : new Map<string, string>();

    return {
      quantidade: linhas.length,
      leads: linhas.map((l) => ({
        id: l.id,
        contato: nomeCompleto(l.nome as string, l.sobrenome as string),
        empresa: l.empresa_lead,
        status: l.status,
        etapa_do_funil: l.etapa_id ? (etapas.get(String(l.etapa_id)) ?? null) : null,
        origem: l.origem,
        valor_estimado: l.pode_ver_valor ? l.valor_estimado : null,
        previsao_de_fechamento: l.previsao_fechamento,
        motivo_da_perda: l.motivo_perda,
        criado_em: l.created_at,
      })),
    };
  },
});

const buscarClientes = definir({
  descricao: {
    name: "buscar_clientes",
    title: "Buscar clientes",
    description:
      "Lista os clientes do escritório em ordem alfabética, com contato. Filtra por nome ou e-mail. Dados bancários e documentos não saem pelo conector.",
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Parte do nome ou do e-mail do cliente." },
        limite: propriedadeLimite,
      },
      additionalProperties: false,
    },
    annotations: { title: "Buscar clientes", ...SO_LEITURA },
  },
  entrada: z.object({ busca, limite }),
  async executar(db, { busca, limite }) {
    let consulta = db
      .from("clientes")
      .select("id, nome, sobrenome, tipo_pessoa, email, contato, origem, created_at")
      .is("deleted_at", null);
    const termo = termoDeBusca(busca);
    if (termo) consulta = consulta.or(`nome.ilike.*${termo}*,sobrenome.ilike.*${termo}*,email.ilike.*${termo}*`);
    const linhas = exigir<Linha[]>(await consulta.order("nome", { ascending: true }).limit(limite));
    return {
      quantidade: linhas.length,
      clientes: linhas.map((c) => ({
        id: c.id,
        nome: nomeCompleto(c.nome as string, c.sobrenome as string),
        tipo: c.tipo_pessoa,
        email: c.email,
        contato: c.contato,
        origem: c.origem,
        cliente_desde: c.created_at,
      })),
    };
  },
});

const resumoFinanceiro = definir({
  descricao: {
    name: "resumo_financeiro",
    title: "Resumo financeiro",
    description:
      "Resumo do financeiro por data de vencimento num período (padrão: mês atual): receitas e despesas previstas, realizadas, em aberto e atrasadas, saldo, e as próximas contas a receber e a pagar. Só para quem vê o financeiro no app.",
    inputSchema: {
      type: "object",
      properties: {
        inicio: { type: "string", format: "date", description: "Primeiro dia do período (AAAA-MM-DD)." },
        fim: { type: "string", format: "date", description: "Último dia do período (AAAA-MM-DD)." },
      },
      additionalProperties: false,
    },
    annotations: { title: "Resumo financeiro", ...SO_LEITURA },
  },
  entrada: z.object({ inicio: dataIso.optional(), fim: dataIso.optional() }),
  async executar(db, entrada) {
    const hoje = hojeNoBrasil();
    const mes = mesDe(hoje);
    const inicio = entrada.inicio ?? (entrada.fim ? mesDe(entrada.fim).inicio : mes.inicio);
    const fim = entrada.fim ?? (entrada.inicio ? mesDe(entrada.inicio).fim : mes.fim);
    if (fim < inicio) throw new ErroDeLeitura("O fim do período precisa ser depois do início.");
    if (diasEntre(inicio, fim) > DIAS_MAXIMOS_DO_PERIODO) {
      throw new ErroDeLeitura("Use um período de até um ano.");
    }

    // RPC estável lida por GET: o token de app externo não pode fazer POST no banco.
    const podeVer = await db.rpc("can_view_financeiro", {}, { get: true });
    if (podeVer.error) throw new ErroDeLeitura(ERRO_DE_LEITURA);
    if (podeVer.data !== true) {
      return {
        sem_acesso: true,
        mensagem: "Seu perfil na Pilar não tem acesso ao financeiro. Fale com o administrador do escritório.",
      };
    }

    const linhas = exigir<Linha[]>(
      await db
        .from("lancamentos")
        .select("tipo, status, valor, descricao, data_vencimento, contraparte_nome, projeto_nome")
        .is("deleted_at", null)
        .is("transferencia_par_id", null)
        .or("is_fatura_payment.is.null,is_fatura_payment.eq.false")
        .neq("status", "Cancelado")
        .gte("data_vencimento", inicio)
        .lte("data_vencimento", fim)
        .order("data_vencimento", { ascending: true })
        .limit(TETO_LANCAMENTOS)
    );

    const quitado = (l: Linha) => l.status === "Pago" || l.status === "Recebido";
    const atrasado = (l: Linha) =>
      l.status === "Atrasado" || (!quitado(l) && typeof l.data_vencimento === "string" && l.data_vencimento < hoje);
    const receitas = linhas.filter((l) => l.tipo === "receita");
    const despesas = linhas.filter((l) => l.tipo === "despesa");
    const valores = (ls: Linha[]) => ls.map((l) => l.valor as number);
    const item = (l: Linha) => ({
      descricao: l.descricao,
      valor: l.valor,
      vencimento: l.data_vencimento,
      contraparte: l.contraparte_nome,
      projeto: l.projeto_nome,
      atrasado: atrasado(l),
    });
    const emAberto = (ls: Linha[]) => ls.filter((l) => !quitado(l));

    const totalReceitas = somar(valores(receitas));
    const totalDespesas = somar(valores(despesas));
    const recebido = somar(valores(receitas.filter(quitado)));
    const pago = somar(valores(despesas.filter(quitado)));

    return {
      periodo: { inicio, fim, criterio: "data de vencimento" },
      receitas: {
        previstas: totalReceitas,
        recebidas: recebido,
        a_receber: somar(valores(emAberto(receitas))),
        atrasadas: somar(valores(receitas.filter(atrasado))),
      },
      despesas: {
        previstas: totalDespesas,
        pagas: pago,
        a_pagar: somar(valores(emAberto(despesas))),
        atrasadas: somar(valores(despesas.filter(atrasado))),
      },
      saldo_previsto: somar([totalReceitas, -totalDespesas]),
      saldo_realizado: somar([recebido, -pago]),
      proximos_recebimentos: emAberto(receitas).slice(0, 10).map(item),
      proximos_pagamentos: emAberto(despesas).slice(0, 10).map(item),
      ...(linhas.length >= TETO_LANCAMENTOS && {
        aviso: `O período tem mais de ${TETO_LANCAMENTOS} lançamentos; use um período menor para um total exato.`,
      }),
    };
  },
});

const FERRAMENTAS: FerramentaRegistrada[] = [
  buscarProjetos,
  detalharProjeto,
  buscarPropostas,
  buscarLeads,
  buscarClientes,
  resumoFinanceiro,
];

export const DESCRICOES: DescricaoFerramenta[] = FERRAMENTAS.map((f) => f.descricao);

export const NOMES_DAS_FERRAMENTAS = FERRAMENTAS.map((f) => f.descricao.name);

/** Executa a ferramenta com o cliente do usuário. null quando o nome não existe. */
export function executarFerramenta(
  db: SupabaseClient,
  nome: string,
  argumentos: Record<string, unknown>
): Promise<ResultadoFerramenta | null> {
  const ferramenta = FERRAMENTAS.find((f) => f.descricao.name === nome);
  return ferramenta ? ferramenta.rodar(db, argumentos) : Promise.resolve(null);
}
