import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaixaAvisos } from "./FaixaAvisos";
import type { Aviso } from "@/lib/avisosPlataforma";

const h = vi.hoisted(() => ({ avisos: [] as Aviso[] }));
vi.mock("@/hooks/useAvisosPlataforma", () => ({ useAvisosPlataforma: () => h.avisos }));
vi.mock("@/lib/env", () => ({ env: { VITE_STATUS_URL: "https://status.exemplo.test" } }));

const incidente: Aviso = {
  chave: "incidente:i1:u1",
  tom: "attention",
  titulo: "Lentidão no Financeiro",
  texto: "Encontramos a causa e estamos corrigindo.",
  detalhe: "Afeta: Aplicação Pilar",
};

beforeEach(() => {
  sessionStorage.clear();
  h.avisos = [];
});

describe("FaixaAvisos (SPEC 153)", () => {
  it("sem aviso não renderiza nada", () => {
    const { container } = render(<FaixaAvisos />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o incidente com o link para a status page", () => {
    h.avisos = [incidente];
    render(<FaixaAvisos />);
    expect(screen.getByRole("status")).toHaveTextContent("Lentidão no Financeiro");
    expect(screen.getByText("Afeta: Aplicação Pilar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Acompanhar/ })).toHaveAttribute("href", "https://status.exemplo.test");
  });

  it("fora do ar usa alerta", () => {
    h.avisos = [{ ...incidente, tom: "danger" }];
    render(<FaixaAvisos />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("dispensar esconde o aviso; atualização nova (outra chave) mostra de novo", async () => {
    h.avisos = [incidente];
    const user = userEvent.setup();
    const { rerender } = render(<FaixaAvisos />);
    await user.click(screen.getByRole("button", { name: "Dispensar aviso" }));
    expect(screen.queryByText("Lentidão no Financeiro")).not.toBeInTheDocument();

    h.avisos = [{ ...incidente, chave: "incidente:i1:u2", texto: "Corrigido, monitorando." }];
    rerender(<FaixaAvisos />);
    expect(screen.getByText("Corrigido, monitorando.")).toBeInTheDocument();
  });

  it("Normalizado não tem link de acompanhar", () => {
    h.avisos = [
      { chave: "incidente:i1:resolvido", tom: "positive", titulo: "Normalizado: X", texto: "ok", detalhe: null },
    ];
    render(<FaixaAvisos />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
