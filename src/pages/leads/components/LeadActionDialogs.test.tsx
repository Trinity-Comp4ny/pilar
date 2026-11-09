import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadAutoConvertDialog, LeadCreatePropostaDialog, LeadMotivoPerdasDialog } from "./LeadActionDialogs";
import { LeadCnpjConvertDialog } from "./LeadCnpjConvertDialog";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

const lookupCNPJ = vi.fn();
vi.mock("@/lib/brasilApi", async (orig) => ({
  ...(await orig<typeof import("@/lib/brasilApi")>()),
  lookupCNPJ: (...a: unknown[]) => lookupCNPJ(...a),
}));

beforeEach(() => {
  toastError.mockClear();
  lookupCNPJ.mockReset();
});

describe("LeadMotivoPerdasDialog", () => {
  function Harness({ onConfirm, onCancel = vi.fn() }: { onConfirm: (m: string) => void; onCancel?: () => void }) {
    const [motivo, setMotivo] = useState("");
    return (
      <LeadMotivoPerdasDialog
        open
        onOpenChange={vi.fn()}
        motivoPerda={motivo}
        onMotivoChange={setMotivo}
        onConfirm={() => onConfirm(motivo)}
        onCancel={onCancel}
      />
    );
  }

  it("sem motivo, não deixa confirmar a perda", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    const confirmar = screen.getByRole("button", { name: "Confirmar Perda" });
    expect(confirmar).toBeDisabled();
    await user.type(screen.getByPlaceholderText(/Preço acima/), "   ");
    expect(confirmar).toBeDisabled();
  });

  it("com motivo, confirma passando o texto", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} />);

    await user.type(screen.getByPlaceholderText(/Preço acima/), "Escolheu concorrente");
    await user.click(screen.getByRole("button", { name: "Confirmar Perda" }));

    expect(onConfirm).toHaveBeenCalledWith("Escolheu concorrente");
  });

  it("Cancelar não confirma", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<Harness onConfirm={onConfirm} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("LeadCreatePropostaDialog", () => {
  it("mostra o lead e confirma a criação", async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(
      <LeadCreatePropostaDialog
        open
        onOpenChange={vi.fn()}
        leadNome="Ana Lima"
        isPending={false}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText("Ana Lima")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("enquanto cria, trava os botões (sem proposta duplicada)", () => {
    render(<LeadCreatePropostaDialog open onOpenChange={vi.fn()} leadNome="Ana" isPending onConfirm={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Criando/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});

describe("LeadAutoConvertDialog", () => {
  it("Criar cliente converte; Apenas marcar como Ganho pula", async () => {
    const onConvert = vi.fn();
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(
      <LeadAutoConvertDialog open onOpenChange={vi.fn()} isPending={false} onConvert={onConvert} onSkip={onSkip} />
    );

    await user.click(screen.getByRole("button", { name: "Criar cliente" }));
    await user.click(screen.getByRole("button", { name: "Apenas marcar como Ganho" }));

    expect(onConvert).toHaveBeenCalledTimes(1);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("convertendo, trava o botão", () => {
    render(<LeadAutoConvertDialog open onOpenChange={vi.fn()} isPending onConvert={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Convertendo/ })).toBeDisabled();
  });
});

describe("LeadCnpjConvertDialog (lead → cliente)", () => {
  const abrir = (props: Partial<Parameters<typeof LeadCnpjConvertDialog>[0]> = {}) => {
    const onConvert = vi.fn();
    const onSkip = vi.fn();
    render(
      <LeadCnpjConvertDialog
        open
        onOpenChange={vi.fn()}
        isPending={false}
        onConvert={onConvert}
        onSkip={onSkip}
        {...props}
      />
    );
    return { onConvert, onSkip };
  };
  const campo = () => screen.getByPlaceholderText("00.000.000/0000-00");
  const buscar = () =>
    screen.getAllByRole("button").find((b) => !b.textContent?.trim() && !b.getAttribute("aria-label"))!;

  it("CNPJ inválido não habilita a busca nem o Criar cliente", async () => {
    const user = userEvent.setup();
    abrir();

    await user.type(campo(), "11222333000100");

    expect(buscar()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Criar cliente" })).toBeDisabled();
    expect(lookupCNPJ).not.toHaveBeenCalled();
  });

  it("CNPJ válido busca na Receita e converte com os dados enriquecidos", async () => {
    lookupCNPJ.mockResolvedValue({
      cnpj: "11222333000181",
      razao_social: "Alfa Engenharia LTDA",
      nome_fantasia: "Alfa",
      logradouro: "Rua A",
      numero: "10",
      bairro: "Centro",
      municipio: "Bauru",
      uf: "SP",
      cep: "17000000",
    });
    const user = userEvent.setup();
    const { onConvert } = abrir();

    await user.type(campo(), "11222333000181");
    expect(campo()).toHaveValue("11.222.333/0001-81");
    await user.click(buscar());

    expect(await screen.findByText("Alfa Engenharia LTDA")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar cliente" }));
    expect(onConvert).toHaveBeenCalledWith({
      cnpj: "11222333000181",
      razao_social: "Alfa Engenharia LTDA",
      endereco: "Rua A, 10, Centro, Bauru, SP, 17000000",
    });
  });

  it("CNPJ não encontrado na Receita avisa e mantém Criar cliente travado", async () => {
    lookupCNPJ.mockResolvedValue(null);
    const user = userEvent.setup();
    abrir();

    await user.type(campo(), "11222333000181");
    await user.click(buscar());

    expect(toastError).toHaveBeenCalledWith("CNPJ não encontrado na Receita");
    expect(screen.getByRole("button", { name: "Criar cliente" })).toBeDisabled();
  });

  it("Criar sem CNPJ converte sem enriquecimento; Apenas marcar como Ganho só move", async () => {
    const user = userEvent.setup();
    const { onConvert, onSkip } = abrir();

    await user.click(screen.getByRole("button", { name: "Criar sem CNPJ" }));
    await user.click(screen.getByRole("button", { name: "Apenas marcar como Ganho" }));

    expect(onConvert).toHaveBeenCalledWith(null);
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  it("convertendo, trava todas as ações", () => {
    abrir({ isPending: true });
    expect(screen.getByRole("button", { name: "Criar sem CNPJ" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Apenas marcar como Ganho" })).toBeDisabled();
    expect(campo()).toBeDisabled();
  });
});
