import { clicarAcaoDe, itemDeAcao } from "@/test/acoesLinha";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { EmpresaPanel } from "./EmpresaPanel";

// Complementa EmpresaPanel.test.tsx: edição/remoção de usuário, logo, máscaras e
// os caminhos de erro e de 2FA negado de cada mutação.
const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  invoke: vi.fn(),
  getUser: vi.fn(),
  requireAal2: vi.fn(),
  upload: vi.fn(),
  status: "active",
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  track: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return {
    supabase: {
      from: chain.from,
      auth: { getUser: h.getUser },
      functions: { invoke: h.invoke },
      storage: {
        from: () => ({
          upload: h.upload,
          getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
        }),
      },
    },
  };
});
vi.mock("@/hooks/useRequireAal2", () => ({ useRequireAal2: () => h.requireAal2 }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: vi.fn() }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let falhas: Partial<Record<string, ChainResult>> = {};

function cenario() {
  h.resolve.mockImplementation((q) => {
    const falha = falhas[`${q.table}:${q.op}`];
    if (falha) return falha;
    if (q.table === "profiles" && q.op === "select" && q.columns?.includes("empresas(")) {
      return {
        data: {
          id: "u1",
          empresa_id: "e1",
          role: "admin",
          empresas: { nome: "Escritório Seed", status: h.status, logo_url: "https://cdn.test/antigo.png" },
        },
      };
    }
    if (q.table === "profiles" && q.op === "select" && q.columns === "empresa_id") return { data: null };
    if (q.table === "profiles" && q.op === "select") {
      return {
        data: [
          { id: "u1", first_name: "Ana", last_name: "Admin", email: "ana@seed.test", role: "admin" },
          { id: "u2", first_name: "Bia", last_name: "Souza Lima", email: "bia@seed.test", role: "user", contato: "11" },
          { id: "u3", first_name: null, last_name: null, email: "ultra@seed.test", role: "ultra_admin" },
          { id: "u4", first_name: "Caio", last_name: null, email: null, role: "estranho" },
        ],
      };
    }
    return { error: null };
  });
}

async function renderPanel() {
  render(
    <MemoryRouter>
      <EmpresaPanel />
    </MemoryRouter>
  );
  await waitFor(() => expect(screen.getByLabelText("Nome da Empresa")).toHaveValue("Escritório Seed"));
  return userEvent.setup();
}

async function abaUsuarios(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("tab", { name: /Usuários/ }));
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:previa");
  h.calls.length = 0;
  h.status = "active";
  falhas = {};
  h.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  h.requireAal2.mockResolvedValue(true);
  h.invoke.mockResolvedValue({ data: {}, error: null });
  h.upload.mockResolvedValue({ error: null });
  cenario();
});

describe("Configurações › Empresa › usuários", () => {
  it("ultra admin é protegido contra edição", async () => {
    const user = await renderPanel();
    await abaUsuarios(user);
    await clicarAcaoDe(user, "ultra@seed.test", "Editar");
    expect(h.toastError).toHaveBeenCalledWith("Usuário protegido", expect.any(Object));
    expect(screen.queryByText("Editar usuário")).not.toBeInTheDocument();
  });

  it("edita nome composto e contato", async () => {
    const user = await renderPanel();
    await abaUsuarios(user);
    await clicarAcaoDe(user, "Bia Souza Lima", "Editar");
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByPlaceholderText("Sobrenome")).toHaveValue("Souza Lima");
    await user.clear(within(dialog).getByPlaceholderText("(11) 99999-9999"));
    await user.type(within(dialog).getByPlaceholderText("(11) 99999-9999"), "21");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Usuário atualizado"));
    const up = h.calls.find((c) => c.table === "profiles" && c.op === "update");
    expect(up?.payload).toEqual({ first_name: "Bia", last_name: "Souza Lima", contato: "21", role: "user" });
    expect(up?.filters).toContainEqual(["eq", "id", "u2"]);
  });

  it("papel desconhecido cai para user e sobrenome é obrigatório", async () => {
    const user = await renderPanel();
    await abaUsuarios(user);
    await clicarAcaoDe(user, "Caio", "Editar");
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Salvar" }));
    expect(h.toastError).toHaveBeenCalledWith("Nome e sobrenome são obrigatórios");
    expect(h.requireAal2).not.toHaveBeenCalled();
  });

  it("2FA negado não edita", async () => {
    h.requireAal2.mockResolvedValue(false);
    const user = await renderPanel();
    await abaUsuarios(user);
    await clicarAcaoDe(user, "Bia Souza Lima", "Editar");
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.requireAal2).toHaveBeenCalled());
    expect(h.calls.some((c) => c.op === "update")).toBe(false);
  });

  it("erro ao editar avisa e mantém o diálogo", async () => {
    falhas["profiles:update"] = { error: { message: "boom" } };
    const user = await renderPanel();
    await abaUsuarios(user);
    await clicarAcaoDe(user, "Bia Souza Lima", "Editar");
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível atualizar o usuário", expect.any(Object))
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("remove usuário pela edge function", async () => {
    const user = await renderPanel();
    await abaUsuarios(user);
    await clicarAcaoDe(user, "Bia Souza Lima", "Remover");
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Usuário removido"));
    expect(h.invoke).toHaveBeenCalledWith("delete-user", { body: { user_id: "u2" } });
    expect(screen.queryByRole("button", { name: "Remover Bia Souza Lima" })).not.toBeInTheDocument();
  });

  it("remoção com 2FA negado ou erro não remove", async () => {
    h.requireAal2.mockResolvedValueOnce(false);
    const user = await renderPanel();
    await abaUsuarios(user);
    await clicarAcaoDe(user, "Bia Souza Lima", "Remover");
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    await waitFor(() => expect(h.requireAal2).toHaveBeenCalled());
    expect(h.invoke).not.toHaveBeenCalled();

    h.invoke.mockResolvedValue({ data: null, error: new Error("tenancy") });
    await clicarAcaoDe(user, "Bia Souza Lima", "Remover");
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível remover o usuário", expect.any(Object))
    );
    expect(screen.getByRole("button", { name: "Mais ações de Bia Souza Lima" })).toBeInTheDocument();
  });

  it("convite para conta existente e papel admin", async () => {
    h.invoke.mockResolvedValue({ data: { conta_existente: true }, error: null });
    const user = await renderPanel();
    await abaUsuarios(user);
    await user.type(screen.getByPlaceholderText("Nome"), "Duda");
    await user.type(screen.getByPlaceholderText("email@empresa.com"), "duda@seed.test");
    await user.click(screen.getByRole("button", { name: "Adicionar usuário" }));
    await waitFor(() =>
      expect(h.toastSuccess).toHaveBeenCalledWith("Convite enviado", {
        description: "Entre com sua conta atual para acessar o escritório.",
      })
    );
    expect(h.track).toHaveBeenCalledWith("convite_enviado", { papel: "user", origem: "configuracoes" });
    expect(screen.getAllByText("duda@seed.test").length).toBeGreaterThan(0);
  });
});

describe("Configurações › Empresa › dados e logo", () => {
  it("máscaras de CNPJ, telefone e CEP", async () => {
    const user = await renderPanel();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.type(screen.getByLabelText("CNPJ"), "11222333000181");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("11.222.333/0001-81");
    await user.type(screen.getByLabelText("CEP"), "0131");
    expect(screen.getByLabelText("CEP")).toHaveValue("0131");
    await user.type(screen.getByLabelText("CEP"), "0100");
    expect(screen.getByLabelText("CEP")).toHaveValue("01310-100");
    await user.clear(screen.getByLabelText("CEP"));
    expect(screen.getByLabelText("CEP")).toHaveValue("");
    await user.type(screen.getByLabelText("Contato"), "11987654321");
    expect(screen.getByLabelText("Contato")).not.toHaveValue("11987654321");
    await user.type(screen.getByLabelText("Cidade"), "São Paulo");
    expect(screen.getByLabelText("Cidade")).toHaveValue("São Paulo");
  });

  it("perfil sem empresa ao salvar não grava", async () => {
    const user = await renderPanel();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.calls.some((c) => c.columns === "empresa_id")).toBe(true));
    expect(h.calls.some((c) => c.table === "empresas")).toBe(false);
  });

  it("status cancelado pede confirmação com o texto de cancelamento", async () => {
    h.status = "cancelled";
    const user = await renderPanel();
    await user.click(screen.getByRole("button", { name: "Editar" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Cancelar a empresa?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar empresa" })).toBeInTheDocument();
  });

  it("sessão ausente: carga e salvamento não fazem nada", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } });
    render(
      <MemoryRouter>
        <EmpresaPanel />
      </MemoryRouter>
    );
    await waitFor(() => expect(h.getUser).toHaveBeenCalled());
    expect(h.resolve).not.toHaveBeenCalled();
  });

  async function abaVisual(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("tab", { name: /Personalização/ }));
    const visual = screen.getByRole("tabpanel");
    await user.click(within(visual).getByRole("button", { name: "Editar" }));
    return visual;
  }

  function escolherArquivo(file: File) {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });
  }

  it("recusa logo com formato inválido ou grande demais", async () => {
    const user = await renderPanel();
    await abaVisual(user);
    escolherArquivo(new File(["x"], "logo.gif", { type: "image/gif" }));
    expect(h.toastError).toHaveBeenCalledWith("Formato inválido", expect.any(Object));
    const grande = new File(["x"], "logo.png", { type: "image/png" });
    Object.defineProperty(grande, "size", { value: 3 * 1024 * 1024 });
    escolherArquivo(grande);
    expect(h.toastError).toHaveBeenCalledWith("Arquivo muito grande", expect.any(Object));
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [] } });
  });

  it("sobe o logo e grava a URL pública na empresa", async () => {
    const user = await renderPanel();
    const visual = await abaVisual(user);
    escolherArquivo(new File(["x"], "Logo.SVG", { type: "image/svg+xml" }));
    await user.click(within(visual).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Configuração salva", expect.any(Object)));
    const [path] = h.upload.mock.calls[0];
    expect(path).toMatch(/^e1\/logo-\d+\.svg$/);
    const up = h.calls.find((c) => c.table === "empresas" && c.op === "update");
    expect(up?.payload).toEqual({ logo_url: `https://cdn.test/${path}` });
  });

  it("salvar visual sem arquivo novo só fecha a edição", async () => {
    const user = await renderPanel();
    const visual = await abaVisual(user);
    await user.click(within(visual).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastSuccess).toHaveBeenCalledWith("Configuração salva", expect.any(Object)));
    expect(h.upload).not.toHaveBeenCalled();
  });

  it("falha no upload ou na gravação do logo avisa", async () => {
    h.upload.mockResolvedValueOnce({ error: new Error("bucket") });
    const user = await renderPanel();
    const visual = await abaVisual(user);
    escolherArquivo(new File(["x"], "logo.png", { type: "image/png" }));
    await user.click(within(visual).getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Não foi possível salvar o logo", expect.any(Object))
    );

    falhas["empresas:update"] = { error: { message: "rls" } };
    await user.click(within(visual).getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledTimes(2));
  });
});
