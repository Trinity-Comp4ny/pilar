import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  applyFeatureToggle,
  FEATURES,
  FEATURE_MODULE,
  isFeatureEnabledForCompany,
  moduleOfFeature,
  subFeaturesOf,
  type FeatureKey,
} from "./features";
import { MODULES } from "./modules";

describe("isFeatureEnabledForCompany: universal ignora o JSONB da empresa (ADR 0026)", () => {
  it("core sempre liga, mesmo sem entrada no JSONB", () => {
    expect(isFeatureEnabledForCompany({}, "dashboard")).toBe(true);
    expect(isFeatureEnabledForCompany(null, "meu_trabalho")).toBe(true);
  });

  it("feature universal (obras) liga mesmo sem nenhuma entrada na empresa", () => {
    expect(isFeatureEnabledForCompany({}, "obras")).toBe(true);
    expect(isFeatureEnabledForCompany(null, "obras")).toBe(true);
    expect(isFeatureEnabledForCompany({ obras: false }, "obras")).toBe(true);
  });

  it("feature NÃO universal (dormant) continua dependendo do boolean explícito", () => {
    expect(isFeatureEnabledForCompany({}, "templates")).toBe(false);
    expect(isFeatureEnabledForCompany({ templates: true }, "templates")).toBe(true);
  });

  it("sub-feature de Obras é universal: liga mesmo sem o pai marcado no JSONB", () => {
    expect(isFeatureEnabledForCompany({}, "obras_estoque")).toBe(true);
    expect(isFeatureEnabledForCompany({}, "obras_clima")).toBe(true);
  });

  it("todo item com parent no catálogo hoje é universal (invariante do ADR 0026)", () => {
    // Documenta o estado atual: a lógica de herança pai→filho em
    // isFeatureEnabledForCompany/applyFeatureToggle (ADR 0019) continua no
    // código para uma futura sub-feature não-universal, mas nenhuma existe
    // hoje: todas as 7 sub-features de Obras já são universais. Se este
    // teste falhar, alguém adicionou uma sub-feature não-universal: ótimo,
    // mas então os testes de herança abaixo precisam de um exemplo real de
    // novo, não mais deste comentário.
    for (const f of FEATURES) {
      if (f.parent) expect(f.universal, `${f.key} tem parent mas não é universal`).toBe(true);
    }
  });
});

describe("applyFeatureToggle — próximo estado do JSONB (ADR 0019)", () => {
  it("ligar feature-raiz grava true", () => {
    expect(applyFeatureToggle({}, "obras", true)).toEqual({ obras: true });
  });

  it("desligar feature-raiz remove a chave", () => {
    expect(applyFeatureToggle({ obras: true }, "obras", false)).toEqual({});
  });

  it("ligar o módulo limpa os false das sub-features (macro liga tudo)", () => {
    const next = applyFeatureToggle({ obras_clima: false, obras_estoque: false }, "obras", true);
    expect(next).toEqual({ obras: true });
  });

  it("desligar sub grava false explícito, sem tocar as outras", () => {
    expect(applyFeatureToggle({ obras: true }, "obras_clima", false)).toEqual({
      obras: true,
      obras_clima: false,
    });
  });

  it("ligar sub remove a chave para herdar o pai", () => {
    expect(applyFeatureToggle({ obras: true, obras_clima: false }, "obras_clima", true)).toEqual({
      obras: true,
    });
  });

  it("não muta o objeto de entrada", () => {
    const input = { obras: true };
    applyFeatureToggle(input, "obras_clima", false);
    expect(input).toEqual({ obras: true });
  });
});

describe("catálogo de sub-features de Obras", () => {
  const subs = subFeaturesOf("obras");

  it("obras tem 7 sub-features, todas com parent e módulo obras", () => {
    expect(subs.map((s) => s.key).sort()).toEqual(
      [
        "obras_clima",
        "obras_conta",
        "obras_cotacoes",
        "obras_cronograma",
        "obras_diario",
        "obras_estoque",
        "obras_fornecedores",
      ].sort()
    );
    for (const s of subs) {
      expect(s.parent).toBe("obras");
      expect(moduleOfFeature(s.key)).toBe("obras");
    }
  });

  it("FEATURE_MODULE cobre toda FeatureKey (Record fechado)", () => {
    for (const f of FEATURES) {
      expect(f.key in FEATURE_MODULE).toBe(true);
    }
  });

  it("itens de Obras na sidebar apontam para features do módulo obras", () => {
    for (const item of MODULES.obras.items) {
      expect(item.feature && moduleOfFeature(item.feature as FeatureKey)).toBe("obras");
    }
  });
});

describe("sincronia catálogo front ↔ backend (_feature_catalog SQL)", () => {
  it("toda FeatureKey do front existe no catálogo SQL mais recente", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const migDir = path.resolve(here, "../../supabase/migrations");
    const files = fs
      .readdirSync(migDir)
      .filter((f) => f.includes("feature_catalog"))
      .sort();
    expect(files.length, "nenhuma migration de _feature_catalog encontrada").toBeGreaterThan(0);
    const latest = files[files.length - 1];
    const sql = fs.readFileSync(path.join(migDir, latest), "utf8");
    // Features core (dashboard, meu_trabalho) bypassam o catálogo do banco:
    // acesso liberado sem depender de _feature_catalog(). Só as gated precisam
    // estar sincronizadas.
    for (const f of FEATURES) {
      if (f.core) continue;
      expect(sql, `feature '${f.key}' ausente no catálogo SQL (${latest})`).toContain(`'${f.key}'`);
    }
  });
});

describe("sincronia universal front ↔ backend (_universal_features SQL, ADR 0026)", () => {
  it("toda feature universal (não-core) do front existe em _universal_features() no banco", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const migDir = path.resolve(here, "../../supabase/migrations");
    const files = fs
      .readdirSync(migDir)
      .filter((f) => f.includes("universal_features"))
      .sort();
    expect(files.length, "nenhuma migration de _universal_features encontrada").toBeGreaterThan(0);
    const latest = files[files.length - 1];
    const sql = fs.readFileSync(path.join(migDir, latest), "utf8");
    // Core (dashboard, meu_trabalho) tem bypass próprio, não entra em
    // _universal_features(), ver comentário da função no banco.
    for (const f of FEATURES) {
      if (!f.universal || f.core) continue;
      expect(sql, `feature universal '${f.key}' ausente em _universal_features() (${latest})`).toContain(`'${f.key}'`);
    }
  });

  it("nenhuma feature não-universal aparece em _universal_features()", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const migDir = path.resolve(here, "../../supabase/migrations");
    const files = fs
      .readdirSync(migDir)
      .filter((f) => f.includes("universal_features"))
      .sort();
    const latest = files[files.length - 1];
    const sql = fs.readFileSync(path.join(migDir, latest), "utf8");
    const match = sql.match(/_universal_features\(\)[\s\S]*?SELECT ARRAY\[([\s\S]*?)\];/);
    expect(match, "não achou o corpo de _universal_features() na migration").not.toBeNull();
    const sqlKeys = (match?.[1] ?? "").match(/'([a-z_]+)'/g)?.map((s) => s.slice(1, -1)) ?? [];
    for (const key of sqlKeys) {
      const feature = FEATURES.find((f) => f.key === key);
      expect(feature, `_universal_features() cita '${key}', que não existe em FEATURES`).toBeDefined();
      expect(feature?.universal, `_universal_features() cita '${key}', que não é universal no front`).toBe(true);
    }
  });
});

describe("convite não carrega mais features de usuário (ADR 0029)", () => {
  const FUNCOES_DE_CONVITE = ["invite-user", "ultra-admin-usuarios", "ultra-admin-empresas"];

  it("nenhuma edge function de convite manda p_features nem grava profiles.features", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    for (const fn of FUNCOES_DE_CONVITE) {
      const src = fs.readFileSync(path.resolve(here, `../../supabase/functions/${fn}/index.ts`), "utf8");
      expect(src.includes("p_features"), `${fn} ainda passa p_features para a RPC de convite`).toBe(false);
      expect(src.includes("sanitizeFeatures"), `${fn} ainda sanitiza features de usuário`).toBe(false);
    }
  });

  it("a migration que remove o eixo por usuário derruba as colunas", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const migDir = path.resolve(here, "../../supabase/migrations");
    const arquivo = fs
      .readdirSync(migDir)
      .filter((f) => f.includes("acesso_por_role"))
      .sort()
      .pop();
    expect(arquivo, "não achou a migration de acesso por role").toBeDefined();
    const sql = fs.readFileSync(path.join(migDir, arquivo as string), "utf8");
    expect(sql).toContain("ALTER TABLE public.profiles DROP COLUMN IF EXISTS features");
    expect(sql).toContain("ALTER TABLE public.convites DROP COLUMN IF EXISTS features");
  });
});

describe("sincronia UNIVERSAL_FEATURES do ultra-admin-empresas (edge function) com o catálogo do front", () => {
  it("toda feature universal do front é recusada em bulk-feature pelo mesmo motivo (ADR 0026)", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const fnPath = path.resolve(here, "../../supabase/functions/ultra-admin-empresas/index.ts");
    const src = fs.readFileSync(fnPath, "utf8");
    const match = src.match(/const UNIVERSAL_FEATURES = new Set\(\[([\s\S]*?)\]\);/);
    expect(match, "não achou UNIVERSAL_FEATURES em ultra-admin-empresas/index.ts").not.toBeNull();
    const listedKeys = new Set((match?.[1] ?? "").match(/"([a-z_]+)"/g)?.map((s) => s.slice(1, -1)) ?? []);
    for (const f of FEATURES) {
      if (f.core || !f.universal) continue;
      expect(listedKeys.has(f.key), `ultra-admin-empresas não recusaria ação em massa em '${f.key}'`).toBe(true);
    }
    for (const key of listedKeys) {
      const feature = FEATURES.find((f) => f.key === key);
      expect(feature?.universal, `UNIVERSAL_FEATURES cita '${key}', que não é universal no front`).toBe(true);
    }
  });
});
