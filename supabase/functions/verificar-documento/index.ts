import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withSentry } from "../_shared/sentry.ts";
import { jsonResponse, optionsResponse, safeErrorResponse } from "../_shared/cors.ts";
import { RateLimiter, getRateLimitKey } from "../_shared/rate-limiter.ts";
import { requireAdmin } from "../_shared/admin-auth.ts";
import { createLogger } from "../_shared/logger.ts";
import {
  apenasDigitos,
  detectarTipoDocumento,
  validarDigitoCnpj,
  validarDigitoCpf,
  consultarCnpjBrasilApi,
  situacaoPermiteSubirNivel,
} from "./documento.ts";

// SPEC 098 Fase 1, requisitos 11-13: sobe a empresa pra Prata informando
// CNPJ (verificado na Receita via BrasilAPI) ou CPF (só dígito verificador,
// sem API pública gratuita). Só admin/owner/ultra_admin da própria empresa
// aciona; CNPJ/CPF único entre empresas é garantido pelo índice do banco
// (empresas_cnpj_unico), aqui só traduzimos a violação numa mensagem clara.

const log = createLogger("verificar-documento");
const limiter = new RateLimiter(10, 60_000); // 10/min por usuário: documento não é ação de burst

serve(
  withSentry("verificar-documento", async (req) => {
    if (req.method === "OPTIONS") return optionsResponse(req);
    if (req.method !== "POST") return safeErrorResponse(405, "Method not allowed", req);

    const admin = await requireAdmin(req);
    if (admin.error) return admin.error;
    const { svc, empresaId } = admin;

    if (!empresaId) return safeErrorResponse(403, "Admin must belong to a company", req);

    const key = getRateLimitKey(req);
    if (!limiter.allow(key)) {
      return safeErrorResponse(429, "Rate limit excedido", req);
    }

    const body = (await req.json().catch(() => ({}))) as { documento?: string };
    const digits = apenasDigitos(body.documento ?? "");
    const tipo = detectarTipoDocumento(digits);

    if (!tipo) {
      return jsonResponse({ error: "Documento inválido: informe um CNPJ (14 dígitos) ou CPF (11 dígitos)" }, 400, req);
    }

    if (tipo === "cnpj") {
      if (!validarDigitoCnpj(digits)) {
        return jsonResponse({ error: "CNPJ inválido" }, 400, req);
      }

      const consulta = await consultarCnpjBrasilApi(digits);

      if (consulta.status === "indisponivel") {
        // BrasilAPI fora do ar / mudou de formato: sobe a Prata como `pendente`,
        // sem travar o usuário por um terceiro caído. Cron reverifica depois.
        const { error } = await svc
          .from("empresas")
          .update({
            cnpj: digits,
            documento_tipo: "cnpj",
            documento_verificacao: "pendente",
            documento_verificado_em: new Date().toISOString(),
          })
          .eq("id", empresaId);

        if (error) {
          if (error.code === "23505") {
            return jsonResponse({ error: "Este CNPJ já tem uma conta no Pilar." }, 409, req);
          }
          log.error("update empresas (cnpj pendente) failed", error, { empresa_id: empresaId });
          return safeErrorResponse(500, "Falha ao salvar o CNPJ", req);
        }

        return jsonResponse({ status: "pendente", nivel: "prata" }, 200, req);
      }

      if (!situacaoPermiteSubirNivel(consulta.info.situacaoCadastral)) {
        return jsonResponse(
          {
            error: `Este CNPJ está com situação "${consulta.info.situacaoCadastral}" na Receita. Só CNPJ ativo libera o próximo nível.`,
          },
          422,
          req
        );
      }

      const { data: empresaAtual } = await svc.from("empresas").select("nome").eq("id", empresaId).maybeSingle();
      const razaoDivergente = !!empresaAtual?.nome && empresaAtual.nome.trim().toUpperCase() !== consulta.info.razaoSocial.trim().toUpperCase();

      const { error } = await svc
        .from("empresas")
        .update({
          cnpj: digits,
          documento_tipo: "cnpj",
          documento_verificacao: "verificado",
          documento_verificado_em: new Date().toISOString(),
          razao_social: consulta.info.razaoSocial,
          situacao_cadastral: consulta.info.situacaoCadastral,
          cnae_principal: consulta.info.cnaePrincipal,
        })
        .eq("id", empresaId);

      if (error) {
        if (error.code === "23505") {
          return jsonResponse({ error: "Este CNPJ já tem uma conta no Pilar." }, 409, req);
        }
        log.error("update empresas (cnpj verificado) failed", error, { empresa_id: empresaId });
        return safeErrorResponse(500, "Falha ao salvar o CNPJ", req);
      }

      if (razaoDivergente) {
        log.warn("razão social divergente do nome cadastrado", {
          empresa_id: empresaId,
          nome_cadastrado: empresaAtual?.nome,
          razao_social_receita: consulta.info.razaoSocial,
        });
      }

      return jsonResponse(
        { status: "verificado", nivel: "prata", razao_social: consulta.info.razaoSocial, alerta_divergencia: razaoDivergente },
        200,
        req
      );
    }

    // CPF: sem verificação externa (sem API pública gratuita), só dígito.
    if (!validarDigitoCpf(digits)) {
      return jsonResponse({ error: "CPF inválido" }, 400, req);
    }

    const { error } = await svc
      .from("empresas")
      .update({
        cnpj: digits,
        documento_tipo: "cpf",
        documento_verificacao: "sem_verificacao_externa",
        documento_verificado_em: new Date().toISOString(),
      })
      .eq("id", empresaId);

    if (error) {
      if (error.code === "23505") {
        return jsonResponse({ error: "Este CPF já tem uma conta no Pilar." }, 409, req);
      }
      log.error("update empresas (cpf) failed", error, { empresa_id: empresaId });
      return safeErrorResponse(500, "Falha ao salvar o CPF", req);
    }

    return jsonResponse({ status: "sem_verificacao_externa", nivel: "prata" }, 200, req);
  })
);
