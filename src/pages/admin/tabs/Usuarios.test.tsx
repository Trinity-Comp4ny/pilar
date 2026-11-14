import { clicarAcaoDe, itemDeAcao } from "@/test/acoesLinha";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { UsuariosTab } from "./Usuarios";

const h = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
  requireAal2: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  reportInvokeError: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: h.invoke }, rpc: h.rpc } }));
vi.mock("@/hooks/useRequireAal2", () => ({ useRequireAal2: () => h.requireAal2 }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: h.reportInvokeError }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

type RawUser = Parameters<typeof UsuariosTab>[0]["users"][number];

const SEED: RawUser[] = [
  { id: "me", nome: "Ana Admin", email: "ana@seed.test", role: "admin" },
  { id: "u2", nome: "Bruno Coord", email: "bruno@seed.test", role: "coordenador" },
  { id: "u3", nome: "Carla User", email: "carla@seed.test", role: "user" },
  { id: "ux", nome: "Root", email: "root@pilar.test", role: "ultra_admin" },
  { id: "pending-c1", inviteId: "c1", nome: "Davi", email: "davi@seed.test", role: "user", isPending: true },
];

const estado = { users: [] as RawUser[] };
function Harness({ initial = SEED }: { initial?: RawUser[] }) {
  const [users, setUsersState] = useState(initial);
  useEffect(() => {
    estado.users = users;
  }, [users]);
  return <UsuariosTab users={users} setUsers={(fn) => setUsersState((prev) => fn(prev))} currentUserId="me" />;
}

function httpError(body: unknown) {
  return new FunctionsHttpError(new Response(JSON.stringify(body), { status: 400 }));
}

async function abrirConvite() {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /Convidar usuário/ }));
  const dialog = await screen.findByRole("dialog", { name: "Convidar usuário" });
  return { user, dialog };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAal2.mockResolvedValue(true);
  h.invoke.mockResolvedValue({ data: {}, error: null });
  h.rpc.mockResolvedValue({ data: null, error: null });
});

describe("Admin › Usuários: convite", () => {
  it("sem nome ou email o envio fica desabilitado", async () => {
    render(<Harness />);
    const { user, dialog } = await abrirConvite();
    const enviar = within(dialog).getByRole("button", { name: "Enviar convite" });
    expect(enviar).toBeDisabled();
    await user.type(within(dialog).getByPlaceholderText("Nome"), "   ");
    await user.type(within(dialog).getByPlaceholderText("email@empresa.com"), "x@y.com");
    expect(enviar).toBeDisabled();
  });

  it("email inválido mostra erro e não chama a função", async () => {
    render(<Harness />);
    const { user, dialog } = await abrirConvite();
    await user.type(within(dialog).getByPlaceholderText("Nome"), "Eva");
    await user.type(within(dialog).getByPlaceholderText("email@empresa.com"), "eva@semdominio");
    await user.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(within(dialog).getByText("Email inválido")).toBeInTheDocument();
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it("gate de 2FA negado não abre o convite", async () => {
    h.requireAal2.mockResolvedValue(false);
    render(<Harness />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Convidar usuário/ }));
    await waitFor(() => expect(h.requireAal2).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sucesso envia nome completo e papel, fecha o modal e lista como pendente", async () => {
    render(<Harness />);
    const { user, dialog } = await abrirConvite();
    await user.type(within(dialog).getByPlaceholderText("Nome"), " Eva ");
    await user.type(within(dialog).getByPlaceholderText("Sobrenome"), "Lima");
    await user.type(within(dialog).getByPlaceholderText("email@empresa.com"), " eva@seed.test ");
    await user.click(within(dialog).getByRole("radio", { name: /Coordenador/ }));
    await user.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(h.invoke).toHaveBeenCalledWith("invite-user", {
      body: { email: "eva@seed.test", nome: "Eva Lima", role: "coordenador" },
    });
    expect(estado.users.at(-1)).toMatchObject({ email: "eva@seed.test", isPending: true, role: "coordenador" });
    expect(h.toastSuccess).toHaveBeenCalledWith("Convite enviado", { description: "Email enviado para eva@seed.test" });
  });

  it("limite do plano: mostra o motivo do servidor e mantém o formulário preenchido", async () => {
    h.invoke.mockResolvedValue({ data: null, error: httpError({ error: "Limite de usuários do plano atingido." }) });
    render(<Harness />);
    const { user, dialog } = await abrirConvite();
    await user.type(within(dialog).getByPlaceholderText("Nome"), "Eva");
    await user.type(within(dialog).getByPlaceholderText("email@empresa.com"), "eva@seed.test");
    await user.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao convidar", {
        description: "Limite de usuários do plano atingido.",
      })
    );
    expect(screen.getByRole("dialog", { name: "Convidar usuário" })).toBeInTheDocument();
    expect(within(dialog).getByPlaceholderText("email@empresa.com")).toHaveValue("eva@seed.test");
    expect(estado.users).toHaveLength(SEED.length);
  });

  it("erro sem corpo legível usa mensagem genérica (não o 'non-2xx')", async () => {
    h.invoke.mockResolvedValue({ data: null, error: new Error("Edge Function returned a non-2xx status code") });
    render(<Harness />);
    const { user, dialog } = await abrirConvite();
    await user.type(within(dialog).getByPlaceholderText("Nome"), "Eva");
    await user.type(within(dialog).getByPlaceholderText("email@empresa.com"), "eva@seed.test");
    await user.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Erro ao convidar", {
        description: "Não foi possível enviar o convite. Tente de novo em instantes.",
      })
    );
  });

  it("enquanto envia, o botão mostra progresso e fica desabilitado", async () => {
    let liberar: (v: unknown) => void = () => {};
    h.invoke.mockReturnValue(new Promise((r) => (liberar = r)));
    render(<Harness />);
    const { user, dialog } = await abrirConvite();
    await user.type(within(dialog).getByPlaceholderText("Nome"), "Eva");
    await user.type(within(dialog).getByPlaceholderText("email@empresa.com"), "eva@seed.test");
    await user.click(within(dialog).getByRole("button", { name: "Enviar convite" }));
    expect(await within(dialog).findByRole("button", { name: "Enviando convite..." })).toBeDisabled();
    liberar({ data: {}, error: null });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("convite pendente: reenviar e cancelar", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await clicarAcaoDe(user, "davi@seed.test", "Reenviar convite");
    await waitFor(() =>
      expect(h.invoke).toHaveBeenCalledWith("invite-user", { body: { action: "resend", convite_id: "c1" } })
    );
    await clicarAcaoDe(user, "davi@seed.test", "Cancelar convite");
    await waitFor(() =>
      expect(h.invoke).toHaveBeenCalledWith("invite-user", { method: "DELETE", body: { convite_id: "c1" } })
    );
    await waitFor(() => expect(estado.users.some((u) => u.inviteId === "c1")).toBe(false));
  });

  it("falha ao cancelar convite mantém o convite na lista", async () => {
    h.invoke.mockResolvedValue({ data: null, error: httpError({ error: "Convite não encontrado." }) });
    render(<Harness />);
    await clicarAcaoDe(userEvent.setup(), "davi@seed.test", "Cancelar convite");
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível cancelar o convite", {
        description: "Convite não encontrado.",
      })
    );
    expect(estado.users.some((u) => u.inviteId === "c1")).toBe(true);
  });

  it("convite sem id (recém-criado) pede recarregar para reenviar", async () => {
    render(<Harness initial={[{ id: "pending-1", nome: "X", email: "x@seed.test", role: "user", isPending: true }]} />);
    await clicarAcaoDe(userEvent.setup(), "x@seed.test", "Reenviar convite");
    expect(h.toastError).toHaveBeenCalledWith("Recarregue a página para reenviar este convite");
    expect(h.invoke).not.toHaveBeenCalled();
  });
});

describe("Admin › Usuários: papel, acessos e remoção", () => {
  it("ultra admin aparece protegido, sem editar/remover", () => {
    render(<Harness />);
    expect(screen.getByText("Protegido")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar acessos de Root" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remover Root" })).not.toBeInTheDocument();
  });

  it("não é possível remover a si mesmo", async () => {
    render(<Harness />);
    expect(await itemDeAcao(userEvent.setup(), "Ana Admin", "Remover")).toHaveAttribute("aria-disabled", "true");
  });

  it("trocar papel chama a RPC e atualiza a lista", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await clicarAcaoDe(user, "Carla User", "Editar acessos");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Admin da empresa/ }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("update_user_access", { p_user_id: "u3", p_role: "admin" }));
    await waitFor(() => expect(estado.users.find((u) => u.id === "u3")?.role).toBe("admin"));
  });

  it("RPC negando a troca de papel não altera a lista", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "Apenas admin pode alterar papéis" } });
    render(<Harness />);
    const user = userEvent.setup();
    await clicarAcaoDe(user, "Carla User", "Editar acessos");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Admin da empresa/ }));
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao salvar", expect.anything()));
    expect(estado.users.find((u) => u.id === "u3")?.role).toBe("user");
  });

  it("2FA negado bloqueia a troca de papel antes da RPC", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await clicarAcaoDe(user, "Carla User", "Editar acessos");
    const dialog = await screen.findByRole("dialog");
    h.requireAal2.mockResolvedValue(false);
    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() => expect(h.requireAal2).toHaveBeenCalledTimes(2));
    expect(h.rpc).not.toHaveBeenCalled();
  });

  it("usuário comum não recebe concessões; coordenador recebe e a RPC é chamada", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await clicarAcaoDe(user, "Carla User", "Editar acessos");
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByRole("switch")).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    await clicarAcaoDe(user, "Bruno Coord", "Editar acessos");
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("switch", { name: "Acesso financeiro de Bruno Coord" }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("set_financeiro_delegado", { p_user_id: "u2", p_delegado: true })
    );
    await user.click(within(dialog).getByRole("switch", { name: "Acesso de equipe de Bruno Coord" }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("set_equipe_delegado", { p_user_id: "u2", p_delegado: true })
    );
    await user.click(within(dialog).getByRole("switch", { name: "Acesso a metas de Bruno Coord" }));
    await waitFor(() =>
      expect(h.rpc).toHaveBeenCalledWith("set_metas_delegado", { p_user_id: "u2", p_delegado: true })
    );
    expect(estado.users.find((u) => u.id === "u2")).toMatchObject({
      financeiroDelegado: true,
      equipeDelegado: true,
      metasDelegado: true,
    });
  });

  it("falha na concessão não marca o acesso", async () => {
    h.rpc.mockResolvedValue({ data: null, error: { message: "Somente coordenador pode receber" } });
    render(<Harness />);
    const user = userEvent.setup();
    await clicarAcaoDe(user, "Bruno Coord", "Editar acessos");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("switch", { name: "Acesso financeiro de Bruno Coord" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalled());
    expect(estado.users.find((u) => u.id === "u2")?.financeiroDelegado).toBeFalsy();
  });

  it("remover pede confirmação e chama delete-user", async () => {
    render(<Harness />);
    const user = userEvent.setup();
    await clicarAcaoDe(user, "Carla User", "Remover");
    expect(await screen.findByText("Remover usuário")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(h.invoke).toHaveBeenCalledWith("delete-user", { body: { user_id: "u3" } }));
    await waitFor(() => expect(estado.users.some((u) => u.id === "u3")).toBe(false));
  });

  it("falha ao remover mantém o usuário", async () => {
    h.invoke.mockResolvedValue({ data: null, error: new Error("403") });
    render(<Harness />);
    const user = userEvent.setup();
    await clicarAcaoDe(user, "Carla User", "Remover");
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Erro ao remover usuário"));
    expect(estado.users.some((u) => u.id === "u3")).toBe(true);
  });
});
