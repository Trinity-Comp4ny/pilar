import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Projeto } from "@/types/projetos";

// Cronograma de todos os projetos: vazio, filtros (status, cliente, responsável, meus),
// barras clicáveis, disciplinas expandidas, arrastar barra (grava datas) e zoom.

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));
const pessoa = vi.hoisted(() => ({ data: null as null | { id: string; nome: string }, isPending: false }));
vi.mock("@/hooks/useMinhaPessoa", () => ({ useMinhaPessoa: () => pessoa }));
const reord = vi.hoisted(() => ({ mutate: vi.fn(), isPending: false }));
vi.mock("@/pages/projetos/hooks/useReordenarProjetos", () => ({ useReordenarProjetos: () => reord }));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useProjetoDisciplinas: (id: string) => ({
    isLoading: false,
    data:
      id === "p-1"
        ? [
            {
              id: "d-1",
              nome: "Estrutural",
              status: "Em Andamento",
              data_inicio: "2026-02-01",
              data_fim: "2026-04-01",
              responsaveis: [{ id: "pes-1", nome: "Ana" }],
            },
            {
              id: "d-2",
              nome: "Elétrica",
              status: "Não Iniciado",
              data_inicio: null,
              data_fim: null,
              responsaveis: [{ id: "pes-2", nome: "Bia" }],
            },
          ]
        : [],
  }),
}));

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { CronogramaProjetosTab } from "./CronogramaProjetosTab";

const disc = (nome: string, resp: string, respId: string) => ({
  disciplina: nome,
  responsavel_nome: resp,
  responsavel_id: respId,
  responsaveis: [{ responsavel_id: respId, responsavel_nome: resp }],
  status: "Em Andamento",
});

const projetos = [
  {
    id: "p-1",
    nome: "Residência Silva",
    cliente_nome: "Ana Cliente",
    status: "Em andamento",
    data_inicio: "2026-01-10",
    data_previsao: "2027-03-31",
    ordem_prioridade: 1,
    disciplinas: [disc("Estrutural", "Ana", "pes-1")],
  },
  {
    id: "p-2",
    nome: "Galpão Norte",
    cliente_nome: "Bruno Cliente",
    status: "Concluído",
    data_inicio: "2025-06-01",
    data_previsao: "2025-12-31",
    data_final: "2025-12-20",
    ordem_prioridade: 2,
    disciplinas: [disc("Elétrica", "Bia", "pes-2")],
  },
  {
    id: "p-3",
    nome: "Sem datas",
    status: "Em andamento",
    data_inicio: "",
    data_previsao: "",
    disciplinas: [],
  },
] as unknown as Projeto[];

const rota = { atual: "" };
function Local() {
  const l = useLocation();
  const atual = l.pathname + l.search + l.hash;
  useEffect(() => {
    rota.atual = atual;
  }, [atual]);
  return null;
}

function montar(props: Partial<Parameters<typeof CronogramaProjetosTab>[0]> = {}, url = "/projetos/cronograma") {
  const qc = new QueryClient();
  return render(<CronogramaProjetosTab projetos={projetos} {...props} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route
              path="*"
              element={
                <>
                  {children}
                  <Local />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  });
}

const barra = (nome: string) =>
  [...document.querySelectorAll("span.truncate")].find(
    (e) => e.textContent === nome && e.className.includes("text-3xs")
  ) as HTMLElement;

describe("CronogramaProjetosTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mobile.value = false;
    pessoa.data = null;
    pessoa.isPending = false;
    reord.isPending = false;
  });

  it("sem projetos mostra o vazio", () => {
    montar({ projetos: [] });
    expect(screen.getByText("Nenhum projeto cadastrado")).toBeInTheDocument();
  });

  it("lista só projetos com datas e mostra a marca de hoje", () => {
    montar();
    expect(barra("Residência Silva")).toBeTruthy();
    expect(barra("Galpão Norte")).toBeTruthy();
    expect(barra("Sem datas")).toBeUndefined();
    expect(screen.getByText("HOJE")).toBeInTheDocument();
  });

  it("clicar na barra abre o cronograma do projeto", () => {
    montar();
    fireEvent.click(barra("Galpão Norte"));
    expect(rota.atual).toBe("/projetos/p-2#cronograma");
  });

  it("filtro de status sem resultado avisa", () => {
    montar();
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Filtrar por status" }), { key: "Enter" });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: "Cancelado" }));
    expect(screen.getByText("Nenhum projeto com datas para exibir")).toBeInTheDocument();
  });

  it("filtro por cliente, seleção múltipla e limpar seleção", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /^Cliente/ }));
    fireEvent.click(await screen.findByRole("option", { name: /Ana Cliente/ }));
    await waitFor(() => expect(barra("Galpão Norte")).toBeUndefined());
    expect(barra("Residência Silva")).toBeTruthy();
    fireEvent.click(screen.getByRole("option", { name: /Bruno Cliente/ }));
    expect(await screen.findByText("2 selecionados")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("option", { name: /Ana Cliente/ }));
    fireEvent.click(screen.getByRole("option", { name: "Limpar seleção" }));
    await waitFor(() => expect(barra("Galpão Norte")).toBeTruthy());
  });

  it("filtro por responsável", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /^Responsável/ }));
    fireEvent.click(await screen.findByRole("option", { name: /Bia/ }));
    await waitFor(() => expect(barra("Residência Silva")).toBeUndefined());
    expect(barra("Galpão Norte")).toBeTruthy();
  });

  it("Meus projetos sem pessoa vinculada orienta e volta para todos", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Meus projetos" }));
    expect(await screen.findByText("Nenhum projeto com disciplina sua")).toBeInTheDocument();
    expect(rota.atual).toContain("meus=1");
    fireEvent.click(screen.getByRole("button", { name: "Ver todos os projetos" }));
    await waitFor(() => expect(rota.atual).not.toContain("meus=1"));
  });

  it("Meus projetos carregando a pessoa mostra o carregamento", () => {
    pessoa.isPending = true;
    montar({}, "/projetos/cronograma?meus=1");
    expect(screen.getByText("Carregando seus projetos")).toBeInTheDocument();
  });

  it("Meus projetos com pessoa mostra só os projetos dela", () => {
    pessoa.data = { id: "pes-1", nome: "Ana" };
    montar({}, "/projetos/cronograma?meus=1");
    expect(barra("Residência Silva")).toBeTruthy();
    expect(barra("Galpão Norte")).toBeUndefined();
  });

  it("expandir mostra as disciplinas do projeto, com e sem datas", () => {
    montar();
    fireEvent.click(screen.getAllByRole("button", { name: "Expandir disciplinas" })[0]);
    expect(screen.getAllByText("Estrutural").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Elétrica").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Recolher disciplinas" })[0]);
  });

  it("arrastar a barra grava as novas datas do projeto", async () => {
    const largura = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(3000);
    const onDatesChange = vi.fn().mockResolvedValue(undefined);
    montar({ onDatesChange });
    const corpo = barra("Residência Silva").parentElement as HTMLElement;
    fireEvent.mouseDown(corpo, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 500 });
    fireEvent.mouseUp(document, { clientX: 500 });
    await waitFor(() => expect(onDatesChange).toHaveBeenCalled());
    const [id, datas] = onDatesChange.mock.calls[0];
    expect(id).toBe("p-1");
    expect(datas.data_inicio > "2026-01-10").toBe(true);
    largura.mockRestore();
  });

  it("zoom em semanas e botão hoje", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Semanas/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hoje/ }));
    expect(barra("Residência Silva")).toBeTruthy();
  });

  it("no celular a coluna fica enxuta mas as barras continuam", () => {
    mobile.value = true;
    montar({ canReorder: true });
    expect(barra("Residência Silva")).toBeTruthy();
    expect(screen.queryByLabelText(/Arrastar para reordenar/)).not.toBeInTheDocument();
  });

  it("quem pode reordenar vê a alça sem filtros", () => {
    montar({ canReorder: true });
    expect(screen.getAllByLabelText(/Arrastar para reordenar/).length).toBe(2);
  });
});
