import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Padrão das Edge Functions (ADR 0056): uma função por endpoint, uniformes por regra
 * compartilhada. Este teste é a régua; função nova que foge dela reprova o PR.
 *
 * 1. Todo handler passa por withSentry/withSentryCron (erro, trace e cron no Sentry).
 * 2. Chamada a serviço de terceiro passa por fetchComTempo (_shared/http.ts): fetch
 *    cru só nos módulos que já põem o próprio signal com tempo limite.
 * 3. Ninguém volta ao corsHeaders estático (removido em 13/10).
 * 4. Função que um usuário pode disparar tem rate limit (ver TEM_RATE_LIMIT). Quem não precisa declara o motivo em SEM_RATE_LIMIT.
 */
const RAIZ = join(process.cwd(), "supabase/functions");

// Módulos com fetch cru e motivo: o próprio helper; IA e healthcheck com AbortSignal
// próprio (timeout por chamada); script local de evals, não publicado.
const FETCH_CRU_PERMITIDO = new Set([
  "_shared/http.ts",
  "_shared/ai-client.ts",
  "_shared/llm.ts",
  "_shared/healthcheck.ts",
  "ai-chat/evals/rodar.ts",
]);

// Função sem rate limit próprio, com o motivo. Webhook, cron e trigger não são disparados
// por usuário; função de ultra admin é fechada por papel e usada por poucas pessoas. Função
// nova de usuário final NÃO entra aqui: usa limitarOuResponder (_shared/db-rate-limit.ts).
const SEM_RATE_LIMIT: Record<string, string> = {
  "asaas-config": "dormente, só admin da empresa, sem chamador",
  "asaas-criar-cobranca": "dormente, só admin da empresa, sem chamador",
  "asaas-webhook": "webhook da Asaas, autenticado por token",
  "auth-email-hook": "chamada pelo Supabase Auth, autenticada por segredo do hook",
  "aviso-ultra-admin-email": "trigger via pg_net, autenticado por segredo",
  "excluir-dados-titular": "só ultra admin (fila LGPD)",
  "exportar-dados-titular": "trigger via pg_net, autenticado por segredo",
  "guardiao-margem-cron": "cron (cronAutorizado)",
  health: "leitura pública sem efeito colateral; Better Stack e smoke de deploy",
  "log-impersonation": "só ultra admin",
  "notificacoes-email-cron": "cron (cronAutorizado)",
  "pilar-checkout-webhook": "webhook da Asaas, autenticado por token",
  "reconciliar-assinaturas": "cron (cronAutorizado)",
  "resend-webhook": "webhook do Resend, assinatura Svix",
  "retencao-pos-trial": "cron (cronAutorizado)",
  "reverificar-documentos-pendentes": "cron (cronAutorizado)",
  "send-data-deletion-notification": "trigger via pg_net, autenticado por segredo",
  "trial-expiry-cron": "cron (cronAutorizado)",
  "ultra-admin-empresas": "só ultra admin",
  "ultra-admin-usuarios": "só ultra admin",
};

// Mecanismos de rate limit do repo: DB atômico (checkDbRateLimit/limitarOuResponder), em
// memória (RateLimiter), por empresa nas funções de IA (checkRateLimit de ai-client) e a RPC
// do convite (check_convite_rate_limit).
const TEM_RATE_LIMIT =
  /checkDbRateLimit|limitarOuResponder|new RateLimiter\(|checkRateLimit\(|check_convite_rate_limit/;

function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return nome.endsWith(".ts") && !nome.endsWith(".test.ts") ? [caminho] : [];
  });
}

const funcoes = readdirSync(RAIZ, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
  .map((d) => d.name);

describe("padrão das Edge Functions (ADR 0056)", () => {
  it("encontrou as funções", () => {
    expect(funcoes.length).toBeGreaterThan(40);
  });

  it("todo handler passa por withSentry ou withSentryCron", () => {
    const sem = funcoes.filter((f) => !/withSentry(Cron)?\(/.test(readFileSync(join(RAIZ, f, "index.ts"), "utf8")));
    expect(sem, "Envolva o handler com withSentry (ou withSentryCron em cron)").toEqual([]);
  });

  it("chamada externa tem tempo limite (fetchComTempo)", () => {
    const cru = arquivos(RAIZ)
      .map((f) => relative(RAIZ, f))
      .filter((f) => !FETCH_CRU_PERMITIDO.has(f))
      .filter((f) => /(^|[^\w.])fetch\(/.test(readFileSync(join(RAIZ, f), "utf8")));
    expect(cru, "Use fetchComTempo de _shared/http.ts").toEqual([]);
  });

  it("função disparável por usuário tem rate limit (ou motivo em SEM_RATE_LIMIT)", () => {
    const sem = funcoes.filter(
      (f) => !(f in SEM_RATE_LIMIT) && !TEM_RATE_LIMIT.test(readFileSync(join(RAIZ, f, "index.ts"), "utf8"))
    );
    expect(sem, "Use limitarOuResponder (_shared/db-rate-limit.ts) ou justifique em SEM_RATE_LIMIT").toEqual([]);
  });

  it("SEM_RATE_LIMIT só lista função que existe e ainda não tem rate limit", () => {
    const obsoletas = Object.keys(SEM_RATE_LIMIT).filter(
      (f) => !funcoes.includes(f) || TEM_RATE_LIMIT.test(readFileSync(join(RAIZ, f, "index.ts"), "utf8"))
    );
    expect(obsoletas, "Tire da lista quem foi removida ou ganhou rate limit").toEqual([]);
  });

  it("ninguém usa o corsHeaders estático", () => {
    const legado = arquivos(RAIZ).filter((f) =>
      /import \{[^}]*\bcorsHeaders\b[^}]*\} from ".*cors\.ts"/.test(readFileSync(f, "utf8"))
    );
    expect(legado.map((f) => relative(RAIZ, f))).toEqual([]);
  });
});
