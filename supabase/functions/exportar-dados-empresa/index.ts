/**
 * exportar-dados-empresa: cópia dos dados da empresa em CSV (zip), para o admin levar
 * os dados mesmo com a assinatura suspensa.
 *
 * Deploy: supabase functions deploy exportar-dados-empresa
 * (JWT obrigatório; só admin da própria empresa; sessão com até 15 min.)
 *
 * Corpo: {}. Resposta: { url, expira_em, arquivo, tabelas }.
 * O zip fica no bucket privado empresa-exportacoes (sem policy: só a service role lê) e o
 * admin baixa por link assinado de 10 minutos. Só a última cópia de cada empresa é mantida.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { strToU8, zipSync } from "https://esm.sh/fflate@0.8.2";
import { jsonResponse, optionsResponse, recusarAppExterno } from "../_shared/cors.ts";
import { ehAdminDaEmpresa } from "../_shared/admin-auth.ts";
import { logAction } from "../_shared/audit.ts";
import { limitarOuResponder } from "../_shared/db-rate-limit.ts";
import { createLogger } from "../_shared/logger.ts";
import { withSentry } from "../_shared/sentry.ts";
import {
  iatDoToken,
  LIMITE_LINHAS_POR_TABELA,
  LIMITE_LINHAS_TOTAL,
  limparLinha,
  linhaVisivel,
  montarLeiaMe,
  nomeDoArquivo,
  paraCsv,
  type ResumoTabela,
  sessaoRecente,
  TABELAS_EXPORTADAS,
} from "./exportacao.ts";

const log = createLogger("exportar-dados-empresa");

const BUCKET = "empresa-exportacoes";
const VALIDADE_S = 10 * 60;
const PAGINA = 1000;

type Linha = Record<string, unknown>;

/** Lê a tabela da empresa em páginas, até o teto. Erro de consulta vira tabela indisponível. */
async function lerTabela(
  admin: SupabaseClient,
  tabela: string,
  empresaId: string,
  restante: number
): Promise<{ linhas: Linha[]; truncada: boolean; erro: boolean }> {
  const teto = Math.min(LIMITE_LINHAS_POR_TABELA, restante);
  const linhas: Linha[] = [];
  for (let de = 0; de < teto; de += PAGINA) {
    const ate = Math.min(de + PAGINA, teto) - 1;
    const { data, error } = await admin.from(tabela).select("*").eq("empresa_id", empresaId).order("id").range(de, ate);
    if (error) return { linhas: [], truncada: false, erro: true };
    const lote = (data ?? []) as Linha[];
    linhas.push(...lote);
    if (lote.length < ate - de + 1) return { linhas, truncada: false, erro: false };
  }
  // Chegou no teto: confere se ainda havia mais.
  const { count } = await admin.from(tabela).select("id", { count: "exact", head: true }).eq("empresa_id", empresaId);
  return { linhas, truncada: (count ?? 0) > linhas.length, erro: false };
}

serve(
  withSentry("exportar-dados-empresa", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405, req);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "Token obrigatório" }, 401, req);

    const userClient = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) return jsonResponse({ error: "Não autenticado" }, 401, req);

    // Token de app externo (ChatGPT, Claude) é só leitura e só pelo conector (SPEC 151).
    const appExterno = recusarAppExterno(req);
    if (appExterno) return appExterno;

    // O papel vem do banco, nunca do JWT.
    const { data: profile } = await admin
      .from("profiles")
      .select("empresa_id, role, email")
      .eq("id", user.id)
      .maybeSingle();
    if (!ehAdminDaEmpresa(profile)) {
      return jsonResponse({ error: "Apenas admin da empresa pode exportar os dados" }, 403, req);
    }

    // Porta de saída dos dados: exige login recente (vale para senha, Google e MFA).
    if (!sessaoRecente(iatDoToken(authHeader), Date.now())) {
      return jsonResponse({ error: "Entre de novo para exportar os dados.", codigo: "reautenticar" }, 401, req);
    }

    const limite = await limitarOuResponder(admin, req, {
      bucket: "exportar_dados_empresa",
      key: `empresa:${profile.empresa_id}`,
      max: 3,
      windowSeconds: 3600,
    });
    if (limite) return limite;

    const empresaId = profile.empresa_id;
    const { data: empresa } = await admin.from("empresas").select("nome").eq("id", empresaId).maybeSingle();
    const empresaNome = (empresa?.nome as string | undefined) ?? "empresa";
    const agora = new Date();

    try {
      const arquivos: Record<string, Uint8Array> = {};
      const resumo: ResumoTabela[] = [];
      let total = 0;

      for (const tabela of TABELAS_EXPORTADAS) {
        const restante = LIMITE_LINHAS_TOTAL - total;
        if (restante <= 0) {
          resumo.push({ tabela, linhas: 0, truncada: true });
          continue;
        }
        const lida = await lerTabela(admin, tabela, empresaId, restante);
        if (lida.erro) {
          // Tabela ausente neste ambiente ou sem a coluna empresa_id: aparece no LEIA-ME.
          log.warn("tabela não exportada", { tabela });
          resumo.push({ tabela, linhas: 0, truncada: false, indisponivel: true });
          continue;
        }
        const visiveis = lida.linhas.filter(linhaVisivel).map(limparLinha);
        total += visiveis.length;
        resumo.push({ tabela, linhas: visiveis.length, truncada: lida.truncada });
        if (visiveis.length) arquivos[`${tabela}.csv`] = strToU8(paraCsv(visiveis));
      }

      arquivos["LEIA-ME.txt"] = strToU8(
        montarLeiaMe({
          empresaNome,
          geradoEm: agora.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
          resumo,
        })
      );
      const zip = zipSync(arquivos, { level: 6 });

      // Só a última cópia da empresa fica guardada.
      const { data: antigos } = await admin.storage.from(BUCKET).list(empresaId);
      if (antigos?.length) {
        await admin.storage.from(BUCKET).remove(antigos.map((a) => `${empresaId}/${a.name}`));
      }
      const caminho = `${empresaId}/${agora.getTime()}.zip`;
      const { error: upErr } = await admin.storage
        .from(BUCKET)
        .upload(caminho, new Blob([zip], { type: "application/zip" }), { upsert: true });
      if (upErr) throw new Error(`upload: ${upErr.message}`);

      const arquivo = nomeDoArquivo(empresaNome, agora);
      const { data: assinado, error: urlErr } = await admin.storage
        .from(BUCKET)
        .createSignedUrl(caminho, VALIDADE_S, { download: arquivo });
      if (urlErr || !assinado?.signedUrl) throw new Error(`signed url: ${urlErr?.message ?? "vazio"}`);

      await logAction(admin, {
        actorId: user.id,
        actorEmail: (profile.email as string | null) ?? user.email ?? "",
        actorRole: profile.role === "ultra_admin" ? "ultra_admin" : "admin",
        action: "exportar_dados_empresa",
        category: "empresa",
        targetType: "empresa",
        targetId: empresaId,
        targetName: empresaNome,
        empresaId,
        metadata: { linhas: total, tabelas: resumo.filter((r) => r.linhas > 0).length, bytes: zip.length },
        req,
      });

      log.info("exportação entregue", { empresa_id: empresaId, linhas: total, bytes: zip.length });
      return jsonResponse(
        {
          url: assinado.signedUrl,
          expira_em: new Date(agora.getTime() + VALIDADE_S * 1000).toISOString(),
          arquivo,
          tabelas: resumo.filter((r) => r.linhas > 0).length,
          linhas: total,
        },
        200,
        req
      );
    } catch (err) {
      log.error("exportação da empresa falhou", err);
      return jsonResponse({ error: "Falha ao gerar a exportação. Tente de novo em instantes." }, 500, req);
    }
  })
);
