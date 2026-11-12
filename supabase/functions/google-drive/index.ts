/**
 * Arquivos do projeto no Google Drive da empresa (SPEC 163).
 *
 *   pasta_projeto  pasta do projeto e uma subpasta por disciplina (cria o que falta,
 *                  se quem chama pode editar Projetos)
 *   listar         conteúdo de uma pasta conhecida
 *   criar_pasta    subpasta dentro de uma pasta conhecida
 *   iniciar_upload URL de envio retomável; o navegador manda o arquivo direto ao Google
 *   baixar         conteúdo do arquivo (passa por aqui: quem vê pela Pilar pode não ter
 *                  acesso à conta Google do escritório)
 *   lixeira        manda o arquivo (ou subpasta criada à mão) para a lixeira do Drive
 *
 * Tenancy: só mexe em pasta registrada em drive_pastas da empresa de quem chama, e em
 * arquivo cujo pai é uma dessas pastas. Ler pede Projetos (viewer); escrever, editor.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import {
  authenticateUser,
  getCorsHeaders,
  getTrustedOrigin,
  jsonResponse,
  optionsResponse,
  safeErrorResponse,
} from "../_shared/cors.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { lerJson } from "../_shared/schemas.ts";
import {
  baixar,
  criarPasta,
  ErroGoogle,
  iniciarUpload,
  listarFilhos,
  metadados,
  MIME_PASTA,
  moverParaLixeira,
} from "../_shared/google-drive.ts";
import { acessoDaConexao, ambienteDrive, carregarConexao } from "../_shared/google-drive-conexao.ts";
import { ACOES_DE_ESCRITA, type AcaoDrive, lerAcao } from "./entrada.ts";
import { NOME_PASTA_CLIENTE, nomeDaPastaDoProjeto, pastasQueFaltam } from "./pastas.ts";

const log = createLogger("google-drive");

interface PastaRegistrada {
  pasta_id: string;
  pasta_pai_id: string | null;
  projeto_id: string;
  projeto_disciplina_id: string | null;
  nome: string;
  para_cliente?: boolean;
}

serve(
  withSentry("google-drive", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const amb = ambienteDrive();
    if (!amb) return safeErrorResponse(503, "Integração com o Google Drive ainda não configurada", req);

    const auth = await authenticateUser(req);
    if (auth.error) return auth.error;
    const { supabase, user } = auth;

    const entrada = lerAcao(await lerJson(req));
    if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
    const acao = entrada.data;

    const [{ data: perfil }, { data: podeVer }, { data: podeEditar }] = await Promise.all([
      supabase.from("profiles").select("empresa_id").eq("id", user.id).single(),
      supabase.rpc("user_has_feature", { p_feature: "projetos", p_min_level: "viewer" }),
      supabase.rpc("user_has_feature", { p_feature: "projetos", p_min_level: "editor" }),
    ]);
    const empresaId = perfil?.empresa_id as string | undefined;
    if (!empresaId || !podeVer) return safeErrorResponse(403, "Sem acesso aos projetos", req);
    if (ACOES_DE_ESCRITA.has(acao.acao) && !podeEditar) {
      return safeErrorResponse(403, "Sem permissão para mexer nos arquivos do projeto", req);
    }

    const svc = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const bloqueio = await limitarOuResponder(svc, req, {
      bucket: "google_drive",
      key: `empresa:${empresaId}`,
      max: 1200,
      windowSeconds: 3600,
    });
    if (bloqueio) return bloqueio;

    const conexao = await carregarConexao(svc, empresaId);
    if (!conexao) return jsonResponse({ error: "Google Drive não conectado", codigo: "nao_conectado" }, 409, req);

    try {
      const token = await acessoDaConexao(amb, conexao);
      return await executar(req, svc, { empresaId, userId: user.id, podeEditar: !!podeEditar, token, conexao }, acao);
    } catch (e) {
      if (e instanceof ErroGoogle) {
        if (e.status === 401) {
          return jsonResponse({ error: "Reconecte o Google Drive em Configurações", codigo: "reconectar" }, 409, req);
        }
        if (e.status === 404) return jsonResponse({ error: "Não achei no Drive", codigo: "sumiu" }, 404, req);
        if (e.status === 403 || e.status === 429) {
          return safeErrorResponse(503, "O Google Drive limitou o acesso agora. Tente em instantes.", req);
        }
      }
      log.error("falha na ação do Drive", e, { acao: acao.acao, empresa_id: empresaId });
      return safeErrorResponse(502, "Não foi possível falar com o Google Drive. Tente de novo.", req);
    }
  })
);

interface Contexto {
  empresaId: string;
  userId: string;
  podeEditar: boolean;
  token: string;
  conexao: { pasta_raiz_id: string };
}

async function pastaRegistrada(svc: SupabaseClient, empresaId: string, pastaId: string) {
  const { data } = await svc
    .from("drive_pastas")
    .select("pasta_id, pasta_pai_id, projeto_id, projeto_disciplina_id, nome, para_cliente")
    .eq("empresa_id", empresaId)
    .eq("pasta_id", pastaId)
    .maybeSingle();
  return (data as PastaRegistrada | null) ?? null;
}

/** Arquivo só entra se o pai dele é pasta conhecida da empresa. */
async function paiConhecido(svc: SupabaseClient, ctx: Contexto, arquivoId: string) {
  const meta = await metadados(ctx.token, arquivoId);
  for (const pai of meta.parents ?? []) {
    const p = await pastaRegistrada(svc, ctx.empresaId, pai);
    if (p) return { meta, pai: p };
  }
  return null;
}

async function executar(req: Request, svc: SupabaseClient, ctx: Contexto, acao: AcaoDrive): Promise<Response> {
  switch (acao.acao) {
    case "pasta_projeto":
      return pastaDoProjeto(req, svc, ctx, acao.projeto_id);

    case "listar": {
      const pasta = await pastaRegistrada(svc, ctx.empresaId, acao.pasta_id);
      if (!pasta) return safeErrorResponse(404, "Pasta não encontrada", req);
      const itens = await listarFilhos(ctx.token, acao.pasta_id);
      return jsonResponse({ pasta, itens }, 200, req);
    }

    case "criar_pasta": {
      const pai = await pastaRegistrada(svc, ctx.empresaId, acao.pasta_pai_id);
      if (!pai) return safeErrorResponse(404, "Pasta não encontrada", req);
      const nova = await criarPasta(ctx.token, acao.nome, acao.pasta_pai_id);
      const { error } = await svc.from("drive_pastas").insert({
        empresa_id: ctx.empresaId,
        projeto_id: pai.projeto_id,
        pasta_id: nova.id,
        pasta_pai_id: acao.pasta_pai_id,
        nome: nova.name,
        created_by: ctx.userId,
      });
      if (error) throw error;
      return jsonResponse({ item: nova }, 200, req);
    }

    case "iniciar_upload": {
      const pasta = await pastaRegistrada(svc, ctx.empresaId, acao.pasta_id);
      if (!pasta) return safeErrorResponse(404, "Pasta não encontrada", req);
      const origin = getTrustedOrigin(req);
      if (!origin) return safeErrorResponse(403, "Origem não permitida", req);
      const url = await iniciarUpload(ctx.token, {
        nome: acao.nome,
        mime: acao.mime ?? "application/octet-stream",
        tamanho: acao.tamanho,
        paiId: acao.pasta_id,
        origin,
      });
      return jsonResponse({ upload_url: url }, 200, req);
    }

    case "baixar": {
      const achado = await paiConhecido(svc, ctx, acao.arquivo_id);
      if (!achado) return safeErrorResponse(404, "Arquivo não encontrado", req);
      if (achado.meta.mimeType.startsWith("application/vnd.google-apps.")) {
        // Documento do Google (Docs, Planilhas) não tem binário: abre no Drive.
        return jsonResponse({ abrir: achado.meta.webViewLink }, 200, req);
      }
      const r = await baixar(ctx.token, acao.arquivo_id);
      return new Response(r.body, {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          // octet-stream: o supabase-js entrega Blob ao front.
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(achado.meta.name)}`,
        },
      });
    }

    case "lixeira": {
      const achado = await paiConhecido(svc, ctx, acao.arquivo_id);
      if (!achado) return safeErrorResponse(404, "Arquivo não encontrado", req);
      if (achado.meta.mimeType === MIME_PASTA) {
        const propria = await pastaRegistrada(svc, ctx.empresaId, acao.arquivo_id);
        // A pasta de uma disciplina acompanha a disciplina; a do cliente alimenta o portal.
        if (propria?.projeto_disciplina_id) {
          return safeErrorResponse(409, "A pasta da disciplina não pode ir para a lixeira", req);
        }
        if (propria?.para_cliente) {
          return safeErrorResponse(409, "A pasta do cliente não pode ir para a lixeira", req);
        }
        await svc.from("drive_pastas").delete().eq("empresa_id", ctx.empresaId).eq("pasta_id", acao.arquivo_id);
      }
      await moverParaLixeira(ctx.token, acao.arquivo_id);
      return jsonResponse({ ok: true }, 200, req);
    }
  }
}

async function pastaDoProjeto(req: Request, svc: SupabaseClient, ctx: Contexto, projetoId: string) {
  const { data: projeto } = await svc
    .from("projetos")
    .select("id, nome")
    .eq("id", projetoId)
    .eq("empresa_id", ctx.empresaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!projeto) return safeErrorResponse(404, "Projeto não encontrado", req);

  const [{ data: registradas }, { data: disciplinas }] = await Promise.all([
    svc
      .from("drive_pastas")
      .select("pasta_id, pasta_pai_id, projeto_id, projeto_disciplina_id, nome, para_cliente")
      .eq("projeto_id", projetoId),
    svc.from("projeto_disciplinas").select("id, nome").eq("projeto_id", projetoId).order("ordem_etapa"),
  ]);
  const pastas = (registradas ?? []) as PastaRegistrada[];
  let raiz = pastas.find((p) => p.pasta_pai_id === null) ?? null;

  if (ctx.podeEditar) {
    if (!raiz) {
      const nome = nomeDaPastaDoProjeto(projeto.nome);
      const criada = await criarPasta(ctx.token, nome, ctx.conexao.pasta_raiz_id);
      raiz = { pasta_id: criada.id, pasta_pai_id: null, projeto_id: projetoId, projeto_disciplina_id: null, nome };
      const { error } = await svc
        .from("drive_pastas")
        .insert({ ...raiz, empresa_id: ctx.empresaId, created_by: ctx.userId });
      if (error) {
        // Duas abas abrindo ao mesmo tempo: fica a que chegou primeiro.
        const { data: outra } = await svc
          .from("drive_pastas")
          .select("pasta_id, pasta_pai_id, projeto_id, projeto_disciplina_id, nome, para_cliente")
          .eq("projeto_id", projetoId)
          .is("pasta_pai_id", null)
          .maybeSingle();
        if (!outra) throw error;
        await moverParaLixeira(ctx.token, criada.id).catch(() => undefined);
        raiz = outra as PastaRegistrada;
      }
    }
    for (const d of pastasQueFaltam(disciplinas ?? [], pastas)) {
      const criada = await criarPasta(ctx.token, d.nome, raiz.pasta_id);
      const linha = {
        empresa_id: ctx.empresaId,
        projeto_id: projetoId,
        projeto_disciplina_id: d.id,
        pasta_id: criada.id,
        pasta_pai_id: raiz.pasta_id,
        nome: criada.name,
        created_by: ctx.userId,
      };
      const { error } = await svc.from("drive_pastas").insert(linha);
      if (error) await moverParaLixeira(ctx.token, criada.id).catch(() => undefined);
      else pastas.push(linha);
    }
    // Pasta "Cliente": o que estiver nela aparece no portal do cliente.
    if (!pastas.some((p) => p.para_cliente)) {
      const criada = await criarPasta(ctx.token, NOME_PASTA_CLIENTE, raiz.pasta_id);
      const linha = {
        empresa_id: ctx.empresaId,
        projeto_id: projetoId,
        projeto_disciplina_id: null,
        pasta_id: criada.id,
        pasta_pai_id: raiz.pasta_id,
        nome: criada.name,
        para_cliente: true,
        created_by: ctx.userId,
      };
      const { error } = await svc.from("drive_pastas").insert(linha);
      if (error) await moverParaLixeira(ctx.token, criada.id).catch(() => undefined);
      else pastas.push(linha);
    }
  }

  return jsonResponse({ raiz, pastas }, 200, req);
}
