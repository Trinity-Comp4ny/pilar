import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { gruposDeAtalhos } from "@/lib/atalhosTeclado";
import { AtalhosTecladoDialog } from "./AtalhosTecladoDialog";

function mockPlatform(platform: string) {
  vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AtalhosTecladoDialog", () => {
  it("lista os atalhos reais agrupados, com ⌘ no Mac", () => {
    mockPlatform("MacIntel");
    render(<AtalhosTecladoDialog open onOpenChange={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Atalhos de teclado" });

    const geral = within(dialog).getByRole("region", { name: "Geral" });
    const paleta = within(geral).getByText("Abrir a paleta de comandos").closest("li") as HTMLElement;
    expect(within(paleta).getByText("⌘")).toBeInTheDocument();
    expect(within(paleta).getByText("K")).toBeInTheDocument();
    expect(within(paleta).getByText("+")).toBeInTheDocument();
    expect(within(geral).getByText("Mostrar estes atalhos").closest("li")).toHaveTextContent("?");

    const busca = within(dialog).getByRole("region", { name: "Busca da página" });
    expect(within(busca).getByText("Ir para a busca").closest("li")).toHaveTextContent("/");
    expect(within(busca).getByText("Limpar a busca").closest("li")).toHaveTextContent("Esc");

    const abas = within(dialog).getByText("Trocar de aba").closest("li") as HTMLElement;
    expect(within(abas).getByText("ou")).toBeInTheDocument();
  });

  it("usa Ctrl fora do Mac", () => {
    mockPlatform("Win32");
    render(<AtalhosTecladoDialog open onOpenChange={vi.fn()} />);
    const paleta = screen.getByText("Abrir a paleta de comandos").closest("li") as HTMLElement;
    expect(within(paleta).getByText("Ctrl")).toBeInTheDocument();
    expect(screen.queryByText("⌘")).not.toBeInTheDocument();
  });

  it("toda descrição é única (vira key da lista)", () => {
    const descricoes = gruposDeAtalhos("Ctrl").flatMap((g) => g.atalhos.map((a) => a.descricao));
    expect(new Set(descricoes).size).toBe(descricoes.length);
  });
});
