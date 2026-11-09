import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { EmpresaRow, UsuarioPlataforma } from "./api";

// Listas do ultra admin: Empresas (situação derivada de status + cobrança, busca por nome ou
// CNPJ, criar empresa com ou sem ressalva) e Usuários (filtros por papel/empresa/acesso,
// ultra admin sem menu de ações, remoção com confirmação).

const h = vi.hoisted(() => ({
  empresas: [] as EmpresaRow[],
  usuarios: [] as UsuarioPlataforma[],
  carregando: false,
  erro: null as Error | null,
  edgeFetch: vi.fn(),
}));
vi.mock("./hooks", async (orig) => ({
  ...(await orig<typeof import("./hooks")>()),
  useEmpresas: () => ({ data: h.empresas, isLoading: h.carregando, error: h.erro }),
  useUsuariosPlataforma: () => ({ data: h.usuarios, isLoading: h.carregando, error: h.erro }),
}));
vi.mock("./api", async (orig) => ({ ...(await orig<typeof import("./api")>()), edgeFetch: h.edgeFetch }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/monitoring", () => ({ reportInvokeError: vi.fn() }));
// O shell da página depende do sidebar do app; aqui só importam título, busca e ação primária.
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    title,
    search,
    primaryAction,
    children,
  }: {
    title: string;
    search?: { value: string; onChange: (v: string) => void; placeholder: string };
    primaryAction?: { label: string; onClick: () => void };
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
      {primaryAction && <button onClick={primaryAction.onClick}>{primaryAction.label}</button>}
      {children}
    </main>
  ),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import Empresas from "./Empresas";
import Usuarios from "./Usuarios";

function Local() {
  const l = useLocation();
  return <p data-testid="local">{l.pathname + l.search}</p>;
}

function montar(el: React.ReactNode, rota = "/") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}>
        <Routes>
          <Route path="/" element={el} />
          <Route path="/ultra-admin/empresas/:id" element={<Local />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function empresa(over: Partial<EmpresaRow>): EmpresaRow {
  return {
    id: "e1",
    nome: "Alfa Engenharia",
    cnpj: "12.345.678/0001-90",
    status: "active",
    features: {},
    plano: "pro",
    usersCount: 3,
    cobranca: { status: "active", trialEndsAt: null, isPaying: true, convidada: false },
    createdAt: "2026-01-01T00:00:00Z",
    ultimoAcesso: null,
    ...over,
  };
}

function usuario(over: Partial<UsuarioPlataforma>): UsuarioPlataforma {
  return {
    id: "u1",
    nome: "Ana Lima",
    email: "ana@alfa.test",
    role: "admin",
    empresaId: "e1",
    empresaNome: "Alfa Engenharia",
    createdAt: "2026-01-01T00:00:00Z",
    lastSignInAt: null,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.carregando = false;
  h.erro = null;
  h.empresas = [
    empresa({}),
    empresa({
      id: "e2",
      nome: "Beta Arquitetura",
      cnpj: "98.765.432/0001-10",
      cobranca: {
        status: "trialing",
        trialEndsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        isPaying: false,
        convidada: false,
      },
    }),
    empresa({ id: "e3", nome: "Gama Antiga", cnpj: null, status: "cancelled" }),
  ];
  h.usuarios = [];
});

describe("Empresas", () => {
  it("'Todas' esconde arquivadas e conta por situação", () => {
    montar(<Empresas />);
    const filtros = screen.getByRole("radiogroup", { name: "Filtrar por situação" });
    expect(within(filtros).getByRole("radio", { name: /Todas\s*2/ })).toBeChecked();
    expect(screen.getByText("Alfa Engenharia")).toBeInTheDocument();
    expect(screen.getByText("Beta Arquitetura")).toBeInTheDocument();
    expect(screen.queryByText("Gama Antiga")).not.toBeInTheDocument();
  });

  it("filtro pela URL mostra só a situação pedida; valor inválido cai em Todas", () => {
    montar(<Empresas />, "/?situacao=arquivada");
    expect(screen.getByText("Gama Antiga")).toBeInTheDocument();
    expect(screen.queryByText("Alfa Engenharia")).not.toBeInTheDocument();
  });

  it("situação inválida na URL é ignorada", () => {
    montar(<Empresas />, "/?situacao=hackeada");
    expect(screen.getByText("Alfa Engenharia")).toBeInTheDocument();
  });

  it("clicar no chip troca o filtro", () => {
    montar(<Empresas />);
    fireEvent.click(screen.getByRole("radio", { name: /Em teste/ }));
    expect(screen.getByText("Beta Arquitetura")).toBeInTheDocument();
    expect(screen.queryByText("Alfa Engenharia")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Todas/ }));
    expect(screen.getByText("Alfa Engenharia")).toBeInTheDocument();
  });

  it("busca por nome e por CNPJ só com dígitos; sem resultado mostra vazio da busca", async () => {
    montar(<Empresas />);
    const busca = screen.getByPlaceholderText("Buscar por nome ou CNPJ");
    await userEvent.type(busca, "98765");
    expect(screen.getByText("Beta Arquitetura")).toBeInTheDocument();
    expect(screen.queryByText("Alfa Engenharia")).not.toBeInTheDocument();
    await userEvent.clear(busca);
    await userEvent.type(busca, "zzz");
    expect(screen.getByText("Nenhuma empresa com esse nome ou CNPJ")).toBeInTheDocument();
  });

  it("clicar na linha abre o detalhe", () => {
    montar(<Empresas />);
    fireEvent.click(screen.getByText("Alfa Engenharia"));
    expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/empresas/e1");
  });

  it("erro ao carregar mostra a mensagem de erro", () => {
    h.erro = new Error("falhou");
    montar(<Empresas />);
    expect(screen.getByText("Não foi possível carregar as empresas")).toBeInTheDocument();
  });

  async function criar() {
    fireEvent.click(screen.getByRole("button", { name: /Criar empresa/ }));
    fireEvent.change(await screen.findByLabelText("Nome da empresa"), { target: { value: "Delta" } });
    fireEvent.change(screen.getByLabelText("E-mail do dono"), { target: { value: "dono@delta.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Criar e convidar dono" }));
  }

  it("criar empresa chama a edge, avisa e abre a empresa nova", async () => {
    h.edgeFetch.mockResolvedValue({ empresa_id: "e9", warning: null });
    montar(<Empresas />);
    await criar();
    await waitFor(() => expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/empresas/e9"));
    expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-empresas", {
      method: "POST",
      body: {
        nome: "Delta",
        owner_email: "dono@delta.com",
        owner_nome: null,
        cnpj: null,
        site: null,
        porte: null,
        disciplinas: [],
        origem: null,
      },
    });
    expect(toast.success).toHaveBeenCalledWith("Empresa criada", expect.anything());
  });

  it("criar com ressalva avisa a ressalva e, sem id, fica na lista", async () => {
    h.edgeFetch.mockResolvedValue({ warning: "Convite não enviado" });
    montar(<Empresas />);
    await criar();
    await waitFor(() =>
      expect(toast.warning).toHaveBeenCalledWith("Empresa criada com ressalva", { description: "Convite não enviado" })
    );
    expect(screen.queryByTestId("local")).not.toBeInTheDocument();
  });

  it("falha ao criar mantém o diálogo e avisa o erro", async () => {
    h.edgeFetch.mockRejectedValue(new Error("E-mail já usado"));
    montar(<Empresas />);
    await criar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível criar a empresa", expect.anything())
    );
    expect(screen.getByLabelText("Nome da empresa")).toBeInTheDocument();
  });
});

describe("Usuarios", () => {
  const recente = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const antigo = new Date(Date.now() - 20 * 86_400_000).toISOString();

  beforeEach(() => {
    h.usuarios = [
      usuario({ lastSignInAt: recente }),
      usuario({
        id: "u2",
        nome: "Bruno Reis",
        email: "bruno@beta.test",
        role: "user",
        empresaId: "e2",
        empresaNome: "Beta Arquitetura",
        lastSignInAt: antigo,
      }),
      usuario({ id: "u3", nome: null, email: "nunca@alfa.test", role: "coordenador", lastSignInAt: null }),
      usuario({ id: "u4", nome: "Root", email: "root@pilar", role: "ultra_admin", empresaId: null, empresaNome: null }),
    ];
  });

  it("conta por papel e filtra pelos chips", () => {
    montar(<Usuarios />);
    expect(screen.getByRole("radio", { name: /Todos\s*4/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: /Coordenadores\s*1/ }));
    expect(screen.getByText("nunca@alfa.test")).toBeInTheDocument();
    expect(screen.queryByText("Ana Lima")).not.toBeInTheDocument();
    expect(screen.getByText("Sem nome")).toBeInTheDocument();
  });

  it("busca por nome ou e-mail e mostra vazio quando nada casa", async () => {
    montar(<Usuarios />);
    const busca = screen.getByPlaceholderText("Buscar por nome ou e-mail");
    await userEvent.type(busca, "BRUNO@");
    expect(screen.getByText("Bruno Reis")).toBeInTheDocument();
    expect(screen.queryByText("Ana Lima")).not.toBeInTheDocument();
    await userEvent.type(busca, "xyz");
    expect(screen.getByText("Nenhum usuário com esses filtros")).toBeInTheDocument();
  });

  it("ultra admin não tem menu de ações; os demais têm", () => {
    montar(<Usuarios />);
    expect(screen.queryByRole("button", { name: "Ações de Root" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ações de Ana Lima" })).toBeInTheDocument();
  });

  it("clicar no usuário abre a empresa dele na aba usuários; sem empresa não navega", () => {
    montar(<Usuarios />);
    fireEvent.click(screen.getByText("Root"));
    expect(screen.queryByTestId("local")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Bruno Reis"));
    expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/empresas/e2?tab=usuarios");
  });

  it("remover usuário pede confirmação e chama a edge com a empresa", async () => {
    h.edgeFetch.mockResolvedValue({});
    const user = userEvent.setup();
    montar(<Usuarios />);
    await user.click(screen.getByRole("button", { name: "Ações de Bruno Reis" }));
    await user.click(await screen.findByRole("menuitem", { name: "Remover usuário" }));
    expect(await screen.findByText("Remover usuário?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remover" }));
    await waitFor(() =>
      expect(h.edgeFetch).toHaveBeenCalledWith("ultra-admin-usuarios", {
        method: "DELETE",
        body: { user_id: "u2", empresa_id: "e2" },
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Usuário removido");
  });

  it("'Abrir empresa' no menu leva à empresa", async () => {
    const user = userEvent.setup();
    montar(<Usuarios />);
    await user.click(screen.getByRole("button", { name: "Ações de Ana Lima" }));
    await user.click(await screen.findByRole("menuitem", { name: "Abrir empresa" }));
    expect(screen.getByTestId("local")).toHaveTextContent("/ultra-admin/empresas/e1?tab=usuarios");
  });

  it("sem nenhum último acesso some a coluna e o filtro de acesso", () => {
    h.usuarios = h.usuarios.map((u) => ({ ...u, lastSignInAt: null }));
    montar(<Usuarios />);
    expect(screen.queryByRole("combobox", { name: "Filtrar por último acesso" })).not.toBeInTheDocument();
    expect(screen.queryByText("Último acesso")).not.toBeInTheDocument();
  });

  it("erro ao carregar mostra a mensagem", () => {
    h.erro = new Error("x");
    montar(<Usuarios />);
    expect(screen.getByText("Não foi possível carregar os usuários")).toBeInTheDocument();
  });
});
