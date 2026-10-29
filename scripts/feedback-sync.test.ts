import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const A = "0b8e6a52-6f6c-4d6e-9a53-2b1f0c9d7e11";
const B = "1c9f7b63-7a7d-4e7f-8b64-3c2a1d0e8f22";

function rodar(alvo: string, entrada: string): string {
  return execFileSync("bash", ["scripts/feedback-sync.sh", alvo], {
    input: entrada,
    env: { ...process.env, FEEDBACK_SYNC_DRY_RUN: "1", FEEDBACK_SYNC_URL: "", FEEDBACK_SYNC_TOKEN: "" },
    encoding: "utf8",
  }).trim();
}

describe("scripts/feedback-sync.sh", () => {
  it("extrai os ids das linhas Feedback:, sem repetir e em minúsculas", () => {
    const msgs = `fix(x): a\n\nFeedback: ${A.toUpperCase()}\n\nfix(y): b\n\nFeedback: ${B}\nFeedback: ${A}\n`;
    expect(rodar("planejado", msgs).split("\n")).toEqual([A, B]);
  });

  it("ignora id inválido e a palavra Feedback fora do começo da linha", () => {
    expect(rodar("resolvido", `Feedback: 123\nVer Feedback: ${A}\n`)).toContain("Nenhum commit");
  });

  it("recusa alvo desconhecido", () => {
    expect(() => rodar("descartado", "")).toThrow();
  });
});
