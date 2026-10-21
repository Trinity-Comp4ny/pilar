/**
 * Leitura do Sentry para o agente Qualidade (SPEC 131). Só leitura, com token próprio
 * (SENTRY_READ_TOKEN: Issue & Event, Project e Organization em Read), nunca o DSN.
 *
 * Resposta fora do contrato vira erro claro na execução (validação na fronteira), não
 * número errado no painel.
 */
import { z } from "../_shared/schemas.ts";
import type { ErroSentry } from "./regras.ts";

export type ConfigSentry = { token: string; apiUrl: string; org: string; projeto: string; ambiente: string };

export const SEM_TOKEN =
  "Sentry não configurado: falta o secret SENTRY_READ_TOKEN nas Edge Functions. Passo a passo na SPEC 131.";

/** Null sem token: o agente falha com SEM_TOKEN em vez de fingir que não há erro. */
export function configSentry(env: (k: string) => string | undefined): ConfigSentry | null {
  const token = env("SENTRY_READ_TOKEN")?.trim();
  if (!token) return null;
  return {
    token,
    apiUrl: (env("SENTRY_API_URL") || "https://us.sentry.io").replace(/\/+$/, ""),
    org: env("SENTRY_ORG") || "bez-company",
    projeto: env("SENTRY_PROJECT") || "pilar",
    ambiente: env("SENTRY_ENV") || "production",
  };
}

const projetoSchema = z.object({ id: z.string() });

const issueSchema = z.object({
  id: z.string(),
  shortId: z.string(),
  title: z.string(),
  culprit: z.string().nullable().optional(),
  permalink: z.string(),
  count: z.union([z.string(), z.number()]),
  userCount: z.number(),
  firstSeen: z.string(),
  lastSeen: z.string(),
  status: z.string(),
  substatus: z.string().nullable().optional(),
});

const valorDeTagSchema = z.object({ value: z.string().nullable() });

type Buscar = typeof fetch;

async function ler(cfg: ConfigSentry, caminho: string, params: Record<string, string>, buscar: Buscar) {
  const url = new URL(`${cfg.apiUrl}/api/0/${caminho}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await buscar(url, { headers: { Authorization: `Bearer ${cfg.token}` } });
  if (r.status === 401 || r.status === 403) {
    throw new Error(
      `Sentry recusou o token (${r.status}): confira o SENTRY_READ_TOKEN e as permissões de leitura (Issue & Event, Project, Organization).`
    );
  }
  if (!r.ok) throw new Error(`Sentry respondeu ${r.status} em ${caminho}`);
  return await r.json();
}

function contrato<S extends z.ZodTypeAny>(schema: S, dado: unknown, onde: string): z.output<S> {
  const r = schema.safeParse(dado);
  if (!r.success) throw new Error(`resposta do Sentry fora do contrato em ${onde}`);
  return r.data;
}

/** Quantos erros por rodada têm os escritórios consultados (uma chamada por erro). */
export const ERROS_COM_ESCRITORIOS = 10;

/**
 * Erros abertos com atividade nas últimas 24 h no ambiente do deploy, os mais
 * abrangentes primeiro, com os escritórios atingidos (tag empresa_id do front).
 */
export async function errosDas24h(cfg: ConfigSentry, buscar: Buscar = fetch): Promise<ErroSentry[]> {
  const projeto = contrato(projetoSchema, await ler(cfg, `projects/${cfg.org}/${cfg.projeto}/`, {}, buscar), "projeto");
  const issues = contrato(
    z.array(issueSchema),
    await ler(
      cfg,
      `organizations/${cfg.org}/issues/`,
      {
        project: projeto.id,
        environment: cfg.ambiente,
        statsPeriod: "24h",
        query: "is:unresolved",
        sort: "user",
        limit: "25",
      },
      buscar
    ),
    "issues"
  );

  const erros: ErroSentry[] = [];
  for (const [i, issue] of issues.entries()) {
    let empresas: string[] = [];
    if (i < ERROS_COM_ESCRITORIOS) {
      const valores = contrato(
        z.array(valorDeTagSchema),
        await ler(
          cfg,
          `organizations/${cfg.org}/issues/${issue.id}/tags/empresa_id/values/`,
          { environment: cfg.ambiente },
          buscar
        ),
        "escritórios do erro"
      );
      empresas = valores.map((v) => v.value).filter((v): v is string => !!v);
    }
    erros.push({
      id: issue.id,
      shortId: issue.shortId,
      titulo: issue.title,
      culprit: issue.culprit ?? null,
      link: issue.permalink,
      pessoas: issue.userCount,
      ocorrencias: Number(issue.count) || 0,
      primeiraVez: issue.firstSeen,
      regressao: issue.substatus === "regressed",
      empresas,
    });
  }
  return erros;
}

/** Ids dos erros (entre os pedidos) que estão resolvidos agora no Sentry. */
export async function resolvidos(cfg: ConfigSentry, ids: string[], buscar: Buscar = fetch): Promise<Set<string>> {
  const prontos = new Set<string>();
  for (const id of ids) {
    const issue = contrato(
      issueSchema.pick({ id: true, status: true }),
      await ler(cfg, `organizations/${cfg.org}/issues/${id}/`, {}, buscar),
      "status do erro"
    );
    if (issue.status === "resolved") prontos.add(id);
  }
  return prontos;
}
