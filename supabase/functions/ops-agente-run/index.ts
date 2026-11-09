/**
 * ops-agente-run: executa um agente de operação da Pilar (SPEC 126 fase 1, ADR 0060).
 *
 * Deploy: supabase functions deploy ops-agente-run --no-verify-jwt
 *
 * Duas portas de entrada:
 *   - cron (pg_cron → ops_agente_disparar): Authorization: Bearer <CRON_SECRET>
 *   - "Rodar agora" no Ultra: JWT do ultra admin com MFA (requireUltraAdmin)
 *   POST { "agente_id": "receita" | "clientes" | "produto" | "chefe" }
 *
 * Receita e Clientes: números pelas mesmas RPCs da tela (ops_receita, ops_saude_empresas),
 * candidatos a contato por regra (regras.ts), texto pelo modelo, aterrado em código.
 * Grava ops_execucoes (briefing, custo) e ops_acoes pendentes (N1: quem envia é o ultra
 * admin). Idempotente pela chave da ação. Sem modelo, roda só com as regras.
 *
 * Produto (SPEC 130, segunda-feira): uso por área (ops_produto) e feedback viram tarefas
 * internas; o modelo só escreve o briefing.
 *
 * Qualidade (SPEC 131, todo dia): erros do Sentry (SENTRY_READ_TOKEN) viram tarefa com link
 * e, quando resolvidos, aviso de "já corrigimos" aos escritórios atingidos.
 *
 * Chefe de gabinete: sem modelo. Junta as ações pendentes e os números e manda o resumo
 * do dia por e-mail para os ultra admins.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry, captureException } from "../_shared/sentry.ts";
import { createLogger } from "../_shared/logger.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { requireUltraAdmin } from "../_shared/admin-auth.ts";
import { jsonResponse, optionsResponse } from "../_shared/cors.ts";
import { callGeminiStructured, modeloEmUso } from "../_shared/ai-client.ts";
import { sendEmail, templateAvisoPlataforma } from "../_shared/email/index.ts";
import { lerEntrada } from "./entrada.ts";
import { configSentry, errosDas24h, resolvidos, SEM_TOKEN } from "./sentry.ts";
import { respostaSchema, systemPrompt, userMessage } from "./prompt.ts";
import {
  type AgenteDeArea,
  aterrar,
  briefingPorRegra,
  type Briefing,
  type Candidato,
  candidatosClientes,
  candidatosProduto,
  candidatosQualidade,
  candidatosReceita,
  custoUsd,
  estourouTeto,
  FORA_DA_AREA,
  indicadoresProduto,
  indicadoresQualidade,
  type ErroCorrigido,
  mudancasDesde,
  novosCandidatos,
  type Produto,
  RESPIRO_DIAS,
  resumoEfeito,
  type Retrato,
  semContatoDuplo,
  type Receita,
  resumoDoDia,
  resumoNumerosClientes,
  resumoNumerosProduto,
  resumoNumerosQualidade,
  resumoNumerosReceita,
  type SaudeEmpresa,
  textosPadrao,
} from "./regras.ts";

const log = createLogger("ops-agente-run");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const APP_URL = (Deno.env.get("APP_URL") ?? "https://app.pilarsoft.com.br").replace(/\/+$/, "");

type Admin = SupabaseClient;

type Execucao = {
  status: "ok" | "falhou" | "pausada_teto";
  sinais?: unknown;
  briefing?: Briefing | null;
  descartes?: unknown;
  tokens_in?: number | null;
  tokens_out?: number | null;
  custo_usd?: number | null;
  erro?: string | null;
};

async function remetente(admin: Admin): Promise<string> {
  const { data } = await admin
    .from("profiles")
    .select("first_name")
    .eq("role", "ultra_admin")
    .is("desativado_em", null)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return (data?.first_name as string | null)?.trim() || "a equipe";
}

async function gastoNoMes(admin: Admin, agenteId: string): Promise<number> {
  const inicio = new Date();
  inicio.setUTCDate(1);
  inicio.setUTCHours(0, 0, 0, 0);
  const { data } = await admin
    .from("ops_execucoes")
    .select("custo_usd")
    .eq("agente_id", agenteId)
    .gte("inicio", inicio.toISOString());
  return (data ?? []).reduce((s, e) => s + (Number(e.custo_usd) || 0), 0);
}

async function precoDoModelo(admin: Admin, modelo: string) {
  const { data } = await admin
    .from("ai_model_precos")
    .select("preco_input_por_milhao, preco_output_por_milhao")
    .eq("modelo", modelo)
    .lte("vigente_desde", new Date().toISOString())
    .order("vigente_desde", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data
    ? {
        preco_input_por_milhao: Number(data.preco_input_por_milhao),
        preco_output_por_milhao: Number(data.preco_output_por_milhao),
      }
    : null;
}

async function abrirExecucao(admin: Admin, agenteId: string, gatilho: "cron" | "manual"): Promise<string> {
  const { data, error } = await admin
    .from("ops_execucoes")
    .insert({ agente_id: agenteId, gatilho, status: "rodando" })
    .select("id")
    .single();
  if (error) throw new Error(`falha ao abrir execução: ${error.message}`);
  return data.id as string;
}

async function fecharExecucao(admin: Admin, id: string, r: Execucao): Promise<void> {
  const { error } = await admin
    .from("ops_execucoes")
    .update({ ...r, fim: new Date().toISOString() })
    .eq("id", id);
  if (error) log.error("falha ao fechar execução", error, { execucao_id: id });
}

function diaBrasilia(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(d);
}

/**
 * Retrato diário (SPEC 129): os indicadores da área e, para Clientes, a nota de cada
 * escritório. Upsert pela chave (data, fonte, chave, dimensão): rodar de novo no mesmo dia
 * só atualiza. É de onde saem "o que mudou desde ontem" e a tendência da nota.
 */
async function gravarRetrato(
  admin: Admin,
  agente: AgenteDeArea,
  indicadores: Record<string, number>,
  notas: Array<{ empresa_id: string; nota: number }>
): Promise<void> {
  const data = diaBrasilia(new Date());
  const linhas = [
    ...Object.entries(indicadores).map(([k, valor]) => ({
      data,
      fonte: "pilar",
      chave: `${agente}.${k}`,
      dimensao: "",
      valor,
    })),
    ...notas.map((n) => ({ data, fonte: "pilar", chave: "nota_saude", dimensao: n.empresa_id, valor: n.nota })),
  ];
  if (linhas.length === 0) return;
  const { error } = await admin
    .from("ops_metricas_diarias")
    .upsert(linhas, { onConflict: "data,fonte,chave,dimensao" });
  if (error) log.error("falha ao gravar retrato diário", error, { agente });
}

/** Escritórios com contato de OUTRA área pendente ou enviado há menos de RESPIRO_DIAS dias. */
async function empresasOcupadas(admin: Admin, agente: string, empresaIds: string[]): Promise<Map<string, string>> {
  const ocupadas = new Map<string, string>();
  if (empresaIds.length === 0) return ocupadas;
  const desde = new Date(Date.now() - RESPIRO_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("ops_acoes")
    .select("empresa_id, agente_id, status, executada_em")
    .eq("tipo", "whatsapp")
    .neq("agente_id", agente)
    .in("empresa_id", empresaIds)
    .in("status", ["pendente", "executada"]);
  for (const a of data ?? []) {
    const recente = a.status === "pendente" || (a.executada_em && (a.executada_em as string) >= desde);
    if (recente && a.empresa_id) ocupadas.set(a.empresa_id as string, a.agente_id as string);
  }
  return ocupadas;
}

/** Máximo de erros conferidos por rodada (uma chamada ao Sentry por erro). */
const ERROS_A_CONFERIR = 20;

/**
 * Erros que a Qualidade apontou em 30 dias e não foram descartados: os que resolveram no
 * Sentry dão baixa sozinhos na tarefa pendente (N2) e, se tinham atingido escritório,
 * viram aviso de "já corrigimos".
 */
async function conferirResolvidos(
  admin: Admin,
  cfg: NonNullable<ReturnType<typeof configSentry>>
): Promise<ErroCorrigido[]> {
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from("ops_acoes")
    .select("id, status, evidencia")
    .eq("agente_id", "qualidade")
    .eq("tipo", "alerta")
    .neq("status", "descartada")
    .gte("created_at", desde)
    .order("created_at", { ascending: false })
    .limit(100);
  const porErro = new Map<string, ErroCorrigido & { pendentes: string[] }>();
  for (const a of data ?? []) {
    const ev = (a.evidencia ?? {}) as Record<string, unknown>;
    const id = typeof ev.sentry_issue_id === "string" ? ev.sentry_issue_id : null;
    if (!id) continue;
    const empresas = Array.isArray(ev.empresas_afetadas)
      ? ev.empresas_afetadas.filter((x): x is string => typeof x === "string")
      : [];
    const atual = porErro.get(id) ?? {
      id,
      shortId: typeof ev.erro === "string" ? ev.erro : id,
      culprit: typeof ev.culprit === "string" ? ev.culprit : null,
      empresas: [],
      pendentes: [],
    };
    atual.empresas = [...new Set([...atual.empresas, ...empresas])];
    if (a.status === "pendente") atual.pendentes.push(a.id as string);
    porErro.set(id, atual);
  }
  // Só vale conferir o que ainda tem tarefa aberta ou escritório a avisar.
  const ids = [...porErro.values()]
    .filter((e) => e.pendentes.length > 0 || e.empresas.length > 0)
    .map((e) => e.id)
    .slice(0, ERROS_A_CONFERIR);
  if (ids.length === 0) return [];
  const prontos = await resolvidos(cfg, ids);

  const baixa = ids.filter((id) => prontos.has(id)).flatMap((id) => porErro.get(id)!.pendentes);
  if (baixa.length > 0) {
    const agora = new Date().toISOString();
    const { error } = await admin
      .from("ops_acoes")
      .update({ status: "executada", decidida_em: agora, executada_em: agora, resultado: { fechada_por: "sentry" } })
      .in("id", baixa);
    if (error) log.error("falha ao dar baixa em tarefa de erro resolvido", error);
  }

  return ids
    .filter((id) => prontos.has(id))
    .map((id) => porErro.get(id)!)
    .filter((e) => e.empresas.length > 0)
    .map(({ pendentes: _p, ...e }) => e);
}

/** Receita, Clientes, Produto e Qualidade: fatos → candidatos → texto (modelo ou regra) → ações pendentes. */
async function rodarArea(
  admin: Admin,
  agente: AgenteDeArea,
  execucaoId: string,
  tetoBrl: number | null
): Promise<Execucao & { acoes: number }> {
  const nome = await remetente(admin);
  const agora = new Date();

  let candidatos: Candidato[];
  let indicadores: Record<string, number>;
  let resumoNumeros: string;
  let notas: Array<{ empresa_id: string; nota: number }> = [];
  if (agente === "receita") {
    const { data, error } = await admin.rpc("ops_receita", { p_dias: 30 });
    if (error) throw new Error(`ops_receita: ${error.message}`);
    const r = data as Receita;
    candidatos = candidatosReceita(r, nome, agora);
    // O nome leva a janela: o modelo dizia "hoje" para número de 30 dias.
    indicadores = {
      mrr: Number(r.mrr),
      pagantes: r.pagantes,
      cadastros_30d: r.cadastros,
      cadastros_30d_anteriores: r.cadastros_anterior,
      ativados_30d: r.ativados,
      novos_pagantes_30d: r.novos_pagantes,
      em_teste: r.em_teste,
      checkout_sem_pagar_30d: r.checkout_pendente,
    };
    resumoNumeros = resumoNumerosReceita(r);
  } else if (agente === "produto") {
    const { data, error } = await admin.rpc("ops_produto");
    if (error) throw new Error(`ops_produto: ${error.message}`);
    const p = data as Produto;
    candidatos = candidatosProduto(p, agora);
    indicadores = indicadoresProduto(p);
    resumoNumeros = resumoNumerosProduto(p);
  } else if (agente === "qualidade") {
    const cfg = configSentry((k) => Deno.env.get(k));
    if (!cfg) throw new Error(SEM_TOKEN);
    const [saudeRes, incidentesRes, erros] = await Promise.all([
      admin.rpc("ops_saude_empresas"),
      admin.from("status_incidents").select("id", { count: "exact", head: true }).neq("status", "resolvido"),
      errosDas24h(cfg),
    ]);
    if (saudeRes.error) throw new Error(`ops_saude_empresas: ${saudeRes.error.message}`);
    const saude = (saudeRes.data ?? []) as SaudeEmpresa[];
    const corrigidos = await conferirResolvidos(admin, cfg);
    candidatos = candidatosQualidade(erros, corrigidos, saude, nome, agora);
    const iq = indicadoresQualidade(erros, saude, incidentesRes.count ?? 0, agora);
    indicadores = iq;
    resumoNumeros = resumoNumerosQualidade(iq);
  } else {
    const { data, error } = await admin.rpc("ops_saude_empresas");
    if (error) throw new Error(`ops_saude_empresas: ${error.message}`);
    const saude = (data ?? []) as SaudeEmpresa[];
    candidatos = candidatosClientes(saude, nome, agora);
    indicadores = {
      escritorios: saude.length,
      risco: saude.filter((s) => s.faixa === "risco").length,
      atencao: saude.filter((s) => s.faixa === "atencao").length,
      saudavel: saude.filter((s) => s.faixa === "saudavel").length,
      feedback_aberto: saude.reduce((s, e) => s + e.feedback_aberto, 0),
    };
    resumoNumeros = resumoNumerosClientes(saude);
    notas = saude.map((e) => ({ empresa_id: e.empresa_id, nota: e.nota }));
  }

  await gravarRetrato(admin, agente, indicadores, notas);

  // Qualquer status: a chave carrega a data do fato (vencimento, atraso, último acesso),
  // então ação já enviada ou descartada para o mesmo fato não volta na próxima rodada.
  const { data: jaVistas } = candidatos.length
    ? await admin
        .from("ops_acoes")
        .select("chave")
        .eq("agente_id", agente)
        .in(
          "chave",
          candidatos.map((c) => c.chave)
        )
    : { data: [] };
  const ineditos = novosCandidatos(candidatos, new Set((jaVistas ?? []).map((p) => p.chave as string)));
  // Um contato por escritório: se outra área já fala com ele, esta não manda outro WhatsApp.
  const ocupadas = await empresasOcupadas(
    admin,
    agente,
    ineditos.flatMap((c) => (c.empresaId ? [c.empresaId] : []))
  );
  const coordenado = semContatoDuplo(ineditos, ocupadas);
  const novos = coordenado.manter;

  // O briefing não pede o contato que ficou com outra área.
  const comOutraArea = new Set(coordenado.descartes.map((d) => d.ref));
  let briefing: Briefing = briefingPorRegra(
    agente,
    candidatos.filter((c) => !comOutraArea.has(c.ref)),
    resumoNumeros
  );
  let textos = textosPadrao(novos);
  let descartes: unknown[] = [...coordenado.descartes];
  let tokensIn: number | null = null;
  let tokensOut: number | null = null;
  let custo: number | null = null;
  let erroModelo: string | null = null;

  const tipo = `ops_${agente}`;
  if (estourouTeto(await gastoNoMes(admin, agente), tetoBrl)) {
    erroModelo = "teto mensal de custo atingido: briefing e textos por regra";
  } else {
    try {
      const r = await callGeminiStructured(
        {
          systemPrompt: systemPrompt(agente, nome),
          userMessage: userMessage(indicadores, novos),
          empresaId: "plataforma",
          tipo,
          referenciaId: execucaoId,
          referenciaTipo: "ops_execucao",
        },
        respostaSchema,
        { maxRetries: 1 }
      );
      const aterrado = aterrar(r.data, novos, Object.keys(indicadores), FORA_DA_AREA[agente]);
      briefing = aterrado.briefing.resumo ? aterrado.briefing : briefing;
      textos = aterrado.textos;
      descartes = [...coordenado.descartes, ...aterrado.descartes];
      tokensIn = r.tokensEntrada;
      tokensOut = r.tokensSaida;
      custo = custoUsd(r.tokensEntrada, r.tokensSaida, await precoDoModelo(admin, modeloEmUso(tipo)));
    } catch (e) {
      // Sem modelo o agente ainda entrega: briefing e textos por regra.
      erroModelo = e instanceof Error ? e.message.slice(0, 300) : "falha no modelo";
      await captureException(e, { fn: "ops-agente-run", tags: { agente } });
    }
  }

  const linhas = novos.map((c) => ({
    agente_id: agente,
    execucao_id: execucaoId,
    tipo: c.tipo,
    empresa_id: c.empresaId,
    titulo: c.titulo,
    chave: c.chave,
    prioridade: c.prioridade,
    prazo: c.prazo,
    evidencia: { ...c.fatos, ...(c.empresaNome ? { escritorio: c.empresaNome } : {}), ...(c.extra ?? {}) },
    rascunho:
      c.tipo === "whatsapp"
        ? { canal: "whatsapp", texto: textos.get(c.ref) ?? c.textoPadrao, telefone: c.telefone, contato: c.contatoNome }
        : { canal: "alerta", texto: c.textoPadrao, link: c.link ?? "/ultra-admin/feedback" },
  }));
  // Uma a uma: o índice único da chave é parcial (só pendente), e o PostgREST não faz
  // ON CONFLICT com predicado. Duplicata (23505) vem de outra execução ao mesmo tempo.
  let gravadas = 0;
  for (const linha of linhas) {
    const { error } = await admin.from("ops_acoes").insert(linha);
    if (!error) gravadas++;
    else if (error.code !== "23505") throw new Error(`falha ao gravar ação: ${error.message}`);
  }

  return {
    status: "ok",
    sinais: { indicadores, candidatos: candidatos.length, novos: novos.length },
    briefing,
    descartes,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    custo_usd: custo,
    erro: erroModelo,
    acoes: gravadas,
  };
}

async function lerRetrato(admin: Admin, data: string): Promise<Retrato> {
  const { data: linhas } = await admin
    .from("ops_metricas_diarias")
    .select("chave, valor")
    .eq("fonte", "pilar")
    .eq("data", data)
    .eq("dimensao", "");
  return Object.fromEntries((linhas ?? []).map((l) => [l.chave as string, Number(l.valor)]));
}

/** Chefe de gabinete: avalia contatos antigos e manda o resumo do dia por e-mail, sem modelo. */
async function rodarChefe(admin: Admin): Promise<Execucao & { enviados: number }> {
  // Antes do resumo: contatos enviados há 7+ dias ganham o resultado (o fato mudou?).
  const { data: avaliados, error: errAval } = await admin.rpc("_ops_avaliar_contatos");
  if (errAval) log.error("falha ao avaliar contatos", errAval);

  const agora = new Date();
  const hojeIso = diaBrasilia(agora);
  const ontemIso = diaBrasilia(new Date(agora.getTime() - 24 * 60 * 60 * 1000));
  const desde30 = new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const [retratoHoje, retratoOntem, efeitosRes] = await Promise.all([
    lerRetrato(admin, hojeIso),
    lerRetrato(admin, ontemIso),
    admin.from("ops_acoes").select("resultado").eq("status", "executada").gte("executada_em", desde30),
  ]);
  const efeitos = (efeitosRes.data ?? [])
    .map((a) => (a.resultado as { efeito?: string } | null)?.efeito)
    .filter((e): e is string => typeof e === "string");

  const [{ data: pendentes }, receitaRes, saudeRes, destRes] = await Promise.all([
    admin.from("ops_acoes").select("agente_id, titulo, prioridade, prazo").eq("status", "pendente").limit(200),
    admin.rpc("ops_receita", { p_dias: 30 }),
    admin.rpc("ops_saude_empresas"),
    admin.from("profiles").select("email").eq("role", "ultra_admin").is("desativado_em", null),
  ]);
  const numeros = [
    receitaRes.data ? resumoNumerosReceita(receitaRes.data as Receita) : "",
    saudeRes.data ? resumoNumerosClientes(saudeRes.data as SaudeEmpresa[]) : "",
    mudancasDesde(retratoHoje, retratoOntem),
    resumoEfeito(efeitos),
  ];
  const resumo = resumoDoDia((pendentes ?? []) as Parameters<typeof resumoDoDia>[0], numeros);
  const hoje = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "long" }).format(
    new Date()
  );
  const dia = hojeIso;

  let enviados = 0;
  for (const d of destRes.data ?? []) {
    const email = d.email as string | null;
    if (!email) continue;
    const template = templateAvisoPlataforma({
      titulo: resumo.titulo,
      mensagem: resumo.mensagem,
      empresaNome: null,
      enviadoEm: hoje,
      url: `${APP_URL}/ultra-admin/time`,
      dicaResposta: "Os rascunhos de mensagem estão na Central do Time, prontos para abrir no WhatsApp.",
    });
    const r = await sendEmail({
      classe: "plataforma",
      tipo: "ops_resumo_do_dia",
      to: email,
      referencia: { tipo: "ops_agentes", id: null },
      idempotencyKey: `ops-resumo-${dia}-${email}`,
      ...template,
    });
    if (r.ok) enviados++;
  }

  return {
    status: "ok",
    sinais: {
      pendentes: (pendentes ?? []).length,
      destinatarios: (destRes.data ?? []).length,
      contatos_avaliados: typeof avaliados === "number" ? avaliados : 0,
    },
    briefing: {
      fonte: "regra",
      resumo: resumo.titulo,
      destaques: resumo.prioridades.map((p) => ({ texto: p.titulo, refs: [p.agente_id] })),
    },
    enviados,
  };
}

serve(
  withSentry("ops-agente-run", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return jsonResponse({ error: "method not allowed" }, 405, req);

    let gatilho: "cron" | "manual";
    if (cronAutorizado(req.headers, CRON_SECRET)) {
      gatilho = "cron";
    } else {
      const auth = await requireUltraAdmin(req);
      if (auth.error) return auth.error;
      gatilho = "manual";
    }

    const lida = lerEntrada(await req.json().catch(() => null));
    if (!lida.ok) return jsonResponse({ error: lida.erro }, 400, req);
    const agenteId = lida.entrada.agente_id;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: agente } = await admin
      .from("ops_agentes")
      .select("id, ativo, teto_mensal_brl")
      .eq("id", agenteId)
      .maybeSingle();
    if (!agente) return jsonResponse({ error: "agente não encontrado" }, 404, req);
    // Pausado: o cron pula; "Rodar agora" roda mesmo assim, é pedido explícito.
    if (!agente.ativo && gatilho === "cron") return jsonResponse({ pulado: "pausado" }, 200, req);

    const execucaoId = await abrirExecucao(admin, agenteId, gatilho);
    try {
      const resultado =
        agenteId === "chefe"
          ? await rodarChefe(admin)
          : await rodarArea(
              admin,
              agenteId,
              execucaoId,
              agente.teto_mensal_brl === null ? null : Number(agente.teto_mensal_brl)
            );
      const { acoes: _a, enviados: _e, ...execucao } = resultado as Execucao & { acoes?: number; enviados?: number };
      await fecharExecucao(admin, execucaoId, execucao);
      await admin.rpc("registrar_heartbeat_agente", {
        p_agent_type: `ops_${agenteId}`,
        p_status: "ok",
        p_detail: { execucao_id: execucaoId },
      });
      log.info("agente rodou", { agente: agenteId, gatilho, execucao_id: execucaoId });
      return jsonResponse({ execucao_id: execucaoId, ...resultado }, 200, req);
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : "falha";
      await fecharExecucao(admin, execucaoId, { status: "falhou", erro: mensagem.slice(0, 500) });
      await admin.rpc("registrar_heartbeat_agente", {
        p_agent_type: `ops_${agenteId}`,
        p_status: "failed",
        p_detail: { execucao_id: execucaoId, erro: mensagem.slice(0, 300) },
      });
      await captureException(e, { fn: "ops-agente-run", tags: { agente: agenteId } });
      return jsonResponse({ error: "o agente falhou; detalhes na execução", execucao_id: execucaoId }, 500, req);
    }
  })
);
