import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { CompanyData, CompanyUser } from "../types";
import { CompanyDataTab } from "./CompanyDataTab";
import { CompanySummaryCard } from "./CompanySummaryCard";
import { CompanyUsersTab } from "./CompanyUsersTab";
import { CompanyVisualTab } from "./CompanyVisualTab";
import { DeleteUserDialog, EditUserDialog, LogoPreviewDialog } from "./CompanyDialogs";

/**
 * Peças da tela de Empresa (usadas pelo Admin e pelo painel de configurações).
 * São controladas: o teste confere o que mostram e o que devolvem ao dono,
 * principalmente o bloqueio de edição para quem não é admin.
 */

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:previa");
});

const EMPRESA: CompanyData = {
  nomeEmpresa: "Seed Engenharia",
  cnpj: "11.222.333/0001-81",
  email: "contato@seed.test",
  contato: "",
  endereco: "Rua A, 1",
  cidade: "São Paulo",
  estado: "SP",
  cep: "01000-000",
  status: "active",
};

const LOGO = new File(["x"], "logo.png", { type: "image/png" });

describe("CompanyDataTab", () => {
  const props = () => ({
    companyData: EMPRESA,
    editing: false,
    isAdmin: true,
    isLoading: false,
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onSave: vi.fn(),
    onChange: vi.fn(),
    onStatusChange: vi.fn(),
    onDisciplinasChange: vi.fn(),
  });

  it("leitura: campos somente leitura, status como selo e editar habilitado para admin", async () => {
    const p = props();
    render(<CompanyDataTab {...p} />);
    expect(screen.getByLabelText("Nome da Empresa")).toHaveAttribute("readonly");
    expect(screen.getByText("Ativa")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Editar" }));
    expect(p.onEdit).toHaveBeenCalledOnce();
  });

  it("não-admin ou carregando não consegue editar", () => {
    const { rerender } = render(<CompanyDataTab {...props()} isAdmin={false} />);
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
    rerender(<CompanyDataTab {...props()} isLoading />);
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
    expect(screen.queryByLabelText("Nome da Empresa")).not.toBeInTheDocument();
  });

  it("edição: cada campo devolve sua chave; status troca pela lista; salvar e cancelar", async () => {
    const p = { ...props(), editing: true };
    render(<CompanyDataTab {...p} />);
    const user = userEvent.setup();
    fireEvent.change(screen.getByLabelText("CNPJ"), { target: { value: "x" } });
    fireEvent.change(screen.getByLabelText("Chave Pix"), { target: { value: "pix@seed.test" } });
    fireEvent.change(screen.getByLabelText("Instruções (opcional)"), { target: { value: "Itaú" } });
    expect(p.onChange).toHaveBeenCalledWith("cnpj", "x");
    expect(p.onChange).toHaveBeenCalledWith("pixChave", "pix@seed.test");
    expect(p.onChange).toHaveBeenCalledWith("pixInstrucoes", "Itaú");
    expect(screen.getByLabelText("Estado")).toHaveAttribute("maxLength", "2");

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Suspensa" }));
    expect(p.onStatusChange).toHaveBeenCalledWith("suspended");

    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(p.onSave).toHaveBeenCalledOnce();
    expect(p.onCancel).toHaveBeenCalledOnce();
  });

  it("status desconhecido aparece cru", () => {
    render(<CompanyDataTab {...props()} companyData={{ ...EMPRESA, status: "trial" }} />);
    expect(screen.getByText("trial")).toBeInTheDocument();
  });
});

describe("CompanySummaryCard", () => {
  const renderCard = (over: Partial<Parameters<typeof CompanySummaryCard>[0]> = {}) => {
    const onLogoPreview = vi.fn();
    render(
      <MemoryRouter>
        <CompanySummaryCard
          companyData={EMPRESA}
          usersCount={7}
          editingCompany={false}
          pendingLogoFile={null}
          onLogoPreview={onLogoPreview}
          {...over}
        />
      </MemoryRouter>
    );
    return { onLogoPreview };
  };

  it("mostra dados com traço no vazio, total da equipe e link para a equipe", () => {
    renderCard({ companyData: { ...EMPRESA, status: "cancelled" } });
    expect(screen.getByText("Seed Engenharia")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument(); // contato vazio
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver equipe/ })).toHaveAttribute("href", "/gestao/equipe");
  });

  it("sem logo não abre prévia; nome vazio vira 'Empresa'", async () => {
    const { onLogoPreview } = renderCard({ companyData: { ...EMPRESA, nomeEmpresa: "" } });
    expect(screen.getByText("Empresa")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("Sem logo"));
    expect(onLogoPreview).not.toHaveBeenCalled();
  });

  it("logo pendente tem precedência e abre a prévia por clique ou Enter", () => {
    const { onLogoPreview } = renderCard({
      pendingLogoFile: LOGO,
      companyData: { ...EMPRESA, logoUrl: "https://cdn.seed.test/logo.png" },
    });
    const img = screen.getByAltText("Logo (prévia)");
    expect(img).toHaveAttribute("src", "blob:previa");
    fireEvent.keyDown(img.parentElement!, { key: "Enter" });
    fireEvent.keyDown(img.parentElement!, { key: "a" });
    fireEvent.click(img.parentElement!);
    expect(onLogoPreview).toHaveBeenCalledTimes(2);
  });
});

describe("CompanyUsersTab", () => {
  const USERS: CompanyUser[] = [
    { id: "me", name: "Ana Admin", email: "ana@seed.test", role: "admin" },
    { id: "u2", name: "Bruno", email: "bruno@seed.test", role: "" },
    { id: "pending-c1", name: "Davi", email: "davi@seed.test", role: "user" },
  ];
  const props = () => ({
    users: USERS,
    isAdmin: true,
    currentUserId: "me",
    inviteFirstName: "",
    inviteLastName: "",
    inviteEmail: "",
    inviteRole: "user" as const,
    isInviting: false,
    onInviteFirstNameChange: vi.fn(),
    onInviteLastNameChange: vi.fn(),
    onInviteEmailChange: vi.fn(),
    onInviteRoleChange: vi.fn(),
    onAddUser: vi.fn(),
    onEditUser: vi.fn(),
    onDeleteUser: vi.fn(),
  });

  it("convite exige nome e email; envio em andamento bloqueia", () => {
    const { rerender } = render(<CompanyUsersTab {...props()} />);
    expect(screen.getByRole("button", { name: "Adicionar usuário" })).toBeDisabled();
    rerender(<CompanyUsersTab {...props()} inviteFirstName="  " inviteEmail="x@y.z" />);
    expect(screen.getByRole("button", { name: "Adicionar usuário" })).toBeDisabled();
    rerender(<CompanyUsersTab {...props()} inviteFirstName="Eva" inviteEmail="eva@seed.test" />);
    expect(screen.getByRole("button", { name: "Adicionar usuário" })).toBeEnabled();
    rerender(<CompanyUsersTab {...props()} inviteFirstName="Eva" inviteEmail="eva@seed.test" isInviting />);
    expect(screen.getByRole("button", { name: "Enviando convite..." })).toBeDisabled();
  });

  it("campos do convite devolvem o valor digitado e a função escolhida", () => {
    const p = props();
    render(<CompanyUsersTab {...p} />);
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Eva" } });
    fireEvent.change(screen.getByLabelText("Sobrenome"), { target: { value: "Lima" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "eva@seed.test" } });
    expect(p.onInviteFirstNameChange).toHaveBeenCalledWith("Eva");
    expect(p.onInviteLastNameChange).toHaveBeenCalledWith("Lima");
    expect(p.onInviteEmailChange).toHaveBeenCalledWith("eva@seed.test");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "admin" }));
    expect(p.onInviteRoleChange).toHaveBeenCalledWith("admin");
  });

  it("pendente não tem ações e o próprio usuário não pode se remover", async () => {
    const p = props();
    render(<CompanyUsersTab {...p} />);
    expect(screen.getAllByText("Pendente").length).toBeGreaterThan(0);
    const user = userEvent.setup();
    const removerMobile = screen.getAllByRole("button", { name: "Remover" });
    // Ana (eu) e Bruno; Davi pendente fica sem botão.
    expect(removerMobile).toHaveLength(2);
    expect(removerMobile[0]).toBeDisabled();
    await user.click(removerMobile[1]);
    expect(p.onDeleteUser).toHaveBeenCalledWith("u2");
    await user.click(screen.getAllByRole("button", { name: "Editar" })[1]);
    expect(p.onEditUser).toHaveBeenCalledWith(USERS[1]);
  });

  it("não-admin não vê o formulário de convite nem ações", () => {
    render(<CompanyUsersTab {...props()} isAdmin={false} />);
    expect(screen.queryByRole("button", { name: "Adicionar usuário" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover" })).not.toBeInTheDocument();
  });

  it("sem usuários mostra o vazio", () => {
    render(<CompanyUsersTab {...props()} users={[]} />);
    expect(screen.getAllByText("Nenhum usuário adicionado").length).toBeGreaterThan(0);
  });
});

describe("CompanyVisualTab", () => {
  const props = () => ({
    companyData: EMPRESA,
    editing: false,
    isAdmin: true,
    isLoading: false,
    pendingLogoFile: null as File | null,
    onEdit: vi.fn(),
    onCancel: vi.fn(),
    onSave: vi.fn(),
    onLogoFileChange: vi.fn(),
    onLogoPreview: vi.fn(),
  });

  it("fora da edição o upload fica desabilitado e sem logo não há prévia", async () => {
    const p = props();
    const { container } = render(<CompanyVisualTab {...p} />);
    expect(container.querySelector('input[type="file"]')).toBeDisabled();
    await userEvent.setup().click(screen.getByText("Nenhuma logo enviada"));
    expect(p.onLogoPreview).not.toHaveBeenCalled();
  });

  it("em edição aceita arquivo, mostra prévia e expande", async () => {
    const p = { ...props(), editing: true, pendingLogoFile: LOGO };
    const { container } = render(<CompanyVisualTab {...p} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeEnabled();
    await userEvent.setup().upload(input, LOGO);
    expect(p.onLogoFileChange).toHaveBeenCalled();
    expect(screen.getByAltText("Logo (prévia)")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByAltText("Logo (prévia)").parentElement!, { key: "Enter" });
    expect(p.onLogoPreview).toHaveBeenCalledOnce();
    await userEvent.setup().click(screen.getByRole("button", { name: "Salvar" }));
    expect(p.onSave).toHaveBeenCalledOnce();
  });

  it("logo salva aparece e não-admin não edita", () => {
    render(<CompanyVisualTab {...props()} isAdmin={false} companyData={{ ...EMPRESA, logoUrl: "https://x/l.png" }} />);
    expect(screen.getByAltText("Logo")).toHaveAttribute("src", "https://x/l.png");
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
  });
});

describe("CompanyDialogs", () => {
  it("prévia ampliada: arquivo pendente, logo salva ou vazio", () => {
    const { rerender } = render(<LogoPreviewDialog open onOpenChange={vi.fn()} pendingLogoFile={LOGO} />);
    expect(screen.getByAltText("Logo (prévia)")).toBeInTheDocument();
    rerender(<LogoPreviewDialog open onOpenChange={vi.fn()} pendingLogoFile={null} logoUrl="https://x/l.png" />);
    expect(screen.getByAltText("Logo")).toBeInTheDocument();
    rerender(<LogoPreviewDialog open onOpenChange={vi.fn()} pendingLogoFile={null} />);
    expect(screen.getByText("Nenhuma logo enviada")).toBeInTheDocument();
  });

  it("editar usuário devolve cada campo e fecha no cancelar", async () => {
    const p = {
      onOpenChange: vi.fn(),
      onFirstNameChange: vi.fn(),
      onLastNameChange: vi.fn(),
      onContactChange: vi.fn(),
      onRoleChange: vi.fn(),
      onSave: vi.fn(),
    };
    render(<EditUserDialog open firstName="Ana" lastName="Lima" contact="" role="user" {...p} />);
    fireEvent.change(screen.getByPlaceholderText("Nome"), { target: { value: "Bia" } });
    fireEvent.change(screen.getByPlaceholderText("Sobrenome"), { target: { value: "Souza" } });
    fireEvent.change(screen.getByPlaceholderText("(11) 99999-9999"), { target: { value: "11" } });
    expect(p.onFirstNameChange).toHaveBeenCalledWith("Bia");
    expect(p.onLastNameChange).toHaveBeenCalledWith("Souza");
    expect(p.onContactChange).toHaveBeenCalledWith("11");
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "admin" }));
    expect(p.onRoleChange).toHaveBeenCalledWith("admin");
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(p.onSave).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(p.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("remover usuário confirma só no botão de remover", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<DeleteUserDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    const dialog = screen.getByRole("alertdialog");
    const user = userEvent.setup();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Remover" }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});
