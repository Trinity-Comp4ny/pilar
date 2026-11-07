import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

/**
 * Cadastro de fornecedores com o Supabase dublado na fronteira: criar, editar,
 * excluir (soft delete com desfazer), validações, busca e permissão.
 */

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

let permitido: Record<string, boolean> = {};
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (_f: string, action = "view") => permitido[action] ?? true,
    getButtonProps: (_f: string, action = "edit") => {
      const ok = permitido[action] ?? true;
      return { disabled: !ok, title: "", "aria-disabled": !ok };
    },
    isAdmin: false,
  }),
}));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));

import Fornecedores from "./index";

const CONCRETO = {
  id: "f1",
  nome: "Concreto Forte",
  cnpj: "11222333000181",
  contato: "Rui",
  email: "rui@concreto.com",
  telefone: "14999998888",
};
const ACO = { id: "f2", nome: "Aço Bom", cnpj: null, contato: null, email: null, telefone: null };

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  permitido = {};
  supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
  supabaseFake.respond("fornecedores", "select", { data: [CONCRETO, ACO] });
});

const abrir = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <Fornecedores />
      </MemoryRouter>
    </QueryClientProvider>
  );

const novo = () => screen.getAllByRole("button", { name: /Novo fornecedor/ })[0];
const form = () => screen.getByRole("dialog", { name: /fornecedor/ });
const inserts = () => supabaseFake.callsTo("fornecedores", "insert");

describe("Fornecedores: criar", () => {
  it("grava só os dígitos de CNPJ e telefone, na empresa do usuário", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Concreto Forte");

    await user.click(novo());
    const f = form();
    await user.type(within(f).getByLabelText(/Nome/), "  Areia Fina ");
    await user.type(within(f).getByLabelText("CNPJ"), "11444777000161");
    expect(within(f).getByLabelText("CNPJ")).toHaveValue("11.444.777/0001-61");
    await user.type(within(f).getByLabelText("Telefone"), "14988887777");
    await user.type(within(f).getByLabelText("Email"), "vendas@areia.com");
    await user.click(within(f).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(inserts()).toHaveLength(1));
    expect(inserts()[0].payload).toEqual({
      nome: "Areia Fina",
      cnpj: "11444777000161",
      contato: null,
      email: "vendas@areia.com",
      telefone: "14988887777",
      empresa_id: "emp-1",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Fornecedor adicionado");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("sem nome não grava", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(novo());
    const f = form();
    const nome = within(f).getByLabelText(/Nome/);
    nome.removeAttribute("required");
    await user.type(within(f).getByLabelText("Email"), "x@y.com");
    await user.click(within(f).getByRole("button", { name: "Salvar" }));

    expect(toastError).toHaveBeenCalledWith("O nome do fornecedor é obrigatório");
    expect(inserts()).toHaveLength(0);
    expect(form()).toBeInTheDocument();
  });

  it("CNPJ inválido e e-mail inválido mostram os dois erros e não gravam", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(novo());
    const f = form();
    await user.type(within(f).getByLabelText(/Nome/), "Areia");
    await user.type(within(f).getByLabelText("CNPJ"), "11444777000100");
    await user.type(within(f).getByLabelText("Email"), "vendas@areia");
    await user.click(within(f).getByRole("button", { name: "Salvar" }));

    expect(within(f).getByText("CNPJ inválido")).toBeInTheDocument();
    expect(within(f).getByText("E-mail inválido")).toBeInTheDocument();
    expect(inserts()).toHaveLength(0);
  });

  it("CNPJ já cadastrado (unique do banco) mostra a mensagem específica e mantém os dados", async () => {
    supabaseFake.respond("fornecedores", "insert", {
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "fornecedores_unique_empresa_cnpj"',
      },
    });
    const user = userEvent.setup();
    abrir();
    await user.click(novo());
    const f = form();
    await user.type(within(f).getByLabelText(/Nome/), "Areia");
    await user.type(within(f).getByLabelText("CNPJ"), "11222333000181");
    await user.click(within(f).getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("CNPJ já cadastrado para outro fornecedor"));
    expect(within(form()).getByLabelText(/Nome/)).toHaveValue("Areia");
  });

  it("outro erro do servidor avisa com mensagem segura e não fecha", async () => {
    supabaseFake.respond("fornecedores", "insert", { error: { message: "permission denied for table fornecedores" } });
    const user = userEvent.setup();
    abrir();
    await user.click(novo());
    const f = form();
    await user.type(within(f).getByLabelText(/Nome/), "Areia");
    await user.click(within(f).getByRole("button", { name: "Salvar" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Não foi possível salvar o fornecedor", {
        description: "Você não tem permissão para realizar esta ação.",
      })
    );
    expect(form()).toBeInTheDocument();
  });
});

describe("Fornecedores: editar e excluir", () => {
  it("editar carrega os dados formatados e atualiza pelo id", async () => {
    const user = userEvent.setup();
    abrir();
    const linha = (await screen.findByText("Concreto Forte")).closest("tr") as HTMLElement;

    await user.click(within(linha).getByRole("button", { name: "Editar fornecedor" }));
    const f = form();
    expect(within(f).getByLabelText("CNPJ")).toHaveValue("11.222.333/0001-81");
    expect(within(f).getByLabelText("Telefone")).toHaveValue("(14) 99999-8888");
    await user.clear(within(f).getByLabelText("Email"));
    await user.click(within(f).getByRole("button", { name: "Atualizar" }));

    await waitFor(() => expect(supabaseFake.callsTo("fornecedores", "update")).toHaveLength(1));
    const [upd] = supabaseFake.callsTo("fornecedores", "update");
    expect(upd.payload).toMatchObject({ nome: "Concreto Forte", email: null, cnpj: "11222333000181" });
    expect(upd.chain).toContainEqual(["eq", ["id", "f1"]]);
    expect(toastSuccess).toHaveBeenCalledWith("Fornecedor atualizado");
  });

  it("excluir pede confirmação, usa o RPC de soft delete e oferece desfazer", async () => {
    const user = userEvent.setup();
    abrir();
    const linha = (await screen.findByText("Concreto Forte")).closest("tr") as HTMLElement;

    await user.click(within(linha).getByRole("button", { name: "Excluir fornecedor" }));
    expect(supabaseFake.rpcCalls.some((c) => c.fn === "rpc_soft_delete")).toBe(false);
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(supabaseFake.rpcCalls).toContainEqual({
        fn: "rpc_soft_delete",
        args: { p_tabela: "fornecedores", p_id: "f1" },
      })
    );
    const [titulo, opts] = toastSuccess.mock.calls.at(-1) as [string, { action: { onClick: () => Promise<void> } }];
    expect(titulo).toBe("Fornecedor excluído");
    await opts.action.onClick();
    expect(supabaseFake.rpcCalls).toContainEqual({
      fn: "rpc_restaurar",
      args: { p_tabela: "fornecedores", p_id: "f1" },
    });
    expect(toastSuccess).toHaveBeenLastCalledWith("Fornecedor restaurado");
  });

  it("erro ao excluir avisa e mantém a confirmação", async () => {
    supabaseFake.respondRpc("rpc_soft_delete", { error: { message: "x" } });
    const user = userEvent.setup();
    abrir();
    const linha = (await screen.findByText("Concreto Forte")).closest("tr") as HTMLElement;
    await user.click(within(linha).getByRole("button", { name: "Excluir fornecedor" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Não foi possível excluir o fornecedor", expect.anything())
    );
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});

describe("Fornecedores: lista, busca e estados", () => {
  it("busca por CNPJ (com ou sem máscara) e por nome; sem resultado oferece limpar", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Concreto Forte");
    const busca = screen.getAllByPlaceholderText("Buscar fornecedores")[0];

    await user.type(busca, "22.333");
    expect(screen.getByText("Concreto Forte")).toBeInTheDocument();
    expect(screen.queryByText("Aço Bom")).not.toBeInTheDocument();

    await user.clear(busca);
    await user.type(busca, "aço");
    expect(screen.getByText("Aço Bom")).toBeInTheDocument();
    expect(screen.queryByText("Concreto Forte")).not.toBeInTheDocument();

    await user.clear(busca);
    await user.type(busca, "inexistente");
    expect(screen.getByText("Nenhum resultado encontrado")).toBeInTheDocument();
    // O X do campo de busca também se chama "Limpar busca"; aqui é o botão do estado vazio.
    const limpar = screen.getAllByRole("button", { name: "Limpar busca" });
    await user.click(limpar.find((b) => b.textContent === "Limpar busca") as HTMLElement);
    expect(screen.getByText("Aço Bom")).toBeInTheDocument();
  });

  it("lista vazia oferece criar o primeiro", async () => {
    supabaseFake.respond("fornecedores", "select", { data: [] });
    abrir();
    expect(await screen.findByText("Nenhum fornecedor cadastrado")).toBeInTheDocument();
  });

  it("erro ao carregar mostra o estado de erro e tenta de novo", async () => {
    // Só a lista da página (select "*"); a lista enxuta do Reconciliar é outra consulta.
    let falhou = false;
    supabaseFake.respondWith("fornecedores", "select", (call) => {
      if (call.chain[0]?.[1]?.[0] !== "*") return { data: [] };
      if (falhou) return { data: [ACO] };
      falhou = true;
      return { error: { message: "boom" } };
    });
    const user = userEvent.setup();
    abrir();

    expect(await screen.findByText("Não foi possível carregar os fornecedores")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Não foi possível carregar os fornecedores", expect.anything());
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(await screen.findByText("Aço Bom")).toBeInTheDocument();
  });

  it("sem permissão de escrita: sem ações, sem Reconciliar e Novo travado", async () => {
    permitido = { edit: false, create: false, delete: false };
    abrir();
    await screen.findByText("Concreto Forte");

    expect(screen.queryByRole("button", { name: "Editar fornecedor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir fornecedor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reconciliar/ })).not.toBeInTheDocument();
    expect(novo()).toBeDisabled();
  });

  it("sem permissão de criar, o vazio não oferece Novo fornecedor", async () => {
    permitido = { create: false };
    supabaseFake.respond("fornecedores", "select", { data: [] });
    abrir();
    const titulo = await screen.findByText("Nenhum fornecedor cadastrado");
    expect(within(titulo.parentElement as HTMLElement).queryByRole("button")).not.toBeInTheDocument();
  });
});
