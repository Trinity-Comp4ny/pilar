import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const BASE = {
  CANAL: "live",
  FIREBASE_PROJECT: "pilarsoft-prod",
  SITE_ID: "pilarsoft-app",
  VITE_SUPABASE_URL: "https://vepnsonbnsimqcsfcagm.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "chave-publica-de-teste",
};

function rodar(extra: Record<string, string>) {
  return spawnSync(process.execPath, ["scripts/verificar-firebase-ambiente.mjs"], {
    env: { PATH: process.env.PATH ?? "", ...BASE, ...extra },
    encoding: "utf8",
  });
}

describe("verificar-firebase-ambiente: quem pode publicar live", () => {
  it("aceita disparo manual a partir da main", () => {
    const r = rodar({ GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main" });
    expect(r.status).toBe(0);
  });

  it("aceita o CI verde de main", () => {
    const r = rodar({ GITHUB_EVENT_NAME: "workflow_run", GITHUB_REF: "refs/heads/main", CI_HEAD_BRANCH: "main" });
    expect(r.status).toBe(0);
  });

  it("recusa o CI de outra branch", () => {
    const r = rodar({ GITHUB_EVENT_NAME: "workflow_run", GITHUB_REF: "refs/heads/main", CI_HEAD_BRANCH: "staging" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("Hosting live exige");
  });

  it("recusa disparo manual fora da main e pull request", () => {
    expect(rodar({ GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/feat/x" }).status).not.toBe(0);
    expect(rodar({ GITHUB_EVENT_NAME: "pull_request", GITHUB_REF: "refs/pull/1/merge" }).status).not.toBe(0);
  });

  it("recusa Supabase de preview no canal live", () => {
    const r = rodar({
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REF: "refs/heads/main",
      VITE_SUPABASE_URL: "https://rizaklgstyfrwgmdsldf.supabase.co",
    });
    expect(r.status).not.toBe(0);
  });
});
