import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PreviasRecursos } from "./PreviasRecursos";

const h = vi.hoisted(() => ({
  recursos: [] as { chave: string; nome: string; descricao: string }[],
  ligadas: new Set<string>(),
  mutate: vi.fn(),
}));
vi.mock("@/hooks/usePrevias", () => ({
  usePrevias: () => ({ recursos: h.recursos, ligadas: h.ligadas }),
  useAlternarPrevia: () => ({ mutate: h.mutate, isPending: false }),
}));
vi.mock("@/components/FeedbackDialog", () => ({
  FeedbackDialog: ({ open, mensagemInicial }: { open: boolean; mensagemInicial?: string }) =>
    open ? <div data-testid="feedback">{mensagemInicial}</div> : null,
}));

beforeEach(() => {
  vi.clearAllMocks();
  h.recursos = [];
  h.ligadas = new Set();
});

describe("PreviasRecursos (SPEC 160)", () => {
  it("sem recurso em prévia não aparece", () => {
    const { container } = render(<PreviasRecursos />);
    expect(container).toBeEmptyDOMElement();
  });

  it("liga a prévia e, ligada, oferece feedback", async () => {
    h.recursos = [{ chave: "gantt-novo", nome: "Gantt novo", descricao: "Arraste para remarcar" }];
    const user = userEvent.setup();
    const { rerender } = render(<PreviasRecursos />);
    await user.click(screen.getByRole("switch", { name: "Ligar a prévia de Gantt novo" }));
    expect(h.mutate).toHaveBeenCalledWith({ chave: "gantt-novo", ligar: true }, expect.anything());

    h.ligadas = new Set(["gantt-novo"]);
    rerender(<PreviasRecursos />);
    await user.click(screen.getByRole("button", { name: "Contar o que achou" }));
    expect(screen.getByTestId("feedback")).toHaveTextContent("Prévia de Gantt novo:");
  });
});
