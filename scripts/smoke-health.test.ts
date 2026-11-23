import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SCRIPT = resolve(__dirname, "smoke-health.sh");

function rodar(env: Record<string, string>) {
  const r = spawnSync("bash", [SCRIPT], {
    env: { PATH: process.env.PATH ?? "", PROJECT_REF: "abc", TENTATIVAS: "1", ESPERA: "0", ...env },
    encoding: "utf8",
  });
  return { status: r.status, saida: `${r.stdout}${r.stderr}` };
}

describe("smoke-health.sh", () => {
  it("sem ANON_KEY e sem obrigatoriedade, pula e passa", () => {
    const r = rodar({});
    expect(r.status).toBe(0);
    expect(r.saida).toContain("smoke test pulado");
  });

  it("não imprime o corpo retornado pelo endpoint nos logs", () => {
    const fonte = readFileSync(SCRIPT, "utf8");
    expect(fonte).not.toContain('cat "$BODY"');
    expect(fonte).not.toContain('head -c 400 "$BODY"');
  });

  it("sem ANON_KEY com SMOKE_OBRIGATORIO=true, falha (release de 14/10 passou com o smoke pulado)", () => {
    const r = rodar({ SMOKE_OBRIGATORIO: "true" });
    expect(r.status).toBe(1);
    expect(r.saida).toContain("smoke é obrigatório");
  });
});
