/**
 * Único ponto do app que lê `import.meta.env.VITE_*`.
 *
 * Antes disto havia 23 leituras espalhadas por 12 arquivos, várias com `as string`
 * sem validação nenhuma. Quando a variável faltava, o valor era `undefined` tipado
 * como string e a falha aparecia longe da causa: uma chamada para
 * `undefined/functions/v1/...`, ou o captcha simplesmente ausente da tela de login
 * sem nenhum erro. Quatro variáveis usadas no código nem estavam no `.env.example`
 * (`VITE_TURNSTILE_SITE_KEY`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` e o nome
 * divergente `VITE_SENTRY_TRACES_RATE`).
 *
 * Duas categorias, de propósito:
 *
 * - **Fatal**: sem URL e chave do Supabase o app não tem o que fazer. Já era o
 *   comportamento em `supabase.ts`; aqui só ganhou mensagem melhor.
 * - **Degradação anunciada**: captcha, Sentry e PostHog ausentes não impedem o app de
 *   funcionar, e transformar isso em fatal derrubaria um deploy que hoje sobe. Mas
 *   deixar passar em silêncio é o que permitiu a tela de login rodar sem captcha sem
 *   ninguém notar. Então: `envWarnings()` devolve a lista, e `main.tsx` a reporta no
 *   Sentry no boot. Deixa de ser silencioso sem virar indisponibilidade.
 *
 * `DEV`, `PROD` e `MODE` continuam vindo direto do Vite: são do bundler, não config.
 */
import { z } from "zod";

/** Vite entrega "" para variável declarada e vazia. Para efeito de config, é ausente. */
const optionalText = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().trim().min(1).optional()
);

const optionalUrl = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
  z.string().url().optional()
);

const schema = z.object({
  VITE_SUPABASE_URL: z.string().url("VITE_SUPABASE_URL precisa ser uma URL completa (https://<ref>.supabase.co)"),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1, "VITE_SUPABASE_PUBLISHABLE_KEY não pode ser vazia"),

  /** Ausente = login sobe sem captcha. Ver envWarnings(). */
  VITE_TURNSTILE_SITE_KEY: optionalText,

  VITE_SENTRY_DSN: optionalText,
  VITE_SENTRY_ENV: optionalText,
  /**
   * Aceita os dois nomes que existiam no código: monitoring.ts lia
   * `VITE_SENTRY_TRACES_RATE ?? VITE_SENTRY_TRACES_SAMPLE_RATE`, e só o segundo estava
   * documentado. O canônico é _SAMPLE_RATE; o outro segue aceito para não quebrar
   * ambiente já configurado.
   */
  // O preprocess não é zelo: `z.coerce.number()` converte "" para 0, então uma
  // variável declarada e vazia desligaria o tracing (0%) em vez de cair no default.
  VITE_SENTRY_TRACES_SAMPLE_RATE: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().min(0).max(1).default(0.1)
  ),
  VITE_SENTRY_TRACES_RATE: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.coerce.number().min(0).max(1).optional()
  ),

  VITE_POSTHOG_KEY: optionalText,
  VITE_POSTHOG_HOST: optionalUrl,
});

export type Env = z.infer<typeof schema>;

function parseEnv(): Env {
  const parsed = schema.safeParse(import.meta.env);

  if (!parsed.success) {
    // Uma mensagem com TODAS as chaves problemáticas, não só a primeira: quem está
    // configurando um ambiente novo precisa da lista inteira de uma vez.
    const problemas = parsed.error.issues.map((i) => `  - ${i.path.join(".") || "(raiz)"}: ${i.message}`).join("\n");
    throw new Error(
      `Configuração de ambiente inválida. Corrija no .env (ou nas variáveis do deploy):\n${problemas}\n\n` +
        `O .env.example lista todas as chaves esperadas.`
    );
  }

  return parsed.data;
}

export const env: Env = parseEnv();

/** Taxa de sample do Sentry, resolvendo o nome legado. */
export const sentryTracesSampleRate: number = env.VITE_SENTRY_TRACES_RATE ?? env.VITE_SENTRY_TRACES_SAMPLE_RATE;

/**
 * Config ausente que degrada o produto sem impedir o boot. Chamado no boot para que
 * apareça no Sentry em vez de ficar invisível.
 */
export function envWarnings(): string[] {
  const avisos: string[] = [];

  if (!env.VITE_TURNSTILE_SITE_KEY) {
    avisos.push("VITE_TURNSTILE_SITE_KEY ausente: a tela de login sobe SEM captcha.");
  }
  if (!env.VITE_SENTRY_DSN) {
    avisos.push("VITE_SENTRY_DSN ausente: erros de runtime não são reportados.");
  }
  if (!env.VITE_POSTHOG_KEY) {
    avisos.push("VITE_POSTHOG_KEY ausente: analytics de produto desligado.");
  }

  return avisos;
}
