import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

// SPEC 144: avaliar o fornecedor da proposta vencedora, 4 critérios de 0 a 5.
const mutate = vi.fn();
let atual: unknown = null;
vi.mock("@/hooks/useFornecedorAvaliacoes", () => ({
  useAvaliacaoDaProposta: () => ({ data: atual }),
  useAvaliarFornecedor: () => ({ mutate, isPending: false }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { AvaliarFornecedor } from "./AvaliarFornecedor";

const props = { propostaId: "p1", fornecedorId: "f1", fornecedorNome: "Casa do Construtor" };

describe("AvaliarFornecedor", () => {
  beforeEach(() => {
    mutate.mockReset();
    atual = null;
  });

  it("proposta sem fornecedor cadastrado não oferece avaliar", () => {
    render(<AvaliarFornecedor {...props} fornecedorId={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("só salva depois de preencher ao menos um critério, e mostra a nota geral", () => {
    render(<AvaliarFornecedor {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Avaliar fornecedor" }));

    const salvar = screen.getByRole("button", { name: "Salvar avaliação" });
    expect(salvar).toBeDisabled();
    expect(screen.getByText("Nota geral: -")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Demora na resposta: 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Preço: 4" }));
    expect(screen.getByText("Nota geral: 4,5")).toBeInTheDocument();
    expect(salvar).toBeEnabled();

    fireEvent.click(salvar);
    expect(mutate).toHaveBeenCalledWith(
      { notas: { demora: 5, preco: 4, prazo: null, qualidade: null }, comentario: "" },
      expect.any(Object)
    );
  });

  it("clicar de novo na mesma nota limpa o critério", () => {
    render(<AvaliarFornecedor {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Avaliar fornecedor" }));
    const quatro = screen.getByRole("button", { name: "Qualidade: 4" });
    fireEvent.click(quatro);
    expect(screen.getByText("Nota geral: 4,0")).toBeInTheDocument();
    fireEvent.click(quatro);
    expect(screen.getByText("Nota geral: -")).toBeInTheDocument();
  });

  it("avaliação existente abre para editar com as notas dela", () => {
    atual = { nota_geral: 4, nota_demora: 5, nota_preco: 3, nota_prazo: null, nota_qualidade: null, comentario: "ok" };
    render(<AvaliarFornecedor {...props} />);

    expect(screen.getByRole("button", { name: /Nota 4,0/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Nota 4,0/ }));
    expect(screen.getByRole("button", { name: "Demora na resposta: 5" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByDisplayValue("ok")).toBeInTheDocument();
  });
});
