import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import type { CotacaoComPropostas } from "@/pages/obras/hooks/useObraCotacoes";

// Links da cotação para o fornecedor (SPEC 144): só cotação aberta de item gera link,
// estados do convite, revogar, gerar para fornecedor do cadastro ou novo, link mostrado
// uma vez e copiar (com e sem permissão de área de transferência).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { CotacaoConvites } from "./CotacaoConvites";

const cotacao = (c: Partial<CotacaoComPropostas> = {}) =>
  ({ id: "cot-1", status: "aberta", tipo: "item", propostas: [], ...c }) as unknown as CotacaoComPropostas;

const futuro = new Date(Date.now() + 5 * 86400000).toISOString();
const passado = new Date(Date.now() - 5 * 86400000).toISOString();
const convites = [
  {
    id: "cv-1",
    fornecedor_nome: "Depósito Norte",
    expira_em: futuro,
    aberto_em: null,
    respondido_em: null,
    revogado_em: null,
  },
  {
    id: "cv-2",
    fornecedor_nome: "Loja Sul",
    expira_em: futuro,
    aberto_em: futuro,
    respondido_em: futuro,
    revogado_em: null,
  },
  {
    id: "cv-3",
    fornecedor_nome: "Casa X",
    expira_em: passado,
    aberto_em: null,
    respondido_em: null,
    revogado_em: null,
  },
  {
    id: "cv-4",
    fornecedor_nome: "Ferragens",
    expira_em: futuro,
    aberto_em: null,
    respondido_em: null,
    revogado_em: futuro,
  },
];

function montar(c = cotacao()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<CotacaoConvites obraId="obra-1" cotacao={c} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  });
}

function comDados(lista: unknown[] = convites) {
  fake.responder((c) => {
    if (c.tabela === "obra_cotacao_convite") return { data: lista, error: null };
    if (c.tabela === "fornecedores") return { data: [{ id: "f-1", nome: "Depósito Norte" }], error: null };
    return undefined;
  });
}

describe("CotacaoConvites", () => {
  const clipboardOriginal = navigator.clipboard;
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
  });
  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboardOriginal });
  });

  it("cotação em cesta sem convites não mostra a seção", async () => {
    const { container } = montar(cotacao({ tipo: "cesta" as never }));
    await waitFor(() => expect(fake.chamadas.length).toBeGreaterThan(0));
    expect(container).toBeEmptyDOMElement();
  });

  it("aberta sem convites explica e oferece gerar", async () => {
    montar();
    expect(await screen.findByText(/Gere um link e mande ao fornecedor/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerar link" })).toBeInTheDocument();
  });

  it("lista os estados e só deixa revogar link vivo sem resposta", async () => {
    comDados();
    montar();
    expect(await screen.findByText("Depósito Norte")).toBeInTheDocument();
    expect(screen.getByText(/^em /)).toBeInTheDocument();
    expect(screen.getByText(/^expirou em/)).toBeInTheDocument();
    expect(screen.getAllByText(/^válido até/)).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Revogar" })).toHaveLength(1);
  });

  it("cotação decidida com convites mostra a lista sem gerar", async () => {
    comDados();
    montar(cotacao({ status: "decidida" as never }));
    expect(await screen.findByText("Loja Sul")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Gerar link" })).not.toBeInTheDocument();
  });

  it("revogar chama o RPC e confirma; erro avisa", async () => {
    comDados();
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link revogado"));
    expect(fake.rpc).toHaveBeenCalledWith("rpc_revogar_convite_cotacao", { p_convite_id: "cv-1" });

    rpcComEmpresa({ rpc_revogar_convite_cotacao: { data: null, error: { message: "já respondido" } } });
    fireEvent.click(screen.getByRole("button", { name: "Revogar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível revogar o link."));
  });

  it("gerar para fornecedor do cadastro mostra o link uma vez e copia", async () => {
    comDados([]);
    rpcComEmpresa({ rpc_criar_convite_cotacao: { data: { token: "tok-123", fornecedor_id: "f-1" }, error: null } });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Gerar link" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Gerar link" })).toBeDisabled();
    fireEvent.keyDown(within(dialog).getByRole("combobox", { name: "Fornecedor" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Depósito Norte" }));
    fireEvent.keyDown(within(dialog).getByRole("combobox", { name: "Validade do link" }), { key: "Enter" });
    fireEvent.click(screen.getByRole("option", { name: "15 dias" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar link" }));

    expect(await screen.findByText("Link de Depósito Norte")).toBeInTheDocument();
    expect(fake.rpc).toHaveBeenCalledWith("rpc_criar_convite_cotacao", {
      p_cotacao_id: "cot-1",
      p_fornecedor_id: "f-1",
      p_fornecedor_nome: undefined,
      p_validade_dias: 15,
    });
    const campo = screen.getByLabelText("Link da cotação") as HTMLInputElement;
    expect(campo.value).toBe(`${window.location.origin}/cotar/tok-123`);
    fireEvent.focus(campo);
    fireEvent.click(screen.getByRole("button", { name: /Copiar link/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Link copiado"));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/cotar/tok-123`);
    // "Fechar" do rodapé (o X do canto também se chama Fechar)
    fireEvent.click(screen.getAllByRole("button", { name: "Fechar" })[0]);
    await waitFor(() => expect(screen.queryByText("Link de Depósito Norte")).not.toBeInTheDocument());
  });

  it("novo fornecedor exige nome com 2+ letras; erro do servidor avisa; cópia negada orienta", async () => {
    comDados([]);
    rpcComEmpresa({ rpc_criar_convite_cotacao: { data: null, error: { message: "cotação fechada" } } });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Gerar link" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(within(dialog).getByRole("combobox", { name: "Fornecedor" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("option", { name: "Novo fornecedor" }));
    const nome = within(dialog).getByLabelText("Nome do fornecedor");
    fireEvent.change(nome, { target: { value: "A" } });
    expect(within(dialog).getByRole("button", { name: "Gerar link" })).toBeDisabled();
    fireEvent.change(nome, { target: { value: " Ferragens Sul " } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar link" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível gerar o link. Tente de novo."));
    expect(fake.rpc).toHaveBeenCalledWith(
      "rpc_criar_convite_cotacao",
      expect.objectContaining({ p_fornecedor_id: undefined, p_fornecedor_nome: "Ferragens Sul", p_validade_dias: 7 })
    );

    rpcComEmpresa({ rpc_criar_convite_cotacao: { data: { token: "t2", fornecedor_id: "f-9" }, error: null } });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("negado")) },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Gerar link" }));
    expect(await screen.findByText("Link de Ferragens Sul")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Copiar link/ }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível copiar. Selecione o link e copie à mão.")
    );
  });
});
