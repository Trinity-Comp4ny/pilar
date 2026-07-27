import { describe, expect, it } from "vitest";

/**
 * O módulo `env.ts` valida no import, então testar o schema exige reimportá-lo com
 * `import.meta.env` alterado. `vi.stubEnv` + `vi.resetModules` dá isso.
 */
import { vi } from "vitest";

/**
 * Todas as chaves do schema, zeradas. Sem isto o teste lê o `.env.local` da máquina
 * (o Vitest carrega os .env do Vite), e o resultado passa a depender da config pessoal
 * de quem roda: aqui o `.env.local` tem VITE_SENTRY_TRACES_SAMPLE_RATE=0, o que fazia
 * o caso do default falhar sem haver nada errado no schema.
 */
const CLEAN: Record<string, string> = {
  VITE_SUPABASE_URL: "",
  VITE_SUPABASE_PUBLISHABLE_KEY: "",
  VITE_TURNSTILE_SITE_KEY: "",
  VITE_SENTRY_DSN: "",
  VITE_SENTRY_ENV: "",
  VITE_SENTRY_TRACES_SAMPLE_RATE: "",
  VITE_SENTRY_TRACES_RATE: "",
  VITE_POSTHOG_KEY: "",
  VITE_POSTHOG_HOST: "",
};

const BASE = {
  VITE_SUPABASE_URL: "https://abc.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "anon-key",
};

async function loadEnv(overrides: Record<string, string | undefined>) {
  vi.resetModules();
  // unstubAllEnvs é obrigatório: resetModules limpa o cache de módulo, não os stubs de
  // env, e sem isto um caso herdava o valor do anterior (o teste do PostHog quebrava
  // porque ainda estava com a taxa "5" do caso de cima).
  vi.unstubAllEnvs();
  for (const [k, v] of Object.entries({ ...CLEAN, ...BASE, ...overrides })) {
    vi.stubEnv(k, v ?? "");
  }
  return await import("./env");
}

describe("env: o que precisa derrubar o boot", () => {
  it("recusa URL do Supabase ausente", async () => {
    await expect(loadEnv({ VITE_SUPABASE_URL: "" })).rejects.toThrow(/VITE_SUPABASE_URL/);
  });

  it("recusa URL do Supabase que não é URL", async () => {
    await expect(loadEnv({ VITE_SUPABASE_URL: "abc.supabase.co" })).rejects.toThrow(/URL completa/);
  });

  it("recusa anon key vazia", async () => {
    await expect(loadEnv({ VITE_SUPABASE_PUBLISHABLE_KEY: "" })).rejects.toThrow(/PUBLISHABLE_KEY/);
  });

  it("lista TODOS os problemas de uma vez, não só o primeiro", async () => {
    await expect(loadEnv({ VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "" })).rejects.toThrow(
      /VITE_SUPABASE_URL[\s\S]*VITE_SUPABASE_PUBLISHABLE_KEY/
    );
  });
});

describe("env: o que NÃO pode derrubar o boot", () => {
  it("sobe sem captcha, sem Sentry e sem PostHog", async () => {
    const { env } = await loadEnv({});
    expect(env.VITE_SUPABASE_URL).toBe("https://abc.supabase.co");
    expect(env.VITE_TURNSTILE_SITE_KEY).toBeUndefined();
  });

  it("mas anuncia cada ausência que degrada o produto", async () => {
    const { envWarnings } = await loadEnv({});
    const avisos = envWarnings().join(" ");
    expect(avisos).toMatch(/TURNSTILE.*SEM captcha/);
    expect(avisos).toMatch(/SENTRY_DSN/);
    expect(avisos).toMatch(/POSTHOG_KEY/);
  });

  it("não avisa nada quando tudo está configurado", async () => {
    const { envWarnings } = await loadEnv({
      VITE_TURNSTILE_SITE_KEY: "site-key",
      VITE_SENTRY_DSN: "https://x@o1.ingest.sentry.io/1",
      VITE_POSTHOG_KEY: "phc_x",
    });
    expect(envWarnings()).toEqual([]);
  });
});

describe("env: sample rate do Sentry", () => {
  it("usa 0.1 por default", async () => {
    const { sentryTracesSampleRate } = await loadEnv({});
    expect(sentryTracesSampleRate).toBe(0.1);
  });

  it("coage string para número", async () => {
    const { sentryTracesSampleRate } = await loadEnv({ VITE_SENTRY_TRACES_SAMPLE_RATE: "0.25" });
    expect(sentryTracesSampleRate).toBe(0.25);
  });

  it("aceita o nome legado VITE_SENTRY_TRACES_RATE com precedência", async () => {
    const { sentryTracesSampleRate } = await loadEnv({
      VITE_SENTRY_TRACES_SAMPLE_RATE: "0.2",
      VITE_SENTRY_TRACES_RATE: "0.9",
    });
    expect(sentryTracesSampleRate).toBe(0.9);
  });

  it("recusa taxa fora de 0..1", async () => {
    await expect(loadEnv({ VITE_SENTRY_TRACES_SAMPLE_RATE: "5" })).rejects.toThrow();
  });
});

describe("env: string vazia é ausência, não valor", () => {
  it("trata PostHog host vazio como não configurado", async () => {
    const { env } = await loadEnv({ VITE_POSTHOG_HOST: "" });
    expect(env.VITE_POSTHOG_HOST).toBeUndefined();
  });

  it("recusa PostHog host que não é URL", async () => {
    await expect(loadEnv({ VITE_POSTHOG_HOST: "nao-e-url" })).rejects.toThrow();
  });
});
