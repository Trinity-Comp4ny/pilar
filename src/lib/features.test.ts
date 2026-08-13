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

describe("isFeatureEnabledForCompany — herança de sub-feature (ADR 0019)", () => {
  it("core sempre liga, mesmo sem entrada no JSONB", () => {
    expect(isFeatureEnabledForCompany({}, "dashboard")).toBe(true);
    expect(isFeatureEnabledForCompany(null, "meu_trabalho")).toBe(true);
  });

  it("feature-raiz normal depende do boolean explícito", () => {
    expect(isFeatureEnabledForCompany({}, "obras")).toBe(false);
    expect(isFeatureEnabledForCompany({ obras: true }, "obras")).toBe(true);
  });

  it("sub-feature exige o módulo-pai ligado", () => {
    expect(isFeatureEnabledForCompany({}, "obras_estoque")).toBe(false);
    expect(isFeatureEnabledForCompany({ obras: true }, "obras_estoque")).toBe(true);
  });

  it("sub ausente no JSONB herda o pai ligado (não retira tela de quem já usa)", () => {
    expect(isFeatureEnabledForCompany({ obras: true }, "obras_clima")).toBe(true);
    expect(isFeatureEnabledForCompany({ obras: true }, "obras_diario")).toBe(true);
  });

  it("sub com false explícito desliga mesmo com o pai ligado", () => {
    expect(isFeatureEnabledForCompany({ obras: true, obras_clima: false }, "obras_clima")).toBe(false);
    // As outras subs seguem ligadas.
    expect(isFeatureEnabledForCompany({ obras: true, obras_clima: false }, "obras_estoque")).toBe(true);
  });

  it("sub true não vale nada se o pai estiver desligado", () => {
    expect(isFeatureEnabledForCompany({ obras_clima: true }, "obras_clima")).toBe(false);
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
