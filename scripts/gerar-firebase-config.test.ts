import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve("scripts/gerar-firebase-config.mjs");
describe("geração das configurações Firebase", () => {
  it("não sobrescreve firebase.app.json se a configuração de marketing falhar", () => {
    const dir = mkdtempSync(join(tmpdir(), "pilar-firebase-"));
    try {
      mkdirSync(join(dir, "apps/marketing"), { recursive: true });
      writeFileSync(join(dir, "vercel.json"), JSON.stringify({
        headers: [{ source: "/(.*)", headers: [] }],
        rewrites: [{ source: "/(.*)", destination: "/index.html" }],
      }));
      writeFileSync(join(dir, "firebase.app.json"), "original");
      writeFileSync(join(dir, "apps/marketing/vercel.json"), "{ JSON inválido");
      const run = spawnSync(process.execPath, [SCRIPT, dir], { encoding: "utf8" });
      expect(run.status).not.toBe(0);
      expect(readFileSync(join(dir, "firebase.app.json"), "utf8")).toBe("original");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
