import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// O ultra-admin lê, por RLS, estas tabelas de TODAS as empresas (o portal
// precisa). Fora do portal, toda consulta a elas tem que se prender a uma
// empresa ou a uma linha específica: senão o ultra-admin, dentro de uma
// empresa, vê (e pode alterar) dado de outra. Foi o caso de `disciplinas`.
const TABELAS_CROSS_EMPRESA = [
  "profiles",
  "empresas",
  "convites",
  "audit_logs",
  "audit_logs_archive",
  "ai_token_ledger",
  "ai_token_saldo",
  "ai_token_limite_usuario",
  "ai_token_solicitacao",
  "pilar_token_pack_purchases",
  "consentimentos_cobranca",
  "email_envios",
  "registros_acesso",
  "disciplinas",
  "v_uso_tokens_usuario_ciclo",
  "v_uso_tokens_por_empresa",
  "v_uso_tokens_por_agente",
  "v_uso_tokens_por_usuario",
  "v_extrato_tokens",
];

// Consulta presa: empresa, o próprio usuário ou uma linha por id.
const PRESA = /empresa_id|empresaId|\.eq\(\s*"(id|user_id|created_by|destinatario_id|pessoa_id|profile_id)"|\.in\(\s*"id"|\.match\(/;

// Exceções justificadas (arquivo → motivo). Cada uma depende de outra trava.
const EXCECOES: Record<string, string> = {
  "src/pages/comprar-tokens/hooks/useTokenPackStatus.ts": "filtra por id da compra (uuid do próprio checkout)",
  // disciplinas: o catálogo é escopado no banco (disciplinas_manage só vê global + própria empresa)
  "src/pages/projetos/hooks/useProjetosData.ts": "catálogo escopado pela RLS (SPEC cross-empresa)",
  "src/pages/projetos/hooks/useProjetoDetail.ts": "catálogo escopado pela RLS (SPEC cross-empresa)",
  "src/pages/projetos/components/ManageDisciplinasDialog.tsx": "insert: empresa_id vem do default do banco",
  "src/pages/projetos/lib/disciplinaEmLote.ts": "update/delete por id da linha do catálogo, já escopado pela RLS",
  "src/pages/chat/ProjetoConfirmationCard.tsx": "catálogo escopado pela RLS",
};

const ROOT = join(__dirname, "..", "..");
const arquivos = (dir: string): string[] =>
  readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return arquivos(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });

const rel = (f: string) => f.replace(`${ROOT}/`, "");

describe("varredura: consulta a tabela cross-empresa sem filtro (ultra-admin não vaza)", () => {
  it("fora do portal ultra-admin toda consulta se prende a empresa ou a uma linha", () => {
    const tabelas = TABELAS_CROSS_EMPRESA.join("|");
    const re = new RegExp(`\\.from\\(\\s*"(${tabelas})"\\s*\\)`, "g");
    const ofensores: string[] = [];

    for (const arquivo of arquivos(join(ROOT, "src"))) {
      const r = rel(arquivo);
      if (r.includes("/pages/ultra-admin/") || r.startsWith("src/integrations/")) continue;
      if (EXCECOES[r]) continue;
      const texto = readFileSync(arquivo, "utf8")
        .split("\n")
        .map((l) => (/^\s*(\/\/|\*|\/\*)/.test(l) ? "" : l))
        .join("\n");
      for (const m of texto.matchAll(re)) {
        const inicio = m.index ?? 0;
        const resto = texto.slice(inicio, inicio + 1800);
        const fim = resto.slice(10).search(/\n\s*\n|\.from\(/) + 10;
        const trecho = fim > 10 ? resto.slice(0, fim) : resto;
        if (!PRESA.test(trecho)) ofensores.push(`${r}: .from("${m[1]}")`);
      }
    }
    expect(ofensores).toEqual([]);
  });
});
