import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Lead } from "@/hooks/useLeads";
import { LeadDetailDialog } from "./LeadDetailDialog";

/** Botão "Estimar obra" do lead (SPEC 136, BEZ-24): só aparece com a estimativa ligada e em lead ainda vivo. */

const lead = (status: Lead["status"]): Lead => ({ id: "l1", nome: "Família", sobrenome: "Almeida", status });

const abrir = (status: Lead["status"], onEstimar?: () => void) =>
  render(
    <LeadDetailDialog
      open
      onOpenChange={vi.fn()}
      lead={lead(status)}
      canEdit
      members={[]}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onCreateProposta={vi.fn()}
      onConvert={vi.fn()}
      onEstimar={onEstimar}
    />
  );

describe("LeadDetailDialog: estimar obra", () => {
  it("oferece Estimar obra e chama a ação", async () => {
    const onEstimar = vi.fn();
    const user = userEvent.setup();
    abrir("Em contato", onEstimar);
    expect(screen.getByText("Estimar a obra")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Estimar obra" }));
    expect(onEstimar).toHaveBeenCalledTimes(1);
  });

  it("sem a ação (empresa sem estimativa), não mostra o bloco", () => {
    abrir("Em contato");
    expect(screen.queryByText("Estimar a obra")).not.toBeInTheDocument();
  });

  it("lead perdido não oferece estimar", () => {
    abrir("Perdido", vi.fn());
    expect(screen.queryByRole("button", { name: "Estimar obra" })).not.toBeInTheDocument();
  });
});
