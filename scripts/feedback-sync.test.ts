import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

/** Dentro do hook de pré-commit o git exporta GIT_DIR/GIT_INDEX_FILE: o repo temporário não pode herdá-las. */
const envSemGit = () => Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")));

// Cada caso monta um repo git temporário: com a suíte inteira rodando em paralelo o padrão de 5 s não basta.
describe("scripts/feedback-release-commits.sh", { timeout: 60_000 }, () => {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
      cwd,
      env: envSemGit(),
      encoding: "utf8",
    }).trim();

  function montarRepo() {
    const dir = mkdtempSync(join(tmpdir(), "fbk-"));
    git(dir, "init", "-q", "-b", "staging");
    const commit = (msg: string) => {
      writeFileSync(join(dir, "f.txt"), `${Math.random()}`);
      git(dir, "add", "f.txt");
      git(dir, "commit", "-q", "-m", msg);
    };
    commit("base");
    // main anterior = release do estado "base" (um commit com a árvore de staging)
    git(dir, "checkout", "-q", "--orphan", "main");
    git(dir, "commit", "-q", "-m", "release 1");
    git(dir, "checkout", "-q", "staging");
    git(dir, "checkout", "-q", "-B", "staging", "HEAD"); // garante que o staging é a branch atual
    return { dir, commit };
  }

  const rodar = (dir: string, release: string, antes: string) =>
    execFileSync("bash", [join(process.cwd(), "scripts/feedback-release-commits.sh"), release, antes], {
      cwd: dir,
      env: { ...envSemGit(), STAGING_REF: "staging" },
      encoding: "utf8",
    });

  it("lê os commits entre os dois releases pela árvore, sem olhar o corpo do PR", () => {
    const { dir, commit } = montarRepo();
    commit(`feat: a\n\nFeedback: ${A}`);
    commit(`feat: b\n\nFeedback: ${B}`);
    // release 2: um commit em main com a árvore do topo de staging
    const arvore = git(dir, "rev-parse", "staging^{tree}");
    const release1 = git(dir, "rev-parse", "main");
    const release2 = git(dir, "commit-tree", arvore, "-p", release1, "-m", "release 2");
    const saida = rodar(dir, release2, release1);
    expect(saida).toContain(`Feedback: ${A}`);
    expect(saida).toContain(`Feedback: ${B}`);
    expect(saida).not.toContain("base");
  });

  it("não inclui commit de staging que entrou depois da árvore do release", () => {
    const { dir, commit } = montarRepo();
    commit(`feat: a\n\nFeedback: ${A}`);
    const arvore = git(dir, "rev-parse", "staging^{tree}");
    const release1 = git(dir, "rev-parse", "main");
    const release2 = git(dir, "commit-tree", arvore, "-p", release1, "-m", "release 2");
    commit(`feat: depois\n\nFeedback: ${B}`);
    const saida = rodar(dir, release2, release1);
    expect(saida).toContain(`Feedback: ${A}`);
    expect(saida).not.toContain(B);
  });

  it("sai com 3 quando a árvore do release não existe em staging", () => {
    const { dir } = montarRepo();
    const release1 = git(dir, "rev-parse", "main");
    writeFileSync(join(dir, "g.txt"), "x");
    git(dir, "add", "g.txt");
    const arvoreOutra = git(dir, "write-tree");
    const release2 = git(dir, "commit-tree", arvoreOutra, "-p", release1, "-m", "release x");
    let status = 0;
    try {
      rodar(dir, release2, release1);
    } catch (e) {
      status = (e as { status: number }).status;
    }
    expect(status).toBe(3);
  });
});
