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
// Sem zod de propósito: este módulo roda no boot de todo usuário, e o zod inteiro
// (~13 kB gzip) entrava na entrada só para validar nove variáveis. As regras abaixo
// são as mesmas que o schema zod fazia; env.test.ts cobre cada uma.

type Campo<T> = (bruto: unknown) => { valor: T } | { erro: string };

/** Vite entrega "" para variável declarada e vazia. Para efeito de config, é ausente. */
function texto(bruto: unknown): string | undefined {
  return typeof bruto === "string" && bruto.trim() !== "" ? bruto.trim() : undefined;
}

function ehUrl(valor: string): boolean {
  try {
    new URL(valor);
    return true;
  } catch {
    return false;
  }
}

const textoObrigatorio =
  (erro: string): Campo<string> =>
  (bruto) => {
    const v = texto(bruto);
    return v ? { valor: v } : { erro };
  };

const urlObrigatoria =
  (erro: string): Campo<string> =>
  (bruto) => {
    const v = texto(bruto);
    return v && ehUrl(v) ? { valor: v } : { erro };
  };

const optionalText: Campo<string | undefined> = (bruto) => ({ valor: texto(bruto) });

const optionalUrl: Campo<string | undefined> = (bruto) => {
  const v = texto(bruto);
  if (v === undefined || ehUrl(v)) return { valor: v };
  return { erro: "precisa ser uma URL completa (https://...)" };
};

// Vazio cai no default em vez de virar 0: `Number("")` é 0, e uma variável declarada
// e vazia desligaria o tracing (0%) sem ninguém pedir.
const taxa: Campo<number | undefined> = (bruto) => {
  const v = texto(bruto);
  if (v === undefined) return { valor: undefined };
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n <= 1 ? { valor: n } : { erro: "precisa ser um número entre 0 e 1" };
};

const taxaComDefault =
  (padrao: number): Campo<number> =>
  (bruto) => {
    const r = taxa(bruto);
    return "erro" in r ? r : { valor: r.valor ?? padrao };
  };

const schema = {
  VITE_SUPABASE_URL: urlObrigatoria("VITE_SUPABASE_URL precisa ser uma URL completa (https://<ref>.supabase.co)"),
  VITE_SUPABASE_PUBLISHABLE_KEY: textoObrigatorio("VITE_SUPABASE_PUBLISHABLE_KEY não pode ser vazia"),

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
  VITE_SENTRY_TRACES_SAMPLE_RATE: taxaComDefault(0.1),
  VITE_SENTRY_TRACES_RATE: taxa,

  VITE_POSTHOG_KEY: optionalText,
  VITE_POSTHOG_HOST: optionalUrl,

  /** Status page externa (SPEC 105). Definida, a rota /status do app redireciona para ela. */
  VITE_STATUS_URL: optionalUrl,

  /** Plataforma de marketing (produto próprio, repo post-automation; SPEC 128). Ausente = URL de produção. */
  VITE_MARKETING_APP_URL: optionalUrl,
};

export type Env = { [K in keyof typeof schema]: (typeof schema)[K] extends Campo<infer T> ? T : never };

function parseEnv(): Env {
  const fonte = import.meta.env as Record<string, unknown>;
  const valores: Record<string, unknown> = {};
  // Uma mensagem com TODAS as chaves problemáticas, não só a primeira: quem está
  // configurando um ambiente novo precisa da lista inteira de uma vez.
  const problemas: string[] = [];

  for (const [chave, campo] of Object.entries(schema) as Array<[string, Campo<unknown>]>) {
    const r = campo(fonte[chave]);
    if ("erro" in r) problemas.push(`  - ${chave}: ${r.erro}`);
    else valores[chave] = r.valor;
  }

  if (problemas.length > 0) {
    throw new Error(
      `Configuração de ambiente inválida. Corrija no .env (ou nas variáveis do deploy):\n${problemas.join("\n")}\n\n` +
        `O .env.example lista todas as chaves esperadas.`
    );
  }

  return valores as Env;
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
