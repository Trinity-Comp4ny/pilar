/**
 * Leitura do PostHog para o agente Produto (SPEC 130). Só leitura, por consulta HogQL, com chave
 * própria (POSTHOG_PERSONAL_API_KEY, escopo "Query: read"), nunca a chave pública do app.
 *
 * Complementa o `ops_produto` (que conta escritórios que mexeram em cada área no banco) com o uso
 * real do app: quem entrou, em que telas, e onde apareceu erro. O PostHog só recebe quem aceitou a
 * análise de uso, então estes números são de quem aceitou, não da base inteira: o resumo diz isso.
 *
 * Sem chave o agente segue só com o banco (e avisa no resumo). Resposta fora do contrato vira erro
 * claro (validação na fronteira), não número errado no painel.
 */
import { z } from "../_shared/schemas.ts";

export type ConfigPosthog = { chave: string; host: string; projeto: string };

export const SEM_CHAVE_POSTHOG =
  "PostHog não configurado: falta o secret POSTHOG_PERSONAL_API_KEY nas Edge Functions (escopo Query: read).";

/** Null sem chave: o agente Produto segue sem o PostHog em vez de falhar. */
export function configPosthog(env: (k: string) => string | undefined): ConfigPosthog | null {
  const chave = env("POSTHOG_PERSONAL_API_KEY")?.trim();
  if (!chave) return null;
  return {
    chave,
    host: (env("POSTHOG_API_HOST") || "https://us.posthog.com").replace(/\/+$/, ""),
    projeto: env("POSTHOG_PROJECT_ID") || "679166",
  };
}

export type UsoPosthog = {
  logins_7d: number;
  escritorios_logaram_7d: number;
  pessoas_logaram_7d: number;
  erros_exibidos_28d: number;
  telas: Array<{ modulo: string; vezes: number }>;
  erros: Array<{ contexto: string; vezes: number }>;
};

type Buscar = typeof fetch;

const respostaSchema = z.object({ results: z.array(z.array(z.unknown())) });

async function consultar(cfg: ConfigPosthog, hogql: string, buscar: Buscar): Promise<unknown[][]> {
  const r = await buscar(`${cfg.host}/api/projects/${cfg.projeto}/query/`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
  });
  if (r.status === 401 || r.status === 403) {
    throw new Error(`PostHog recusou a chave (${r.status}): confira o POSTHOG_PERSONAL_API_KEY e o escopo Query: read.`);
  }
  if (!r.ok) throw new Error(`PostHog respondeu ${r.status}`);
  const lida = respostaSchema.safeParse(await r.json());
  if (!lida.success) throw new Error("resposta do PostHog fora do contrato");
  return lida.data.results;
}

const num = (v: unknown): number => Number(v) || 0;

const TOTAIS = `
SELECT
  countIf(event = 'login_realizado' AND timestamp > now() - INTERVAL 7 DAY),
  uniqIf(properties.empresa_id, event = 'login_realizado' AND timestamp > now() - INTERVAL 7 DAY),
  uniqIf(person_id, event = 'login_realizado' AND timestamp > now() - INTERVAL 7 DAY),
  countIf(event = 'erro_exibido')
FROM events
WHERE timestamp > now() - INTERVAL 28 DAY`;

const TELAS = `
SELECT properties.modulo AS modulo, count() AS vezes
FROM events
WHERE event = '$pageview' AND timestamp > now() - INTERVAL 28 DAY AND properties.modulo IS NOT NULL
GROUP BY modulo ORDER BY vezes DESC LIMIT 10`;

const ERROS = `
SELECT properties.contexto AS contexto, count() AS vezes
FROM events
WHERE event = 'erro_exibido' AND timestamp > now() - INTERVAL 28 DAY AND properties.contexto IS NOT NULL
GROUP BY contexto ORDER BY vezes DESC LIMIT 5`;

export async function usoDoPosthog(cfg: ConfigPosthog, buscar: Buscar = fetch): Promise<UsoPosthog> {
  const [totais, telas, erros] = await Promise.all([
    consultar(cfg, TOTAIS, buscar),
    consultar(cfg, TELAS, buscar),
    consultar(cfg, ERROS, buscar),
  ]);
  const t = totais[0] ?? [];
  return {
    logins_7d: num(t[0]),
    escritorios_logaram_7d: num(t[1]),
    pessoas_logaram_7d: num(t[2]),
    erros_exibidos_28d: num(t[3]),
    telas: telas.map((l) => ({ modulo: String(l[0]), vezes: num(l[1]) })),
    erros: erros.map((l) => ({ contexto: String(l[0]), vezes: num(l[1]) })),
  };
}

/** Indicadores numéricos (a janela vai no nome, como nos demais agentes). */
export function indicadoresPosthog(u: UsoPosthog): Record<string, number> {
  return {
    logins_7d: u.logins_7d,
    escritorios_logaram_7d: u.escritorios_logaram_7d,
    pessoas_logaram_7d: u.pessoas_logaram_7d,
    erros_exibidos_28d: u.erros_exibidos_28d,
    ...Object.fromEntries(u.telas.map((t) => [`telas_vistas_28d_${t.modulo}`, t.vezes])),
  };
}

/** Frase para o resumo do painel. Deixa claro que o PostHog só vê quem aceitou a análise. */
export function resumoPosthog(u: UsoPosthog | null, aviso?: string): string {
  if (!u) return `PostHog fora desta rodada: ${aviso ?? SEM_CHAVE_POSTHOG}`;
  if (u.logins_7d === 0 && u.telas.length === 0) {
    return "PostHog sem uso do app ainda: ninguém aceitou a análise de uso ou o aviso novo não chegou à produção.";
  }
  const pessoas = `${u.pessoas_logaram_7d} ${u.pessoas_logaram_7d === 1 ? "pessoa" : "pessoas"}`;
  const escritorios = `${u.escritorios_logaram_7d} ${u.escritorios_logaram_7d === 1 ? "escritório" : "escritórios"}`;
  const telas = u.telas.slice(0, 3).map((t) => `${t.modulo} (${t.vezes})`);
  const trava = u.erros[0] ? ` Onde mais apareceu erro: ${u.erros[0].contexto} (${u.erros[0].vezes}).` : "";
  return (
    `PostHog (só quem aceitou a análise): ${pessoas} de ${escritorios} entraram em 7 dias` +
    (telas.length ? `; telas mais vistas em 28 dias: ${telas.join(", ")}.` : ".") +
    trava
  );
}
