/**
 * Google Agenda do usuário (SPEC 164).
 *
 *   POST { acao: "iniciar", retorno }  logado: devolve a URL de consentimento do Google.
 *   GET  ?code&state                   retorno do Google: troca o código, guarda a conexão,
 *                                      copia os eventos e volta para o app.
 *   POST { acao: "sincronizar" }       logado: copia de novo os próprios eventos.
 *   POST { acao: "desconectar" }       logado: revoga o token e apaga conexão e eventos.
 *   POST { acao: "criar", reuniao }    logado: cria a reunião no Google, na agenda escolhida
 *                                      (com Meet e convite aos convidados, se pedido), e
 *                                      grava a cópia.
 *   POST { acao: "editar", id, reuniao } / { acao: "excluir", id }: mesma coisa numa
 *                                      reunião da própria pessoa (id da Pilar).
 *   POST { acao: "cron" }              pg_cron (Bearer CRON_SECRET): ressincroniza as
 *                                      conexões mais velhas e gera os lembretes.
 *
 * verify_jwt = false porque o Google chama o GET sem token da Pilar e o cron usa o segredo
 * próprio; os POSTs de usuário autenticam aqui dentro. Cada um conecta a PRÓPRIA conta, e a
 * Pilar copia todas as agendas dela que a pessoa deixou ligadas (pessoal, trabalho...).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { authenticateUser, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { cronAutorizado } from "../_shared/cron-auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { lerJson } from "../_shared/schemas.ts";
import {
  cifrar,
  decifrar,
  emailDoIdToken,
  ErroGoogle,
  hashDoEstado,
  novoEstado,
  revogar,
  tokenDeAcesso,
  trocarCodigo,
  urlDeAutorizacao,
} from "../_shared/google-drive.ts";
import { type AmbienteDrive, ambienteDrive, retornoSeguro, urlDeRetorno } from "../_shared/google-drive-conexao.ts";
import {
  criarEvento,
  type DadosReuniao,
  editarEvento,
  ESCOPOS_AGENDA,
  type EventoGoogle,
  excluirEvento,
  janela,
  listarAgendas,
  listarEventos,
  paraLinha,
} from "../_shared/google-calendar.ts";
import { lerAcao } from "./entrada.ts";

const log = createLogger("google-calendar");
const VALIDADE_ESTADO_MS = 10 * 60 * 1000;
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
/** Por rodada do cron (5 em 5 min): quem sincronizou há mais de 10 min, os mais velhos antes. */
const CRON_LOTE = 40;
const CRON_IDADE_MIN = 10;

function servico() {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
}

interface Conexao {
  usuario_id: string;
  empresa_id: string;
  refresh_token_cifrado: string;
}

serve(
  withSentry("google-calendar", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);

    const amb = ambienteDrive(undefined, "google-calendar");
    if (req.method === "GET") return retornoDoGoogle(req, amb);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    // Cron: o segredo próprio vem no Authorization; não é chamada de navegador.
    if (cronAutorizado(req.headers, CRON_SECRET)) {
      if (!amb) return jsonResponse({ ok: false, motivo: "nao_configurado" }, 200, req);
      return jsonResponse(await rodarCron(amb), 200, req);
    }

    if (!amb) return safeErrorResponse(503, "Integração com o Google Agenda ainda não configurada", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const { data: perfil } = await supabase.from("profiles").select("empresa_id").eq("id", user.id).single();
    if (!perfil?.empresa_id) return safeErrorResponse(403, "Você precisa pertencer a uma empresa", req);

    const entrada = lerAcao(await lerJson(req));
    if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);

    const svc = servico();
    const bloqueio = await limitarOuResponder(svc, req, {
      bucket: "google_agenda",
      key: `uid:${user.id}`,
      max: 120,
      windowSeconds: 3600,
    });
    if (bloqueio) return bloqueio;

    try {
      if (entrada.data.acao === "iniciar") {
        const { estado, hash } = await novoEstado();
        const { error } = await svc.from("google_drive_oauth_estados").insert({
          estado_hash: hash,
          empresa_id: perfil.empresa_id,
          usuario_id: user.id,
          servico: "agenda",
          retorno: retornoSeguro(entrada.data.retorno),
          expira_em: new Date(Date.now() + VALIDADE_ESTADO_MS).toISOString(),
        });
        if (error) throw error;
        return jsonResponse({ url: urlDeAutorizacao(amb, estado, user.email ?? undefined, ESCOPOS_AGENDA) }, 200, req);
      }

      const conexao = await carregar(svc, user.id);

      if (entrada.data.acao === "sincronizar") {
        if (!conexao) {
          return jsonResponse({ error: "Conecte o Google Agenda em Configurações", codigo: "nao_conectado" }, 409, req);
        }
        const r = await sincronizar(svc, amb, conexao);
        if (r === "reconectar") {
          return jsonResponse({ error: "Reconecte o Google Agenda em Configurações", codigo: "reconectar" }, 409, req);
        }
        await svc.rpc("agenda_gerar_lembretes");
        return jsonResponse({ ok: true, eventos: r }, 200, req);
      }

      if (entrada.data.acao === "criar" || entrada.data.acao === "editar" || entrada.data.acao === "excluir") {
        if (!conexao) {
          return jsonResponse({ error: "Conecte o Google Agenda em Configurações", codigo: "nao_conectado" }, 409, req);
        }
        const token = await acesso(svc, amb, conexao);
        if (token === "reconectar") {
          return jsonResponse({ error: "Reconecte o Google Agenda em Configurações", codigo: "reconectar" }, 409, req);
        }
        try {
          if (entrada.data.acao === "criar") {
            // A agenda precisa ser da pessoa e deixar criar evento.
            const calendarioId = entrada.data.reuniao.calendario_id ?? "primary";
            let podeEditarAgenda = true;
            if (calendarioId !== "primary") {
              const { data: agenda } = await svc
                .from("google_agenda_calendarios")
                .select("pode_editar")
                .eq("usuario_id", user.id)
                .eq("calendario_id", calendarioId)
                .maybeSingle();
              if (!agenda?.pode_editar) {
                return safeErrorResponse(403, "Você não pode criar eventos nesta agenda", req);
              }
              podeEditarAgenda = agenda.pode_editar;
            }
            const ev = await criarEvento(token, entrada.data.reuniao as DadosReuniao, calendarioId);
            const evento = await gravarEvento(svc, conexao, calendarioId, podeEditarAgenda, ev, null);
            return jsonResponse({ ok: true, evento }, 200, req);
          }

          // editar / excluir: só reunião da própria pessoa (a linha diz qual é o evento no Google).
          const { data: atual } = await svc
            .from("agenda_eventos_google")
            .select(
              "id, calendario_id, google_evento_id, inicio, link_reuniao, pode_editar, lembrete_minutos, lembrete_em"
            )
            .eq("id", entrada.data.id)
            .eq("usuario_id", user.id)
            .maybeSingle();
          if (!atual) return safeErrorResponse(404, "Reunião não encontrada. Atualize a agenda.", req);

          if (entrada.data.acao === "excluir") {
            await excluirEvento(token, atual.calendario_id as string, atual.google_evento_id as string);
            await svc.from("agenda_eventos_google").delete().eq("id", atual.id);
            return jsonResponse({ ok: true }, 200, req);
          }

          if (!atual.pode_editar) {
            return safeErrorResponse(403, "Só quem organiza esta reunião pode mudar os dados dela", req);
          }
          const ev = await editarEvento(
            token,
            atual.calendario_id as string,
            atual.google_evento_id as string,
            entrada.data.reuniao as DadosReuniao,
            !!atual.link_reuniao
          );
          const evento = await gravarEvento(svc, conexao, atual.calendario_id as string, true, ev, atual);
          return jsonResponse({ ok: true, evento }, 200, req);
        } catch (e) {
          if (e instanceof ErroGoogle && (e.status === 403 || e.status === 404)) {
            return safeErrorResponse(
              e.status,
              e.status === 403
                ? "O Google não deixou mudar esta reunião (só o organizador pode)"
                : "Esta reunião não existe mais no Google. Atualize a agenda.",
              req
            );
          }
          throw e;
        }
      }

      // desconectar
      if (conexao) {
        try {
          await revogar(await decifrar(conexao.refresh_token_cifrado, amb.chaveToken));
        } catch (e) {
          // Revogar é cortesia: a conexão sai daqui de qualquer jeito.
          log.warn("revogar token no Google falhou", { erro: String(e) });
        }
        await svc.from("agenda_eventos_google").delete().eq("usuario_id", user.id);
        await svc.from("google_agenda_calendarios").delete().eq("usuario_id", user.id);
        await svc.from("google_agenda_conexoes").delete().eq("usuario_id", user.id);
      }
      return jsonResponse({ ok: true }, 200, req);
    } catch (e) {
      log.error("falha na ação da Agenda", e, { acao: entrada.data.acao });
      return safeErrorResponse(500, "Não foi possível concluir. Tente de novo.", req);
    }
  })
);

async function carregar(svc: SupabaseClient, usuarioId: string): Promise<Conexao | null> {
  const { data, error } = await svc
    .from("google_agenda_conexoes")
    .select("usuario_id, empresa_id, refresh_token_cifrado")
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  return (data as Conexao | null) ?? null;
}

/** Token de acesso da conexão; "reconectar" (e marca a conexão) se o Google recusou. */
async function acesso(svc: SupabaseClient, amb: AmbienteDrive, c: Conexao): Promise<string | "reconectar"> {
  try {
    return await tokenDeAcesso(amb, await decifrar(c.refresh_token_cifrado, amb.chaveToken));
  } catch (e) {
    if (e instanceof ErroGoogle && e.status === 401) {
      await svc
        .from("google_agenda_conexoes")
        .update({ erro: "reconectar", updated_at: new Date().toISOString() })
        .eq("usuario_id", c.usuario_id);
      return "reconectar";
    }
    throw e;
  }
}

/**
 * Grava na Pilar o evento que o Google devolveu depois de criar ou editar, para a tela
 * mostrar na hora sem esperar a sincronização. O aviso volta a valer se o horário ou o
 * próprio aviso mudou.
 */
async function gravarEvento(
  svc: SupabaseClient,
  c: Conexao,
  calendarioId: string,
  podeEditarAgenda: boolean,
  ev: EventoGoogle,
  antes: { inicio: unknown; lembrete_minutos: unknown; lembrete_em: unknown } | null
) {
  const linha = paraLinha(ev);
  if (!linha) return null;
  linha.pode_editar = linha.pode_editar && podeEditarAgenda;
  const mudou =
    !antes ||
    new Date(antes.inicio as string).getTime() !== new Date(linha.inicio).getTime() ||
    (antes.lembrete_minutos ?? null) !== linha.lembrete_minutos;
  const { data, error } = await svc
    .from("agenda_eventos_google")
    .upsert(
      {
        ...linha,
        calendario_id: calendarioId,
        empresa_id: c.empresa_id,
        usuario_id: c.usuario_id,
        atualizado_em: new Date().toISOString(),
        lembrete_em: mudou ? null : ((antes?.lembrete_em as string | null) ?? null),
      },
      { onConflict: "usuario_id,calendario_id,google_evento_id" }
    )
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

interface AgendaSalva {
  calendario_id: string;
  pode_editar: boolean;
  visivel: boolean;
}

/**
 * Atualiza a lista de agendas da conta: as novas entram visíveis se estão marcadas no
 * Google; as que já existiam guardam a escolha da pessoa; as que sumiram saem com as
 * reuniões delas. Devolve as agendas ligadas.
 */
async function atualizarAgendas(svc: SupabaseClient, token: string, c: Conexao): Promise<AgendaSalva[]> {
  const doGoogle = await listarAgendas(token);
  const { data: salvas, error } = await svc
    .from("google_agenda_calendarios")
    .select("calendario_id, visivel")
    .eq("usuario_id", c.usuario_id);
  if (error) throw error;
  const escolha = new Map((salvas ?? []).map((a) => [a.calendario_id as string, a.visivel as boolean]));
  const agora = new Date().toISOString();

  const linhas = doGoogle.map((a) => ({
    empresa_id: c.empresa_id,
    usuario_id: c.usuario_id,
    calendario_id: a.calendario_id,
    nome: a.nome,
    cor: a.cor,
    principal: a.principal,
    pode_editar: a.pode_editar,
    visivel: escolha.get(a.calendario_id) ?? a.selecionada,
    atualizado_em: agora,
  }));
  if (linhas.length) {
    const { error: e } = await svc
      .from("google_agenda_calendarios")
      .upsert(linhas, { onConflict: "usuario_id,calendario_id" });
    if (e) throw e;
  }

  const atuais = new Set(doGoogle.map((a) => a.calendario_id));
  const sumiram = (salvas ?? []).map((a) => a.calendario_id as string).filter((id) => !atuais.has(id));
  if (sumiram.length) {
    await svc.from("google_agenda_calendarios").delete().eq("usuario_id", c.usuario_id).in("calendario_id", sumiram);
    await svc.from("agenda_eventos_google").delete().eq("usuario_id", c.usuario_id).in("calendario_id", sumiram);
  }
  return linhas.filter((l) => l.visivel);
}

/**
 * Copia para agenda_eventos_google os eventos da janela de cada agenda ligada: grava os
 * que vieram e apaga, na janela, os que sumiram (cancelados, recusados, apagados) e os de
 * agendas desligadas. Devolve quantos ficaram, ou "reconectar" quando a conta revogou o
 * acesso pelo Google.
 */
async function sincronizar(svc: SupabaseClient, amb: AmbienteDrive, c: Conexao): Promise<number | "reconectar"> {
  const token = await acesso(svc, amb, c);
  if (token === "reconectar") return "reconectar";

  const agendas = await atualizarAgendas(svc, token, c);
  const { de, ate } = janela();
  const chave = (calendarioId: string, eventoId: string) => `${calendarioId}\u0000${eventoId}`;

  // Uma agenda que falha (removida no meio, sem permissão) não derruba as outras: os
  // eventos dela ficam como estavam até a próxima rodada.
  const sincronizadas: AgendaSalva[] = [];
  const linhas: (NonNullable<ReturnType<typeof paraLinha>> & { calendario_id: string })[] = [];
  for (const agenda of agendas) {
    try {
      const eventos = await listarEventos(token, de, ate, agenda.calendario_id);
      for (const ev of eventos) {
        const l = paraLinha(ev);
        if (!l) continue;
        linhas.push({ ...l, calendario_id: agenda.calendario_id, pode_editar: l.pode_editar && agenda.pode_editar });
      }
      sincronizadas.push(agenda);
    } catch (e) {
      log.warn("agenda não sincronizou", { calendario_id: agenda.calendario_id, erro: String(e) });
    }
  }

  // Horário ou aviso mudou: o aviso volta a valer.
  const { data: atuais, error: errAtuais } = await svc
    .from("agenda_eventos_google")
    .select("id, calendario_id, google_evento_id, inicio, lembrete_minutos, lembrete_em")
    .eq("usuario_id", c.usuario_id)
    .gte("fim", de.toISOString())
    .lte("inicio", ate.toISOString());
  if (errAtuais) throw errAtuais;
  const porChave = new Map(
    (atuais ?? []).map((a) => [chave(a.calendario_id as string, a.google_evento_id as string), a])
  );
  const agora = new Date().toISOString();

  // Toda linha leva lembrete_em: no upsert em lote, coluna ausente numa linha vira null.
  const registros = linhas.map((l) => {
    const antes = porChave.get(chave(l.calendario_id, l.google_evento_id));
    const mudou =
      !!antes &&
      (new Date(antes.inicio as string).getTime() !== new Date(l.inicio).getTime() ||
        (antes.lembrete_minutos ?? null) !== l.lembrete_minutos);
    return {
      ...l,
      empresa_id: c.empresa_id,
      usuario_id: c.usuario_id,
      atualizado_em: agora,
      lembrete_em: mudou ? null : ((antes?.lembrete_em as string | null | undefined) ?? null),
    };
  });

  for (let i = 0; i < registros.length; i += 200) {
    const { error } = await svc
      .from("agenda_eventos_google")
      .upsert(registros.slice(i, i + 200), { onConflict: "usuario_id,calendario_id,google_evento_id" });
    if (error) throw error;
  }

  // Some: evento que não veio de uma agenda sincronizada agora, ou de agenda desligada.
  const vieram = new Set(linhas.map((l) => chave(l.calendario_id, l.google_evento_id)));
  const sincronizou = new Set(sincronizadas.map((a) => a.calendario_id));
  const ligadas = new Set(agendas.map((a) => a.calendario_id));
  const sumiram = (atuais ?? [])
    .filter((a) => {
      const cal = a.calendario_id as string;
      if (!ligadas.has(cal)) return true;
      return sincronizou.has(cal) && !vieram.has(chave(cal, a.google_evento_id as string));
    })
    .map((a) => a.id as string);
  for (let i = 0; i < sumiram.length; i += 200) {
    await svc
      .from("agenda_eventos_google")
      .delete()
      .in("id", sumiram.slice(i, i + 200));
  }
  // Fora da janela para trás: não serve mais.
  await svc.from("agenda_eventos_google").delete().eq("usuario_id", c.usuario_id).lt("fim", de.toISOString());

  await svc
    .from("google_agenda_conexoes")
    .update({ sincronizado_em: agora, erro: null, updated_at: agora })
    .eq("usuario_id", c.usuario_id);
  return linhas.length;
}

async function rodarCron(amb: AmbienteDrive) {
  const svc = servico();
  const limite = new Date(Date.now() - CRON_IDADE_MIN * 60 * 1000).toISOString();
  const { data, error } = await svc
    .from("google_agenda_conexoes")
    .select("usuario_id, empresa_id, refresh_token_cifrado")
    .is("erro", null)
    .or(`sincronizado_em.is.null,sincronizado_em.lt.${limite}`)
    .order("sincronizado_em", { ascending: true, nullsFirst: true })
    .limit(CRON_LOTE);
  if (error) throw error;

  let ok = 0;
  let falhas = 0;
  for (const c of (data ?? []) as Conexao[]) {
    try {
      await sincronizar(svc, amb, c);
      ok++;
    } catch (e) {
      falhas++;
      log.error("sincronizar agenda no cron falhou", e, { usuario_id: c.usuario_id });
    }
  }
  const { data: lembretes } = await svc.rpc("agenda_gerar_lembretes");
  return { ok: true, sincronizadas: ok, falhas, lembretes: lembretes ?? 0 };
}

async function retornoDoGoogle(req: Request, amb: AmbienteDrive | null): Promise<Response> {
  const params = new URL(req.url).searchParams;
  const estado = params.get("state") ?? "";
  const site = amb?.siteUrl ?? "https://app.pilarsoft.com.br";
  const voltar = (retorno: string, status: "conectado" | "erro" | "negado") =>
    Response.redirect(urlDeRetorno(site, retorno, status, "agenda"), 302);

  if (!amb || !estado) return voltar("/", "erro");

  const svc = servico();
  const hash = await hashDoEstado(estado);
  const { data: registro } = await svc
    .from("google_drive_oauth_estados")
    .select("empresa_id, usuario_id, retorno, expira_em, servico")
    .eq("estado_hash", hash)
    .maybeSingle();
  // Uso único: apaga já, valendo ou não.
  await svc.from("google_drive_oauth_estados").delete().eq("estado_hash", hash);
  if (!registro || registro.servico !== "agenda" || new Date(registro.expira_em).getTime() < Date.now()) {
    return voltar("/", "erro");
  }

  const retorno = registro.retorno ?? "/";
  if (params.get("error")) return voltar(retorno, "negado");
  const code = params.get("code");
  if (!code) return voltar(retorno, "erro");

  try {
    const tokens = await trocarCodigo(amb, code);
    const email = emailDoIdToken(tokens.id_token);
    if (!tokens.refresh_token || !email) {
      log.error("Google não devolveu refresh_token ou e-mail", null, { usuario_id: registro.usuario_id });
      return voltar(retorno, "erro");
    }

    // Conta trocada: as agendas e os eventos antigos eram da outra conta.
    await svc.from("agenda_eventos_google").delete().eq("usuario_id", registro.usuario_id);
    await svc.from("google_agenda_calendarios").delete().eq("usuario_id", registro.usuario_id);
    const conexao: Conexao = {
      usuario_id: registro.usuario_id,
      empresa_id: registro.empresa_id,
      refresh_token_cifrado: await cifrar(tokens.refresh_token, amb.chaveToken),
    };
    const { error } = await svc.from("google_agenda_conexoes").upsert({
      ...conexao,
      google_email: email,
      erro: null,
      sincronizado_em: null,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    // Primeira cópia já aqui, para a agenda abrir cheia. Falhar não desfaz a conexão.
    try {
      await sincronizar(svc, amb, conexao);
    } catch (e) {
      log.warn("primeira sincronização da agenda falhou; o cron tenta de novo", { erro: String(e) });
    }
    return voltar(retorno, "conectado");
  } catch (e) {
    log.error("falha ao conectar o Google Agenda", e, { usuario_id: registro.usuario_id });
    return voltar(retorno, "erro");
  }
}
