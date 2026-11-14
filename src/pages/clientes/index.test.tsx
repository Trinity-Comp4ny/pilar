import { clicarAcao } from "@/test/acoesLinha";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabaseFake } from "@/hooks/testing/supabaseFake";

/**
 * Lista de Clientes com os hooks reais e o Supabase dublado na fronteira:
 * busca e filtros vão para o RPC paginado, excluir passa pela confirmação e
 * pelo soft delete, mensagem ao cliente vai para a edge function.
 */

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: vi.fn() } }));

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

import Clientes from "./index";

const ANA = {
  id: "c1",
  nome: "Ana",
  sobrenome: "Lima",
  tipo_pessoa: "PF",
  cpf_cnpj: "52998224725",
  email: "ana@lima.com",
  contato: "",
  endereco: "",
  total_count: 2,
};
const ALFA = {
  id: "c2",
  nome: "Alfa Engenharia",
  tipo_pessoa: "PJ",
  cpf_cnpj: "11222333000181",
  email: "",
  contato: "",
  endereco: "",
  total_count: 2,
};

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  permitido = {};
  supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
  supabaseFake.respondRpc("listar_origens_clientes", { data: [{ origem: "Indicação" }] });
  supabaseFake.respondRpc("listar_clientes_paginado", { data: [ANA, ALFA] });
});

const abrir = (url = "/gestao/clientes") =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[url]}>
        <Clientes />
      </MemoryRouter>
    </QueryClientProvider>
  );

const linhaDe = async (texto: string) => (await screen.findByText(texto)).closest("tr") as HTMLElement;
const ultimaChamadaLista = () =>
  supabaseFake.rpcCalls.filter((c) => c.fn === "listar_clientes_paginado").at(-1)?.args as Record<string, unknown>;

describe("Clientes: lista e estados", () => {
  it("mostra os clientes com documento formatado", async () => {
    abrir();
    const linha = await linhaDe("Ana Lima");
    expect(within(linha).getByText("529.982.247-25")).toBeInTheDocument();
    expect(await screen.findByText("11.222.333/0001-81")).toBeInTheDocument();
  });

  it("lista vazia sem filtros oferece criar o primeiro cliente", async () => {
    supabaseFake.respondRpc("listar_clientes_paginado", { data: [] });
    const user = userEvent.setup();
    abrir();

    expect(await screen.findByText("Nenhum cliente cadastrado")).toBeInTheDocument();
    const criar = screen.getAllByRole("button", { name: "Novo cliente" });
    await user.click(criar[criar.length - 1]);
    expect(screen.getByRole("heading", { name: "Novo cliente" })).toBeInTheDocument();
  });

  it("erro ao carregar mostra o estado de erro e tenta de novo", async () => {
    supabaseFake.respondRpc("listar_clientes_paginado", { error: { message: "boom" } });
    const user = userEvent.setup();
    abrir();

    expect(await screen.findByText("Erro ao carregar clientes")).toBeInTheDocument();
    const antes = supabaseFake.rpcCalls.filter((c) => c.fn === "listar_clientes_paginado").length;
    supabaseFake.respondRpc("listar_clientes_paginado", { data: [ANA] });
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText("Ana Lima")).toBeInTheDocument();
    expect(supabaseFake.rpcCalls.filter((c) => c.fn === "listar_clientes_paginado").length).toBeGreaterThan(antes);
  });

  it("busca vai para o servidor e, sem resultado, oferece limpar", async () => {
    const user = userEvent.setup();
    abrir();
    await screen.findByText("Ana Lima");

    supabaseFake.respondRpc("listar_clientes_paginado", (args) =>
      (args as { p_search: string | null }).p_search ? { data: [] } : { data: [ANA, ALFA] }
    );
    await user.type(screen.getAllByPlaceholderText("Buscar por nome, CPF/CNPJ ou email")[0], "  zzz ");

    expect(await screen.findByText("Nenhum resultado encontrado")).toBeInTheDocument();
    expect(ultimaChamadaLista()).toMatchObject({ p_search: "zzz", p_offset: 0 });

    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(await screen.findByText("Ana Lima")).toBeInTheDocument();
  });
});

describe("Clientes: excluir", () => {
  it("pede confirmação, faz soft delete pelo RPC e oferece desfazer", async () => {
    const user = userEvent.setup();
    abrir();
    const linha = await linhaDe("Ana Lima");

    await clicarAcao(user, linha, "Excluir");
    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText(/Ana Lima/)).toBeInTheDocument();
    expect(supabaseFake.rpcCalls.some((c) => c.fn === "rpc_soft_delete")).toBe(false);

    await user.click(within(confirm).getByRole("button", { name: "Excluir" }));

    await waitFor(() =>
      expect(supabaseFake.rpcCalls).toContainEqual({
        fn: "rpc_soft_delete",
        args: { p_tabela: "clientes", p_id: "c1" },
      })
    );
    const [titulo, opts] = toastSuccess.mock.calls.at(-1) as [string, { action: { onClick: () => void } }];
    expect(titulo).toBe("Cliente excluído");
    opts.action.onClick();
    await waitFor(() =>
      expect(supabaseFake.rpcCalls).toContainEqual({ fn: "rpc_restaurar", args: { p_tabela: "clientes", p_id: "c1" } })
    );
  });

  it("cancelar não exclui", async () => {
    const user = userEvent.setup();
    abrir();
    const linha = await linhaDe("Ana Lima");
    await clicarAcao(user, linha, "Excluir");
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(supabaseFake.rpcCalls.some((c) => c.fn === "rpc_soft_delete")).toBe(false);
  });

  it("erro do servidor ao excluir avisa", async () => {
    supabaseFake.respondRpc("rpc_soft_delete", { error: { message: "row-level security" } });
    const user = userEvent.setup();
    abrir();
    const linha = await linhaDe("Ana Lima");
    await clicarAcao(user, linha, "Excluir");
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Erro ao excluir", expect.anything()));
    expect(toastSuccess).not.toHaveBeenCalledWith("Cliente excluído", expect.anything());
  });
});

describe("Clientes: editar e mensagem", () => {
  it("Editar abre o formulário com os dados do cliente", async () => {
    const user = userEvent.setup();
    abrir();
    const linha = await linhaDe("Ana Lima");
    await clicarAcao(user, linha, "Editar");
    expect(screen.getByRole("heading", { name: "Editar cliente" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome *")).toHaveValue("Ana");
  });

  it("cliente sem e-mail não permite enviar mensagem", async () => {
    abrir();
    const linha = await linhaDe("Alfa Engenharia");
    await userEvent.setup().click(within(linha).getByRole("button", { name: /^Mais ações/ }));
    expect(await screen.findByRole("menuitem", { name: /Enviar mensagem/ })).toHaveAttribute("aria-disabled", "true");
  });

  it("mensagem exige assunto e texto (espaços não contam) e envia pela edge function", async () => {
    const user = userEvent.setup();
    abrir();
    const linha = await linhaDe("Ana Lima");
    await clicarAcao(user, linha, "Enviar mensagem");
    const dlg = screen.getByRole("dialog", { name: "Enviar mensagem" });
    const enviar = within(dlg).getByRole("button", { name: "Enviar" });

    expect(enviar).toBeDisabled();
    await user.type(within(dlg).getByLabelText("Assunto"), "   ");
    await user.type(within(dlg).getByLabelText("Mensagem"), "   ");
    expect(enviar).toBeDisabled();

    await user.clear(within(dlg).getByLabelText("Assunto"));
    await user.type(within(dlg).getByLabelText("Assunto"), "Projeto aprovado");
    await user.type(within(dlg).getByLabelText("Mensagem"), "Olá!");
    await user.click(enviar);

    await waitFor(() =>
      expect(supabaseFake.invokeCalls).toContainEqual({
        fn: "send-manual-client-email",
        options: { body: { cliente_id: "c1", subject: "Projeto aprovado", message: "   Olá!" } },
      })
    );
    expect(toastSuccess).toHaveBeenCalledWith("Mensagem enviada com sucesso para o cliente Ana Lima.");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Enviar mensagem" })).not.toBeInTheDocument());
  });

  it("falha no envio avisa e mantém a mensagem digitada para tentar de novo", async () => {
    supabaseFake.respondInvoke("send-manual-client-email", { error: new Error("falhou") });
    const user = userEvent.setup();
    abrir();
    const linha = await linhaDe("Ana Lima");
    await clicarAcao(user, linha, "Enviar mensagem");
    const dlg = screen.getByRole("dialog", { name: "Enviar mensagem" });
    await user.type(within(dlg).getByLabelText("Assunto"), "Assunto");
    await user.type(within(dlg).getByLabelText("Mensagem"), "Texto longo");
    await user.click(within(dlg).getByRole("button", { name: "Enviar" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Não foi possível enviar a mensagem para Ana Lima", expect.anything())
    );
    const aberto = screen.getByRole("dialog", { name: "Enviar mensagem" });
    expect(within(aberto).getByLabelText("Mensagem")).toHaveValue("Texto longo");
  });
});

describe("Clientes: permissão", () => {
  it("sem permissão de escrita: Novo cliente travado, sem editar/excluir e sem atalho no vazio", async () => {
    permitido = { edit: false, create: false, delete: false };
    abrir();
    const linha = await linhaDe("Ana Lima");

    for (const b of screen.getAllByRole("button", { name: /Novo cliente/ })) expect(b).toBeDisabled();
    expect(within(linha).queryByRole("button", { name: "Editar cliente" })).not.toBeInTheDocument();
    expect(within(linha).queryByRole("button", { name: "Excluir cliente" })).not.toBeInTheDocument();
  });

  it("busca rápida: ?new=1 abre o cadastro de novo cliente", async () => {
    abrir("/gestao/clientes?new=1");
    expect(await screen.findByRole("heading", { name: "Novo cliente" })).toBeInTheDocument();
  });

  it("busca rápida: sem permissão de criar não abre o cadastro", async () => {
    permitido = { create: false };
    abrir("/gestao/clientes?new=1");
    await linhaDe("Ana Lima");
    expect(screen.queryByRole("heading", { name: "Novo cliente" })).not.toBeInTheDocument();
  });

  it("sem permissão de criar, o vazio não oferece Novo cliente", async () => {
    permitido = { create: false };
    supabaseFake.respondRpc("listar_clientes_paginado", { data: [] });
    abrir();
    expect(await screen.findByText("Nenhum cliente cadastrado")).toBeInTheDocument();
    const vazio = screen.getByText("Nenhum cliente cadastrado").parentElement as HTMLElement;
    expect(within(vazio).queryByRole("button", { name: "Novo cliente" })).not.toBeInTheDocument();
  });
});
