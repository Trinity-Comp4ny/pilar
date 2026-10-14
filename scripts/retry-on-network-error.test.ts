import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(__dirname, "retry-on-network-error.sh");

/** Roda o script com um comando que falha com `mensagem` até a tentativa `sucessoNa`. */
function rodar(mensagem: string, sucessoNa: number) {
  const contador = join(mkdtempSync(join(tmpdir(), "retry-")), "n");
  const cmd = `n=$(cat ${contador} 2>/dev/null || echo 0); n=$((n+1)); echo $n > ${contador}; [ $n -ge ${sucessoNa} ] && exit 0; echo "${mensagem}"; exit 1`;
  const r = spawnSync("bash", [SCRIPT, "bash", "-c", cmd], {
    env: { ...process.env, RETRY_BASE_WAIT: "0", RETRY_MAX_ATTEMPTS: "3" },
    encoding: "utf8",
  });
  return { status: r.status, tentativas: Number(spawnSync("cat", [contador], { encoding: "utf8" }).stdout.trim()) };
}

describe("retry-on-network-error.sh", () => {
  it("repete quando o registry limita pulls (deploy de functions, run 38396778235)", () => {
    const r = rodar("docker: Error response from daemon: toomanyrequests: Rate exceeded", 2);
    expect(r.status).toBe(0);
    expect(r.tentativas).toBe(2);
  });

  it("repete 5xx do CDN", () => {
    expect(rodar("error: failed: 522", 2).status).toBe(0);
  });

  it("não repete erro de código", () => {
    const r = rodar("error: TS2345 Argument of type 'unknown'", 2);
    expect(r.status).toBe(1);
    expect(r.tentativas).toBe(1);
  });
});
