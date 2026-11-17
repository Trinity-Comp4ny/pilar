import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  aporte: vi.fn(),
  despesa: vi.fn(),
  importar: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/pages/obras/hooks/useObraConta", () => ({
  useSaveAporte: () => ({ mutateAsync: h.aporte, isPending: false }),
  useSaveDespesa: () => ({ mutateAsync: h.despesa, isPending: false }),
}));
vi.mock("@/pages/obras/hooks/useImportarCronograma", () => ({
  useImportarCronograma: () => ({ mutateAsync: h.importar, isPending: false }),
}));

import { ImportarExtratoDialog } from "./ImportarExtratoDialog";
import { ImportarCronogramaDialog } from "./ImportarCronogramaDialog";

const OFX = `<OFX>
<STMTTRN><DTPOSTED>20261105<TRNAMT>5000.00<FITID>A1<NAME>PIX CLIENTE</STMTTRN>
<STMTTRN><DTPOSTED>20261106<TRNAMT>-1234.56<FITID>A2<NAME>CASA DO CONSTRUTOR</STMTTRN>
</OFX>`;

const arquivo = (texto: string, nome: string) => new File([texto], nome);

beforeEach(() => {
  vi.clearAllMocks();
  h.aporte.mockResolvedValue(undefined);
  h.despesa.mockResolvedValue(undefined);
  h.importar.mockResolvedValue({ nos: 3, tarefas: 1 });
});

describe("ImportarExtratoDialog", () => {
  const abrir = (lancamentos: unknown[] = []) => {
    const onOpenChange = vi.fn();
    render(<ImportarExtratoDialog open onOpenChange={onOpenChange} obraId="o1" lancamentos={lancamentos as never[]} />);
    return { onOpenChange };
  };

  it("lê o extrato, mostra os totais e grava aporte e despesa", async () => {
    const { onOpenChange } = abrir();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
    await userEvent.upload(screen.getByLabelText("Extrato OFX"), arquivo(OFX, "extrato.ofx"));
    expect(await screen.findByText(/2 de 2 movimentações/)).toBeInTheDocument();
    expect(screen.getByText("PIX CLIENTE")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Importar 2" }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalled());
    expect(h.aporte).toHaveBeenCalledWith({ data: "2026-11-05", descricao: "PIX CLIENTE", valor: 5000 });
    expect(h.despesa).toHaveBeenCalledWith({ data: "2026-11-06", descricao: "CASA DO CONSTRUTOR", valor: 1234.56 });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("desmarcar uma linha tira ela da importação", async () => {
    abrir();
    await userEvent.upload(screen.getByLabelText("Extrato OFX"), arquivo(OFX, "extrato.ofx"));
    await userEvent.click(await screen.findByRole("checkbox", { name: "Importar PIX CLIENTE" }));
    expect(screen.getByText(/1 de 2 movimentações/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Importar 1" }));
    await waitFor(() => expect(h.despesa).toHaveBeenCalled());
    expect(h.aporte).not.toHaveBeenCalled();
  });

  it("o que já está na conta vem desmarcado", async () => {
    abrir([{ tipo: "aporte", data: "2026-11-05", valor: "5000.00" }]);
    await userEvent.upload(screen.getByLabelText("Extrato OFX"), arquivo(OFX, "extrato.ofx"));
    expect(await screen.findByText(/1 de 2 movimentações/)).toBeInTheDocument();
    expect(screen.getByText(/já está na conta/)).toBeInTheDocument();
  });

  it("arquivo que não é OFX mostra o aviso e não deixa importar", async () => {
    abrir();
    await userEvent.upload(screen.getByLabelText("Extrato OFX"), arquivo("a;b;c", "x.ofx"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/não parece um extrato OFX/);
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("arquivo grande demais é recusado", async () => {
    abrir();
    const grande = new File(["x"], "grande.ofx");
    Object.defineProperty(grande, "size", { value: 6 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText("Extrato OFX"), grande);
    expect(h.toast.error).toHaveBeenCalledWith("Arquivo grande demais", expect.anything());
  });

  it("se a gravação para no meio, diz quantas entraram", async () => {
    h.despesa.mockRejectedValue(new Error("RLS negou"));
    const { onOpenChange } = abrir();
    await userEvent.upload(screen.getByLabelText("Extrato OFX"), arquivo(OFX, "extrato.ofx"));
    await userEvent.click(await screen.findByRole("button", { name: "Importar 2" }));
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith(
        "A importação parou no meio",
        expect.objectContaining({ description: expect.stringContaining("1 de 2 entraram") })
      )
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("ImportarCronogramaDialog", () => {
  const CSV =
    "Fase;Etapa;Serviço;Tarefa;Início;Fim\n" +
    "Fundação;Escavação;Locação;Marcar eixos;01/11/2026;03/11/2026\n" +
    "Fundação;Escavação;Locação;Conferir;02/11/2026;03/11/2026\n";

  const abrir = () => {
    const onOpenChange = vi.fn();
    render(
      <ImportarCronogramaDialog open onOpenChange={onOpenChange} obraId="o1" projetoId="p1" fasesExistentes={0} />
    );
    return { onOpenChange };
  };

  it("lê a planilha, resume o que entra e importa", async () => {
    const { onOpenChange } = abrir();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
    await userEvent.upload(screen.getByLabelText("Planilha do cronograma"), arquivo(CSV, "cronograma.csv"));
    expect(await screen.findByText(/Vai entrar: 1 fase, 1 etapa, 1 serviço e 2 tarefas/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Importar" }));
    await waitFor(() => expect(h.importar).toHaveBeenCalled());
    expect(h.toast.success).toHaveBeenCalledWith("Cronograma importado", expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("planilha sem as colunas mostra o erro", async () => {
    abrir();
    await userEvent.upload(screen.getByLabelText("Planilha do cronograma"), arquivo("a;b\n1;2\n", "ruim.csv"));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Importar" })).toBeDisabled();
  });

  it("erro do banco avisa e mantém aberto", async () => {
    h.importar.mockRejectedValue(new Error("RLS negou"));
    const { onOpenChange } = abrir();
    await userEvent.upload(screen.getByLabelText("Planilha do cronograma"), arquivo(CSV, "cronograma.csv"));
    await userEvent.click(await screen.findByRole("button", { name: "Importar" }));
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("Não foi possível importar", { description: "RLS negou" })
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("arquivo grande demais é recusado e o modelo pode ser baixado", async () => {
    abrir();
    const grande = new File(["x"], "grande.csv");
    Object.defineProperty(grande, "size", { value: 6 * 1024 * 1024 });
    await userEvent.upload(screen.getByLabelText("Planilha do cronograma"), grande);
    expect(h.toast.error).toHaveBeenCalledWith("Arquivo grande demais", expect.anything());

    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    await userEvent.click(screen.getByRole("button", { name: /Baixar modelo/ }));
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
