import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PropostaDetailDialog } from "./PropostaDetailDialog";

/** Botão "Estimar obra" da proposta (SPEC 136, BEZ-143): só com a estimativa ligada e enquanto se negocia. */

const proposta = (status: string) => ({
  id: "p1",
  titulo: "Residência Almeida",
  codigo: "PRP-1",
  status,
  valor_proposto: 120000,
  area_m2: 320,
  prazo_estimado_dias: null,
  localizacao: null,
  observacao: null,
  validade: "2099-12-31",
});

const abrir = (status: string, onEstimar?: () => void) =>
  render(
    <PropostaDetailDialog
      open
      onOpenChange={vi.fn()}
      proposta={proposta(status)}
      canEdit
      canDelete
      hoje="2026-10-21"
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onStatusChange={vi.fn()}
      onGerarDocx={vi.fn()}
      onGerarContrato={vi.fn()}
      onConverter={vi.fn()}
      onEstimar={onEstimar}
    />
  );

describe("PropostaDetailDialog: estimar obra", () => {
  it.each(["rascunho", "enviada"])("oferece Estimar obra na proposta %s e chama a ação", async (status) => {
    const onEstimar = vi.fn();
    const user = userEvent.setup();
    abrir(status, onEstimar);
    expect(screen.getByText("Estimar a obra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Estimar obra" }));
    expect(onEstimar).toHaveBeenCalledTimes(1);
  });

  it("sem a ação (empresa sem estimativa), não mostra o bloco", () => {
    abrir("rascunho");
    expect(screen.queryByText("Estimar a obra")).not.toBeInTheDocument();
  });

  it.each(["aceita", "recusada"])("proposta %s não oferece estimar", (status) => {
    abrir(status, vi.fn());
    expect(screen.queryByRole("button", { name: "Estimar obra" })).not.toBeInTheDocument();
  });
});

const handlers = () => ({
  onOpenChange: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  onStatusChange: vi.fn(),
  onGerarDocx: vi.fn(),
  onGerarContrato: vi.fn(),
  onConverter: vi.fn(),
});

describe("PropostaDetailDialog: permissão", () => {
  it("sem edição, contrato enviado não oferece Assinado/Recusado nem Editar", () => {
    render(
      <PropostaDetailDialog
        open
        proposta={{ ...proposta("aceita"), contrato_enviado: true }}
        canEdit={false}
        canDelete={false}
        hoje="2026-10-21"
        {...handlers()}
      />
    );
    expect(screen.getByText("Contrato enviado, aguardando o cliente.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Assinado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Recusado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
  });

  it("com exclusão mas sem edição, recusada oferece Excluir e não Reabrir", () => {
    render(
      <PropostaDetailDialog
        open
        proposta={proposta("recusada")}
        canEdit={false}
        canDelete
        hoje="2026-10-21"
        {...handlers()}
      />
    );
    expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reabrir/ })).not.toBeInTheDocument();
  });
});
