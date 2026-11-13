import { describe, expect, it } from "vitest";
// @ts-expect-error módulo .mjs sem tipos
import { caminhoProibido, classificarRuido, lerVeredito, sanitizarTexto, selecionar } from "./lib.mjs";

describe("classificarRuido", () => {
  it.each([
    "TypeError: Failed to fetch",
    "TypeError: Load failed",
    "AuthRetryableFetchError: Failed to fetch",
    "TypeError: Failed to fetch dynamically imported module: https://x/assets/a.js",
    "SupabaseRequestError: POST auth/v1/token → 400 (refresh_token_not_found)",
    "SupabaseRequestError: POST auth/v1/factors/x/verify → 422 (mfa_verification_failed)",
    "Error: Falha ao criar assinatura: Asaas: Transação não autorizada. Verifique os dados",
  ])("%s é ruído", (titulo) => {
    expect(classificarRuido(titulo)).not.toBeNull();
  });

  it.each([
    "SupabaseRequestError: HEAD rest/v1/projetos → 403",
    'Error: new row violates row-level security policy for table "estimativas_obra"',
    "Error: Resend 409: invalid_idempotent_request",
    "TypeError: Cannot read properties of undefined (reading 'default')",
  ])("%s não é ruído", (titulo) => {
    expect(classificarRuido(titulo)).toBeNull();
  });
});

describe("caminhoProibido", () => {
  it.each([".github/workflows/ci.yml", "scripts/sentry-triagem/sentry.mjs", "package.json", "package-lock.json", ".env.local", "vercel.json", ".claude/settings.json"])(
    "barra %s",
    (c) => expect(caminhoProibido(c)).toBe(true),
  );
  it.each(["src/pages/obras/Obra.tsx", "supabase/functions/_shared/email/client.ts", "supabase/migrations/20261113_x.sql"])("libera %s", (c) =>
    expect(caminhoProibido(c)).toBe(false),
  );
});

describe("sanitizarTexto", () => {
  it("tira controle e corta", () => {
    expect(sanitizarTexto("a\u0000b\n\nc")).toBe("ab c");
    expect(sanitizarTexto("x".repeat(500), 10)).toBe(`${"x".repeat(10)}…`);
  });
});

describe("lerVeredito", () => {
  it("aceita corrigir completo", () => {
    const v = lerVeredito(JSON.stringify({ acao: "corrigir", motivo: "RLS faltando", titulo_pr: "fix(obras): allow update" }));
    expect(v.acao).toBe("corrigir");
  });
  it("rejeita ação desconhecida, JSON ruim e corrigir sem título", () => {
    expect(() => lerVeredito("{")).toThrow();
    expect(() => lerVeredito(JSON.stringify({ acao: "apagar", motivo: "x" }))).toThrow(/acao/);
    expect(() => lerVeredito(JSON.stringify({ acao: "corrigir", motivo: "x" }))).toThrow(/titulo_pr/);
  });
});

describe("selecionar", () => {
  const mk = (shortId: string, title: string, userCount = 0, count = 1) => ({ shortId, title, userCount, count });
  it("separa ruído, pula tratadas, ordena por usuários e limita", () => {
    const r = selecionar(
      [mk("A", "TypeError: Failed to fetch"), mk("B", "Erro B", 1, 5), mk("C", "Erro C", 9, 2), mk("D", "Erro D", 0, 50), mk("E", "Erro E", 3, 1)],
      { jaTratadas: new Set(["E"]), max: 2 },
    );
    expect(r.ruido.map((x: { issue: { shortId: string } }) => x.issue.shortId)).toEqual(["A"]);
    expect(r.candidatas.map((x: { shortId: string }) => x.shortId)).toEqual(["C", "B"]);
  });
});
