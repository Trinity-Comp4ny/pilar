import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText } from "lucide-react";
import { CommandPalette } from "./CommandPalette";

type Item = { tipo: string; id: string; label: string; rota: string };

const h = vi.hoisted(() => ({
  navigate: vi.fn(),
  signOut: vi.fn(),
  openSettings: vi.fn(),
  record: vi.fn(),
  toggleFavorito: vi.fn(),
  busca: { grupos: [] as unknown[], isFetching: false, enabled: false },
  favoritos: [] as Item[],
  recentes: [] as Item[],
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signOut: h.signOut }) }));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings: h.openSettings }) }));
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: (v: string) => v }));
vi.mock("@/hooks/useBuscaGlobal", () => ({ useBuscaGlobal: () => h.busca }));
vi.mock("@/hooks/useRecentItems", () => ({
  useRecentItems: () => ({
    record: h.record,
    recentes: () => h.recentes,
    favoritos: () => h.favoritos,
    toggleFavorito: h.toggleFavorito,
    isFavorito: (i: Item) => h.favoritos.some((f) => f.id === i.id),
  }),
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= vi.fn();
});

const onOpenChange = vi.fn();

function abrir() {
  render(<CommandPalette open onOpenChange={onOpenChange} />);
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.busca = { grupos: [], isFetching: false, enabled: false };
  h.favoritos = [];
  h.recentes = [];
  h.signOut.mockResolvedValue(undefined);
});

describe("CommandPalette", () => {
  it("lista navegação, criação e ações sem busca", () => {
    abrir();
    expect(screen.getByText("Ir para Início")).toBeInTheDocument();
    expect(screen.getByText("Nova despesa")).toBeInTheDocument();
    expect(screen.getByText("Configurações")).toBeInTheDocument();
    expect(screen.queryByText("Favoritos")).not.toBeInTheDocument();
  });

  it("filtra por palavra-chave e navega", async () => {
    const user = abrir();
    await user.type(screen.getByPlaceholderText(/Digite um comando/), "prospects");
    expect(screen.getByText("Ir para Leads")).toBeInTheDocument();
    expect(screen.queryByText("Ir para Início")).not.toBeInTheDocument();
    await user.click(screen.getByText("Ir para Leads"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(h.navigate).toHaveBeenCalledWith("/gestao/leads");
  });

  it("termo sem nenhum comando esconde navegação e criação, mas mantém as ações", async () => {
    const user = abrir();
    await user.type(screen.getByPlaceholderText(/Digite um comando/), "zzzz");
    expect(screen.queryByText("Navegação")).not.toBeInTheDocument();
    expect(screen.queryByText("Criar")).not.toBeInTheDocument();
    expect(screen.getByText("Sair")).toBeInTheDocument();
  });

  it("criar navega e dispara o evento da paleta", async () => {
    const listener = vi.fn();
    window.addEventListener("palette:create-lead", listener);
    const user = abrir();
    await user.click(screen.getByText("Novo lead"));
    expect(h.navigate).toHaveBeenCalledWith("/gestao/leads?new=1");
    expect(listener).toHaveBeenCalled();
    window.removeEventListener("palette:create-lead", listener);
  });

  it("configurações abre o modal na aba conta", async () => {
    const user = abrir();
    await user.click(screen.getByText("Configurações"));
    expect(h.openSettings).toHaveBeenCalledWith("conta");
  });

  it("sair encerra a sessão e vai para o login", async () => {
    const user = abrir();
    await user.click(screen.getByText("Sair"));
    await waitFor(() => expect(h.navigate).toHaveBeenCalledWith("/login"));
    expect(h.signOut).toHaveBeenCalled();
  });

  it("mostra favoritos e recentes; abrir registra o item e favoritar alterna", async () => {
    h.favoritos = [{ tipo: "cliente", id: "c1", label: "Cliente Seed", rota: "/gestao/clientes/c1" }];
    h.recentes = [
      { tipo: "desconhecido", id: "x1", label: "Item Antigo", rota: "/x/1" },
      { tipo: "projeto", id: "p1", label: "Projeto Seed", rota: "/projetos/p1" },
    ];
    const user = abrir();
    expect(screen.getByText("Favoritos")).toBeInTheDocument();
    expect(screen.getByText("Recentes")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover dos favoritos" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Adicionar aos favoritos" })[0]);
    expect(h.toggleFavorito).toHaveBeenCalledWith({
      tipo: "desconhecido",
      id: "x1",
      label: "Item Antigo",
      rota: "/x/1",
    });
    expect(h.navigate).not.toHaveBeenCalled();

    await user.click(screen.getByText("Projeto Seed"));
    expect(h.record).toHaveBeenCalledWith({ tipo: "projeto", id: "p1", label: "Projeto Seed", rota: "/projetos/p1" });
    expect(h.navigate).toHaveBeenCalledWith("/projetos/p1");
  });

  it("favorito de tipo desconhecido usa ícone padrão e abre", async () => {
    h.favoritos = [{ tipo: "outro", id: "o1", label: "Página X", rota: "/p/x" }];
    const user = abrir();
    await user.click(screen.getByText("Página X"));
    expect(h.navigate).toHaveBeenCalledWith("/p/x");
  });

  it("buscando mostra estado de carregamento", () => {
    h.busca = { grupos: [], isFetching: true, enabled: true };
    abrir();
    expect(screen.getByText("Buscando...")).toBeInTheDocument();
    expect(screen.queryByText("Configurações")).not.toBeInTheDocument();
  });

  it("busca sem resultados avisa", () => {
    h.busca = { grupos: [], isFetching: false, enabled: true };
    abrir();
    expect(screen.getByText("Nenhum registro encontrado")).toBeInTheDocument();
  });

  it("resultado da busca abre e registra nos recentes", async () => {
    h.busca = {
      enabled: true,
      isFetching: false,
      grupos: [
        {
          tipo: "proposta",
          itens: [
            { tipo: "proposta", id: "pr1", label: "Proposta Seed", rota: "/gestao/propostas/pr1", icon: FileText },
          ],
        },
      ],
    };
    const user = abrir();
    expect(screen.getByText("proposta")).toBeInTheDocument();
    await user.click(screen.getByText("Proposta Seed"));
    expect(h.record).toHaveBeenCalledWith({
      tipo: "proposta",
      id: "pr1",
      label: "Proposta Seed",
      rota: "/gestao/propostas/pr1",
    });
    expect(h.navigate).toHaveBeenCalledWith("/gestao/propostas/pr1");
  });
});
