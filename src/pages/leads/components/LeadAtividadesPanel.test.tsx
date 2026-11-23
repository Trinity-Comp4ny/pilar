import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
const adicionar = vi.hoisted(() => vi.fn());
vi.mock("../hooks/useLeadAtividades", () => ({
  useLeadAtividades: () => ({ data: [], adicionar: { mutateAsync: adicionar }, excluir: { mutateAsync: vi.fn() } }),
}));
vi.mock("../hooks/useLeadPessoas", () => ({ useLeadPessoas: () => ({ data: [{ id: "p1", nome: "Ana Lima" }] }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { first_name: "Autor" } }) }));
vi.mock("@/components/atividades/ComentariosLista", () => ({ ComentariosLista: () => null }));
import { LeadAtividadesPanel } from "./LeadAtividadesPanel";
beforeAll(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
describe("campo de atividade do lead", () => {
  it("oferece @ e envia texto e menções sem pedir data ou horário", async () => {
    adicionar.mockResolvedValue(undefined);
    render(<LeadAtividadesPanel leadId="lead" canEdit />);
    expect(screen.queryByLabelText("Data da atividade")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Horário")).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Retornar com @Ana Lima" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() =>
      expect(adicionar).toHaveBeenCalledWith({ texto: "Retornar com @Ana Lima", mencionados: ["p1"] })
    );
    await waitFor(() => expect(screen.getByRole("textbox")).toHaveValue(""));
  });
});
