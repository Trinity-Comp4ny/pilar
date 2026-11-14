import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PessoaAcessoSecao } from "./PessoaAcessoSecao";

// Feedback de cliente (09/11): pessoa da Equipe com login de outro e-mail aparecia "sem acesso"
// no @ e não recebia menção. A seção mostra o vínculo e deixa o admin convidar ou ligar.

const h = vi.hoisted(() => ({
  role: "admin",
  conta: null as { id: string; nome: string; email: string } | null,
  convite: null as { id: string; email: string; expira_em: string } | null,
  contasLivres: [] as { id: string; nome: string; email: string }[],
  vincular: vi.fn(),
  convidar: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { role: h.role, empresa_id: "e1" } }) }));
vi.mock("@/hooks/useRequireAal2", () => ({ useRequireAal2: () => async () => true }));
vi.mock("sonner", () => ({ toast: { success: h.toastSuccess, error: h.toastError } }));
vi.mock("../hooks/useAcessoPessoa", () => ({
  useContaDaPessoa: () => ({ data: h.conta }),
  useConvitePendente: () => ({ data: h.convite }),
  useContasSemPessoa: () => ({ data: h.contasLivres }),
  useVincularConta: () => ({ mutate: h.vincular, isPending: false }),
  useConvidarPessoa: () => ({ mutate: h.convidar, isPending: false }),
}));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const AMANDA = { id: "p1", nome: "Amanda Rizzo", email: "amanda@pessoal.test", profile_id: null };

beforeEach(() => {
  vi.clearAllMocks();
  h.role = "admin";
  h.conta = null;
  h.convite = null;
  h.contasLivres = [];
});

describe("PessoaAcessoSecao", () => {
  it("pessoa ligada mostra o login com que ela entra", () => {
    h.conta = { id: "u1", nome: "Amanda Rizzo", email: "amanda@escritorio.test" };
    render(<PessoaAcessoSecao pessoa={{ ...AMANDA, profile_id: "u1" }} />);

    expect(screen.getByText("Tem acesso")).toBeInTheDocument();
    expect(screen.getByText("Entra como amanda@escritorio.test")).toBeInTheDocument();
  });

  it("admin convida a pessoa sem login, com o convite ligado a ela", async () => {
    const user = userEvent.setup();
    render(<PessoaAcessoSecao pessoa={AMANDA} />);

    expect(screen.getByText(/Sem login na Pilar/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Convidar para a Pilar" }));

    await waitFor(() => expect(h.convidar).toHaveBeenCalled());
    expect(h.convidar.mock.calls[0][0]).toMatchObject({ id: "p1", email: "amanda@pessoal.test" });
  });

  it("admin liga a pessoa a um login que já existe com outro e-mail", async () => {
    h.contasLivres = [{ id: "u1", nome: "Amanda Rizzo", email: "amanda@escritorio.test" }];
    const user = userEvent.setup();
    render(<PessoaAcessoSecao pessoa={AMANDA} />);

    await user.click(screen.getByRole("combobox", { name: "Conta de login" }));
    await user.click(await screen.findByRole("option", { name: "Amanda Rizzo (amanda@escritorio.test)" }));
    await user.click(screen.getByRole("button", { name: "Ligar" }));

    expect(h.vincular.mock.calls[0][0]).toEqual({ pessoaId: "p1", profileId: "u1" });
  });

  it("convite pendente vira reenviar", () => {
    h.convite = { id: "c1", email: "amanda@pessoal.test", expira_em: "2026-11-16T12:00:00Z" };
    render(<PessoaAcessoSecao pessoa={AMANDA} />);

    expect(screen.getByText(/Convite enviado para amanda@pessoal.test/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reenviar convite" })).toBeInTheDocument();
  });

  it("quem não é admin só vê o estado, sem ações", () => {
    h.role = "user";
    h.contasLivres = [{ id: "u1", nome: "Amanda Rizzo", email: "amanda@escritorio.test" }];
    render(<PessoaAcessoSecao pessoa={AMANDA} />);

    expect(screen.queryByRole("button", { name: "Convidar para a Pilar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Conta de login" })).not.toBeInTheDocument();
  });
});
