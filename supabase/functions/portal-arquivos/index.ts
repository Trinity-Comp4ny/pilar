/**
 * Arquivos do projeto no portal do cliente (SPEC 163 e 164).
 *
 *   listar  conteúdo da pasta do cliente no Drive (ou de uma subpasta dela) e, na raiz,
 *           os links do projeto marcados para o cliente (valem com ou sem Drive)
 *   baixar  arquivo de dentro dessa árvore; documento do Google sai como PDF
 *
 * Público (verify_jwt = false): o cliente entra com a sessão do portal (session_token),
 * validada por portal_verify_session_readonly, que não rotaciona o token. Só serve
 * projeto do cliente da sessão e só o que está sob a pasta marcada com para_cliente.
 * O binário passa por aqui porque o cliente não tem acesso ao Drive do escritório.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withSentry } from "../_shared/sentry.ts";
import { getCorsHeaders, jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { checkDbRateLimit, getClientKey } from "../_shared/db-rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { lerJson } from "../_shared/schemas.ts";
import { baixar, ErroGoogle, exportarPdf, listarFilhos, metadados, MIME_PASTA } from "../_shared/google-drive.ts";
import { acessoDaConexao, ambienteDrive, carregarConexao } from "../_shared/google-drive-conexao.ts";
import { lerAcao } from "./entrada.ts";
import { caminhoAte, dentroDaPastaDoCliente } from "./arvore.ts";
import { linksDoCliente } from "./links.ts";

const log = createLogger("portal-arquivos");

interface PastaDoProjeto {
  pasta_id: string;
  pasta_pai_id: string | null;
  nome: string;
  para_cliente: boolean;
}

serve(
  withSentry("portal-arquivos", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const svc = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    // Público e por token: limite por IP para ninguém varrer projeto_id/arquivo_id.
    const rl = await checkDbRateLimit(svc, {
      bucket: "portal_arquivos",
      key: getClientKey(req),
      max: 120,
      windowSeconds: 60,
    });
    if (rl.rpcError) return safeErrorResponse(503, "Serviço temporariamente indisponível", req);
    if (!rl.allowed) return safeErrorResponse(429, "Muitas tentativas. Aguarde antes de tentar novamente.", req);

    const entrada = lerAcao(await lerJson(req));
    if (!entrada.ok) return safeErrorResponse(400, entrada.error, req);
    const acao = entrada.data;

    const anon = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");
    const { data: sessao, error: erroSessao } = await anon.rpc("portal_verify_session_readonly", {
      p_token: acao.session_token,
    });
    const empresaId = (sessao as { empresa_id?: string } | null)?.empresa_id;
    const clienteId = (sessao as { cliente_id?: string } | null)?.cliente_id;
    if (erroSessao || !empresaId || !clienteId) return safeErrorResponse(401, "Sessão inválida", req);

    // O projeto precisa ser deste cliente, não só da mesma empresa.
    const { data: projeto } = await svc
      .from("projetos")
      .select("id, links")
      .eq("id", acao.projeto_id)
      .eq("empresa_id", empresaId)
      .eq("cliente_id", clienteId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!projeto) return safeErrorResponse(404, "Projeto não encontrado", req);

    const amb = ambienteDrive();
    const conexao = amb ? await carregarConexao(svc, empresaId) : null;
    const pastas = await pastasDoProjeto(svc, acao.projeto_id);
    const raiz = pastas.find((p) => p.para_cliente);
    // Links para o cliente só na raiz (dentro de uma subpasta é só arquivo).
    const links = acao.acao === "listar" && !acao.pasta_id ? linksDoCliente(projeto.links) : [];
    // Sem Drive conectado ou sem pasta do cliente: só os links (o bloco some se não houver nada).
    if (!amb || !conexao || !raiz) return jsonResponse({ pasta: null, itens: [], links }, 200, req);

    try {
      const token = await acessoDaConexao(amb, conexao);

      if (acao.acao === "listar") {
        const pastaId = acao.pasta_id ?? raiz.pasta_id;
        if (!dentroDaPastaDoCliente(pastaId, raiz.pasta_id, pastas)) {
          return safeErrorResponse(404, "Pasta não encontrada", req);
        }
        const itens = (await listarFilhos(token, pastaId))
          // Subpasta só aparece se estiver registrada (criada pela Pilar dentro da árvore).
          .filter((i) => i.mimeType !== MIME_PASTA || dentroDaPastaDoCliente(i.id, raiz.pasta_id, pastas))
          .map(({ id, name, mimeType, size, modifiedTime }) => ({ id, name, mimeType, size, modifiedTime }));
        return jsonResponse(
          { pasta: { id: pastaId }, caminho: caminhoAte(pastaId, raiz.pasta_id, pastas), itens, links },
          200,
          req
        );
      }

      // baixar
      const meta = await metadados(token, acao.arquivo_id);
      const daArvore = (meta.parents ?? []).some((pai) => dentroDaPastaDoCliente(pai, raiz.pasta_id, pastas));
      if (!daArvore || meta.mimeType === MIME_PASTA) return safeErrorResponse(404, "Arquivo não encontrado", req);

      const documentoGoogle = meta.mimeType.startsWith("application/vnd.google-apps.");
      const r = documentoGoogle ? await exportarPdf(token, meta.id) : await baixar(token, meta.id);
      const nome = documentoGoogle ? `${meta.name}.pdf` : meta.name;
      return new Response(r.body, {
        status: 200,
        headers: {
          ...getCorsHeaders(req),
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
        },
      });
    } catch (e) {
      if (e instanceof ErroGoogle && e.status === 404) return safeErrorResponse(404, "Arquivo não encontrado", req);
      log.error("falha ao servir arquivo do portal", e, { acao: acao.acao, empresa_id: empresaId });
      return safeErrorResponse(502, "Não foi possível abrir os arquivos agora. Tente de novo.", req);
    }
  })
);

async function pastasDoProjeto(svc: SupabaseClient, projetoId: string): Promise<PastaDoProjeto[]> {
  const { data } = await svc
    .from("drive_pastas")
    .select("pasta_id, pasta_pai_id, nome, para_cliente")
    .eq("projeto_id", projetoId);
  return (data ?? []) as PastaDoProjeto[];
}
