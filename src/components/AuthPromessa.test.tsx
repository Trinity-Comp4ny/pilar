import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthPromessa } from "./AuthPromessa";

// BEZ-401: as telas de entrada diziam o discurso antigo (financeiro, projetos e CRM). Agora dizem a
// promessa da marca v1 (brand/messaging.md), num componente só.

const TELAS_DE_ENTRADA = [
  "src/pages/Login.tsx",
  "src/pages/ForgotPassword.tsx",
  "src/pages/PasswordReset.tsx",
  "src/pages/MfaSetupPage.tsx",
  "src/pages/MfaChallengePage.tsx",
];

const raiz = process.cwd();

function fontes(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) return fontes(caminho);
    return /\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

describe("AuthPromessa", () => {
  it("mostra a tagline, a assinatura dos agentes e os três pontos, nas palavras da marca", () => {
    render(<AuthPromessa />);

    expect(screen.getByText("Do contrato à execução, num fluxo só.")).toBeInTheDocument();
    expect(screen.getByText("A IA prepara. O sistema confere. Você aprova.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});

describe("telas de entrada usam a promessa da marca", () => {
  it.each(TELAS_DE_ENTRADA)("%s usa o AuthPromessa", (rel) => {
    expect(readFileSync(join(raiz, rel), "utf8")).toContain("<AuthPromessa />");
  });

  it("o discurso antigo não aparece mais em nenhuma tela", () => {
    const antigo = [
      "alicerce onde grandes empresas",
      "Controle Financeiro Integrado",
      "CRM e Relacionamento",
      "Uma empresa bem configurada vira processo",
      "Antes do primeiro dashboard",
    ];
    const achados = fontes(join(raiz, "src")).flatMap((f) => {
      const texto = readFileSync(f, "utf8");
      return antigo.filter((a) => texto.includes(a)).map((a) => `${f}: ${a}`);
    });
    expect(achados).toEqual([]);
  });
});
