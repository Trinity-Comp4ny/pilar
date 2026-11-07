import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { AUTO_VARIABLES } from "@/pages/propostas/lib/propostaVariaveis";

// Guia de variáveis do template .docx: lista todas as variáveis automáticas,
// copia {{VAR}} para a área de transferência e dá feedback.

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { toast } from "sonner";
import { VariaveisGuideButton, VariaveisGuideDialog } from "./VariaveisGuideDialog";

const writeText = vi.fn(async () => undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
});

describe("VariaveisGuideDialog", () => {
  it("lista todas as variáveis automáticas com descrição e exemplo", () => {
    render(<VariaveisGuideDialog open onOpenChange={vi.fn()} />);
    for (const [nome, descricao] of Object.entries(AUTO_VARIABLES)) {
      expect(screen.getAllByText(`{{${nome}}}`).length).toBeGreaterThan(0);
      expect(screen.getAllByText(descricao).length).toBeGreaterThan(0);
    }
    expect(screen.getByText("João da Silva")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Copiar variável" })).toHaveLength(Object.keys(AUTO_VARIABLES).length);
  });

  it("fechado não renderiza o conteúdo", () => {
    render(<VariaveisGuideDialog open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Guia de Variáveis para Templates")).not.toBeInTheDocument();
  });

  it("copia a variável com chaves duplas e avisa", async () => {
    vi.useFakeTimers();
    try {
      render(<VariaveisGuideDialog open onOpenChange={vi.fn()} />);
      const primeira = "AREA_M2";
      const linha = screen.getByText(`{{${primeira}}}`).closest("div.grid") as HTMLElement;
      await act(async () => {
        fireEvent.click(within(linha).getByRole("button", { name: "Copiar variável" }));
      });
      expect(writeText).toHaveBeenCalledWith(`{{${primeira}}}`);
      expect(toast.success).toHaveBeenCalledWith(`{{${primeira}}} copiado`);
      // o ícone de "copiado" volta ao normal depois de 1,5s, sem erro
      await act(async () => {
        vi.advanceTimersByTime(1600);
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("falha da área de transferência avisa o erro em vez de rejeição solta", async () => {
    writeText.mockRejectedValueOnce(new Error("negado"));
    render(<VariaveisGuideDialog open onOpenChange={vi.fn()} />);
    await act(async () => {
      fireEvent.click(screen.getAllByRole("button", { name: "Copiar variável" })[0]);
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/Não foi possível copiar/));
  });
});

describe("VariaveisGuideButton", () => {
  it("abre o guia ao clicar", () => {
    render(<VariaveisGuideButton />);
    expect(screen.queryByText("Guia de Variáveis para Templates")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Guia de Variáveis/ }));
    expect(screen.getByText("Guia de Variáveis para Templates")).toBeInTheDocument();
  });
});
