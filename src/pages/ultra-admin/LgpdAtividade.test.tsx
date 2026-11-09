import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EmpresaRow } from "./api";
import type { EventoAtividade } from "./hooks";

// Pedidos LGPD (SPEC 116): prazo legal com atraso, único admin não pode ser excluído (só
// recusado com motivo), aprovar/recusar passam pela edge e o erro dela vira toast.
// Atividade: filtros por tipo, empresa e busca (inclusive no nome da empresa), erro com retry.

const h = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  eventos: [] as EventoAtividade[],
  carregando: false,
  erro: null as Error | null,
  refetch: vi.fn(),
  empresaFiltrada: [] as Array<string | null>,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: h.rpc, functions: { invoke: h.invoke } } }));
vi.mock("@/lib/edgeError", () => ({ mensagemDaFunction: async (e: Error, padrao: string) => e.message || padrao }));
vi.mock("./hooks", () => ({
  useEmpresas: () => ({
    data: [
      { id: "e1", nome: "Alfa Engenharia" },
      { id: "e2", nome: "Beta" },
    ] as EmpresaRow[],
  }),
  useAtividade: (empresaId: string | null) => {
    h.empresaFiltrada.push(empresaId);
    return { data: h.eventos, isLoading: h.carregando, error: h.erro, refetch: h.refetch };
  },
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    title,
    search,
    children,
  }: {
    title: string;
    search?: { value: string; onChange: (v: string) => void; placeholder: string };
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {search && (
        <input
          placeholder={search.placeholder}
          value={search.value}
          onChange={(e) => search.onChange(e.target.value)}
        />
      )}
      {children}
    </main>
  ),
}));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import PedidosLgpd from "./PedidosLgpd";
import Atividade from "./Atividade";

const DIA = 86_400_000;

function pedido(over: Record<string, unknown> = {}) {
  return {
    id: "p1",
    titular_nome: "Carla Souza",
    titular_email: "carla@seed.test",
    empresa_nome: "Alfa Engenharia",
    motivo: "Saí da empresa",
    status: "pending",
    requested_at: new Date(Date.now() - 5 * DIA).toISOString(),
    prazo_em: new Date(Date.now() + 10 * DIA).toISOString(),
    notes: null,
    unico_admin: false,
    ...over,
  };
}

function montar(el: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{el}</MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.rpc.mockResolvedValue({ data: [pedido()], error: null });
  h.invoke.mockResolvedValue({ error: null });
  h.eventos = [];
  h.carregando = false;
  h.erro = null;
  h.empresaFiltrada = [];
});

describe("PedidosLgpd", () => {
  it("mostra prazo, atraso, único admin e pedido fechado sem ações", async () => {
    h.rpc.mockResolvedValue({
      data: [
        pedido(),
        pedido({
          id: "p2",
          titular_nome: "Davi",
          prazo_em: new Date(Date.now() - 2.5 * DIA).toISOString(),
          status: "failed",
          notes: "erro na edge",
        }),
        pedido({
          id: "p3",
          titular_nome: "Eva",
          unico_admin: true,
          prazo_em: new Date(Date.now() + 2 * DIA).toISOString(),
        }),
        pedido({ id: "p4", titular_nome: "Fabio", status: "done", titular_email: null, empresa_nome: null }),
      ],
      error: null,
    });
    montar(<PedidosLgpd />);
    expect(await screen.findByText("Carla Souza")).toBeInTheDocument();
    expect(screen.getByText("10 d")).toBeInTheDocument();
    expect(screen.getByText("Atrasado 2 d")).toBeInTheDocument();
    expect(screen.getByText("2 d")).toBeInTheDocument();
    expect(screen.getByText("ver nota")).toHaveAttribute("title", "erro na edge");
    const linhaEva = screen.getByText("Eva").closest("tr")!;
    expect(within(linhaEva).getByRole("button", { name: "Excluir dados" })).toBeDisabled();
    const linhaFabio = screen.getByText("Fabio").closest("tr")!;
    expect(within(linhaFabio).queryByRole("button")).not.toBeInTheDocument();
    expect(within(linhaFabio).getByText("-")).toBeInTheDocument();
  });

  it("lista vazia mostra o vazio", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    montar(<PedidosLgpd />);
    expect(await screen.findByText("Nenhum pedido de exclusão até agora.")).toBeInTheDocument();
  });

  it("erro ao listar mostra a mensagem", async () => {
    h.rpc.mockResolvedValue({ data: null, error: new Error("mfa") });
    montar(<PedidosLgpd />);
    expect(await screen.findByText("Não foi possível carregar os pedidos")).toBeInTheDocument();
  });

  it("aprovar mostra o motivo do titular e chama a edge", async () => {
    const user = userEvent.setup();
    montar(<PedidosLgpd />);
    await user.click(await screen.findByRole("button", { name: "Excluir dados" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Motivo do titular: Saí da empresa")).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Excluir dados" }));
    await waitFor(() =>
      expect(h.invoke).toHaveBeenCalledWith("excluir-dados-titular", { body: { request_id: "p1", acao: "aprovar" } })
    );
    expect(toast.success).toHaveBeenCalledWith("Dados excluídos e titular avisado");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("recusar exige motivo e manda sem espaços", async () => {
    const user = userEvent.setup();
    montar(<PedidosLgpd />);
    await user.click(await screen.findByRole("button", { name: "Recusar" }));
    const dialogo = await screen.findByRole("dialog");
    const recusar = within(dialogo).getByRole("button", { name: "Recusar e avisar" });
    expect(recusar).toBeDisabled();
    await user.type(within(dialogo).getByLabelText("Motivo"), "  único admin  ");
    await user.click(recusar);
    await waitFor(() =>
      expect(h.invoke).toHaveBeenCalledWith("excluir-dados-titular", {
        body: { request_id: "p1", acao: "recusar", motivo: "único admin" },
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Pedido recusado e titular avisado");
  });

  it("erro da edge vira toast com a mensagem dela e o diálogo fica", async () => {
    h.invoke.mockResolvedValue({ error: new Error("Titular é o único admin") });
    const user = userEvent.setup();
    montar(<PedidosLgpd />);
    await user.click(await screen.findByRole("button", { name: "Excluir dados" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Excluir dados" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Titular é o único admin"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("cancelar a recusa limpa o motivo", async () => {
    const user = userEvent.setup();
    montar(<PedidosLgpd />);
    await user.click(await screen.findByRole("button", { name: "Recusar" }));
    await user.type(within(await screen.findByRole("dialog")).getByLabelText("Motivo"), "x");
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Recusar" }));
    expect(within(await screen.findByRole("dialog")).getByLabelText("Motivo")).toHaveValue("");
  });
});

describe("Atividade", () => {
  const agora = new Date().toISOString();
  beforeEach(() => {
    h.eventos = [
      {
        id: "a1",
        quando: agora,
        ator: "matheus@pilar.app",
        frase: "criou a empresa Alfa",
        detalhe: null,
        tipo: "empresa",
        empresaId: "e1",
        link: null,
      },
      {
        id: "a2",
        quando: agora,
        ator: null,
        frase: "Nova empresa cadastrada",
        detalhe: "Beta se cadastrou pelo site",
        tipo: "cadastro",
        empresaId: "e2",
        link: null,
      },
      {
        id: "a3",
        quando: agora,
        ator: "m@pilar",
        frase: "mudou o plano",
        detalhe: null,
        tipo: "cobranca",
        empresaId: null,
        link: null,
      },
    ];
  });

  it("lista o feed com link da empresa e conta por tipo", () => {
    montar(<Atividade />);
    expect(screen.getByRole("radio", { name: /Tudo\s*3/ })).toBeChecked();
    expect(screen.getByText("criou a empresa Alfa")).toBeInTheDocument();
    expect(screen.getByText("Beta se cadastrou pelo site")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alfa Engenharia" })).toHaveAttribute("href", "/ultra-admin/empresas/e1");
    expect(screen.queryByRole("radio", { name: /Feedback/ })).not.toBeInTheDocument();
  });

  it("filtra por tipo e busca no nome da empresa", async () => {
    const user = userEvent.setup();
    montar(<Atividade />);
    await user.click(screen.getByRole("radio", { name: /Cadastro/ }));
    expect(screen.queryByText("criou a empresa Alfa")).not.toBeInTheDocument();
    expect(screen.getByText("Nova empresa cadastrada")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Tudo/ }));
    await user.type(screen.getByPlaceholderText("Buscar na atividade"), "alfa engenharia");
    expect(screen.getByText("criou a empresa Alfa")).toBeInTheDocument();
    expect(screen.queryByText("mudou o plano")).not.toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Buscar na atividade"), "zzz");
    expect(screen.getByText("Nada por aqui com esses filtros")).toBeInTheDocument();
  });

  it("escolher empresa consulta só ela", async () => {
    const user = userEvent.setup();
    montar(<Atividade />);
    expect(h.empresaFiltrada.at(-1)).toBeNull();
    await user.click(screen.getByRole("combobox", { name: "Filtrar por empresa" }));
    await user.click(await screen.findByRole("option", { name: "Beta" }));
    expect(h.empresaFiltrada.at(-1)).toBe("e2");
  });

  it("erro oferece tentar de novo", async () => {
    h.erro = new Error("x");
    const user = userEvent.setup();
    montar(<Atividade />);
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(h.refetch).toHaveBeenCalled();
  });

  it("carregando não mostra o feed", () => {
    h.carregando = true;
    montar(<Atividade />);
    expect(screen.queryByText("criou a empresa Alfa")).not.toBeInTheDocument();
  });
});
