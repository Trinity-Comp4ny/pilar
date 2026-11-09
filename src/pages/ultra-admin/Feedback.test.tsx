import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { EmpresaRow, UsuarioPlataforma } from "./api";
import type { FeedbackItem } from "./hooks";

// Feedback no ultra admin: padrão "em aberto", filtros por status e tipo, busca em título,
// texto, autor e empresa; detalhe com print por URL assinada curta, troca de status e a
// linha "Feedback: <id>" para o commit (SPEC 145).

const h = vi.hoisted(() => ({
  feedback: [] as FeedbackItem[],
  erro: null as Error | null,
  mutate: vi.fn(),
  signed: vi.fn(),
}));
vi.mock("./hooks", () => ({
  useFeedback: () => ({ data: h.feedback, isLoading: false, error: h.erro }),
  useUsuariosPlataforma: () => ({
    data: [{ id: "u1", nome: "Ana Lima", email: "ana@alfa.test" }] as UsuarioPlataforma[],
  }),
  useEmpresas: () => ({ data: [{ id: "e1", nome: "Alfa Engenharia" }] as EmpresaRow[] }),
  useMudarStatusFeedback: () => ({ mutate: h.mutate }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ createSignedUrl: h.signed }) } },
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

import Feedback from "./Feedback";

function item(over: Partial<FeedbackItem>): FeedbackItem {
  return {
    id: "f1",
    tipo: "bug",
    titulo: "Erro ao salvar lançamento",
    descricao: "O botão não responde",
    createdAt: "2026-11-05T10:00:00Z",
    createdBy: "u1",
    empresaId: "e1",
    rota: "/financeiro",
    navegador: "Chrome 130",
    janela: "1440x900",
    printPath: null,
    sentryEventId: null,
    status: "novo",
    ...over,
  };
}

function montar() {
  render(
    <MemoryRouter>
      <Feedback />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.erro = null;
  h.feedback = [
    item({}),
    item({
      id: "f2",
      tipo: "sugestao",
      titulo: "Exportar DRE",
      descricao: "Queria PDF",
      createdBy: "uX",
      empresaId: null,
      status: "planejado",
    }),
    item({ id: "f3", titulo: null, descricao: "Antigo", status: "resolvido" }),
  ];
});

describe("Feedback: lista", () => {
  it("abre em 'em aberto' com contagens e esconde os resolvidos", () => {
    montar();
    expect(screen.getByRole("radio", { name: /Em aberto\s*2/ })).toBeChecked();
    expect(screen.getByText("Erro ao salvar lançamento")).toBeInTheDocument();
    expect(screen.getByText("Exportar DRE")).toBeInTheDocument();
    expect(screen.queryByText("Antigo")).not.toBeInTheDocument();
  });

  it("status específico, todos e tipo filtram a lista", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("radio", { name: /Resolvido\s*1/ }));
    expect(screen.getByText("Problema relatado")).toBeInTheDocument();
    expect(screen.queryByText("Exportar DRE")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Todos\s*3/ }));
    await user.click(screen.getByRole("radio", { name: "Sugestões" }));
    expect(screen.getByText("Exportar DRE")).toBeInTheDocument();
    expect(screen.queryByText("Erro ao salvar lançamento")).not.toBeInTheDocument();
  });

  it("busca por autor e empresa; sem resultado mostra o vazio do filtro", async () => {
    const user = userEvent.setup();
    montar();
    const busca = screen.getByPlaceholderText("Buscar no feedback");
    await user.type(busca, "alfa eng");
    expect(screen.getByText("Erro ao salvar lançamento")).toBeInTheDocument();
    expect(screen.queryByText("Exportar DRE")).not.toBeInTheDocument();
    await user.clear(busca);
    await user.type(busca, "nada disso");
    expect(screen.getByText("Nenhum feedback em aberto")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Todos/ }));
    expect(screen.getByText("Nada com esses filtros")).toBeInTheDocument();
  });

  it("erro ao carregar mostra a mensagem", () => {
    h.erro = new Error("x");
    montar();
    expect(screen.getByText("Não foi possível carregar o feedback")).toBeInTheDocument();
  });
});

describe("Feedback: detalhe", () => {
  it("mostra contexto, autor com link da empresa e troca status", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText("Erro ao salvar lançamento"));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("/financeiro")).toBeInTheDocument();
    expect(within(painel).getByText("Chrome 130")).toBeInTheDocument();
    expect(within(painel).getByRole("link", { name: "Alfa Engenharia" })).toHaveAttribute(
      "href",
      "/ultra-admin/empresas/e1"
    );
    expect(h.signed).not.toHaveBeenCalled();

    await user.click(within(painel).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Planejado/ }));
    expect(h.mutate).toHaveBeenCalledWith({ id: "f1", status: "planejado" });
  });

  it("autor desconhecido e sem empresa", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText("Exportar DRE"));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("Autor desconhecido")).toBeInTheDocument();
    expect(within(painel).queryByRole("link")).not.toBeInTheDocument();
  });

  it("print abre por URL assinada de 10 minutos e mostra o Sentry", async () => {
    h.feedback = [item({ printPath: "e1/print.png", sentryEventId: "abc123" })];
    h.signed.mockResolvedValue({ data: { signedUrl: "https://signed/print.png" }, error: null });
    const user = userEvent.setup();
    montar();
    expect(screen.getByLabelText("Tem print")).toBeInTheDocument();
    await user.click(screen.getByText("Erro ao salvar lançamento"));
    const img = await screen.findByAltText("Print enviado por Ana Lima");
    expect(img).toHaveAttribute("src", "https://signed/print.png");
    expect(h.signed).toHaveBeenCalledWith("e1/print.png", 600);
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("falha ao assinar o print mostra aviso em vez da imagem", async () => {
    h.feedback = [item({ printPath: "e1/print.png" })];
    h.signed.mockResolvedValue({ data: null, error: new Error("not found") });
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByText("Erro ao salvar lançamento"));
    expect(await screen.findByText(/Não deu pra abrir o print/)).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("copiar a linha do commit usa o id do feedback; falha avisa", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    montar();
    await user.click(screen.getByText("Erro ao salvar lançamento"));
    await user.click(await screen.findByRole("button", { name: /Copiar linha do commit/ }));
    expect(writeText).toHaveBeenCalledWith("Feedback: f1");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Linha copiada", expect.anything()));

    writeText.mockRejectedValueOnce(new Error("negado"));
    await user.click(screen.getByRole("button", { name: /Copiar linha do commit/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível copiar"));
  });
});
