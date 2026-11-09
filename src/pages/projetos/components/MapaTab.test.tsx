import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

// Mapa de projetos: carga (com cliente à parte), erro, vazio, projetos sem coordenada,
// legenda que filtra, busca de projeto e de cliente, camada do mapa, centralizar,
// tela cheia e o painel lateral que leva ao projeto.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const mapa = vi.hoisted(() => ({ flyToBounds: vi.fn() }));
vi.mock("@/pages/mapa/MapCanvas", () => ({
  default: ({
    filtrados,
    tileKey,
    selectedProjeto,
    mapRef,
    onMarkerClick,
  }: {
    filtrados: Array<{ id: string; nome: string }>;
    tileKey: string;
    selectedProjeto: { nome: string } | null;
    mapRef: { current: unknown };
    onMarkerClick: (p: unknown) => void;
  }) => {
    mapRef.current = mapa;
    return (
      <div data-testid="mapa">
        <span>camada:{tileKey}</span>
        <span>selecionado:{selectedProjeto?.nome ?? "-"}</span>
        {filtrados.map((p) => (
          <button key={p.id} onClick={() => onMarkerClick(p)}>
            marcador:{p.nome}
          </button>
        ))}
      </div>
    );
  },
}));

Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { MapaTab } from "./MapaTab";

const linhas = [
  {
    id: "p-1",
    nome: "Residência Silva",
    codigo_projeto: "P-001",
    status: "Em andamento",
    localizacao: "Rua A, 10 - Campinas",
    latitude: -22.9,
    longitude: -47.06,
    valor_contrato: 150000,
    area_m2: 220,
    prioridade: "Alta",
    data_inicio: "2026-01-10",
    data_previsao: "2026-12-20",
    cliente_id: "c-1",
  },
  {
    id: "p-2",
    nome: "Galpão Norte",
    codigo_projeto: null,
    status: "Planejamento",
    localizacao: null,
    latitude: -23.5,
    longitude: -46.6,
    valor_contrato: null,
    area_m2: null,
    prioridade: null,
    data_inicio: null,
    data_previsao: null,
    cliente_id: null,
  },
  {
    id: "p-3",
    nome: "Sem coordenada",
    codigo_projeto: "P-003",
    status: "Planejamento",
    localizacao: "Endereço sem geocode",
    latitude: null,
    longitude: null,
    valor_contrato: 1,
    area_m2: null,
    prioridade: null,
    data_inicio: null,
    data_previsao: null,
    cliente_id: "c-1",
  },
];

function responder(projetos: unknown, erro: unknown = null) {
  fake.responder((c) => {
    if (c.tabela === "projetos_safe") return { data: projetos, error: erro };
    if (c.tabela === "clientes") return { data: [{ id: "c-1", nome: "Ana Cliente" }], error: null };
    return undefined;
  });
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<MapaTab />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={["/projetos/mapa"]}>
          <Routes>
            <Route path="/projetos/mapa" element={children} />
            <Route path="/projetos/:id" element={<div>pagina-projeto</div>} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    ),
  });
}

describe("MapaTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
  });

  it("erro na consulta mostra o aviso", async () => {
    responder(null, { message: "RLS" });
    montar();
    expect(await screen.findByText("Não foi possível carregar o mapa")).toBeInTheDocument();
  });

  it("sem projetos com coordenada mostra o vazio", async () => {
    responder([linhas[2]]);
    montar();
    expect(await screen.findByText("Nenhum projeto com localização geográfica encontrado")).toBeInTheDocument();
  });

  it("mostra os marcadores e avisa dos projetos sem coordenada", async () => {
    responder(linhas);
    montar();
    expect(await screen.findByRole("button", { name: "marcador:Residência Silva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "marcador:Galpão Norte" })).toBeInTheDocument();
    expect(screen.getByText(/projeto não aparece/)).toBeInTheDocument();
    fireEvent.click(screen.getByText(/ver projetos/));
    fireEvent.click(screen.getByRole("button", { name: /Sem coordenada/ }));
    expect(await screen.findByText("pagina-projeto")).toBeInTheDocument();
  });

  it("legenda filtra por status e clicar de novo limpa", async () => {
    responder(linhas);
    montar();
    await screen.findByTestId("mapa");
    const planejamento = screen.getByTitle("Clique para filtrar por Planejamento");
    fireEvent.click(planejamento);
    expect(screen.queryByRole("button", { name: "marcador:Residência Silva" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Clique para limpar o filtro"));
    expect(screen.getByRole("button", { name: "marcador:Residência Silva" })).toBeInTheDocument();
  });

  it("status sem projetos avisa sobre o mapa", async () => {
    responder(linhas);
    montar();
    await screen.findByTestId("mapa");
    fireEvent.click(screen.getByTitle("Clique para filtrar por Concluído"));
    expect(screen.getByText("Nenhum projeto com este status")).toBeInTheDocument();
  });

  it("filtro de status pelo seletor", async () => {
    responder(linhas);
    montar();
    await screen.findByTestId("mapa");
    fireEvent.click(screen.getByRole("button", { name: "Status" }));
    fireEvent.click(await screen.findByText("Em andamento", { selector: "[role=option] *, [role=option]" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "marcador:Galpão Norte" })).not.toBeInTheDocument()
    );
  });

  it("buscar projeto seleciona no mapa; buscar cliente enquadra os projetos dele", async () => {
    responder(linhas);
    montar();
    await screen.findByTestId("mapa");
    fireEvent.click(screen.getByRole("button", { name: /Localizar/ }));
    fireEvent.click(await screen.findByRole("option", { name: /Galpão Norte/ }));
    expect(screen.getByText("selecionado:Galpão Norte")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Localizar/ }));
    fireEvent.click(await screen.findByRole("option", { name: /Ana Cliente/ }));
    expect(mapa.flyToBounds).toHaveBeenCalledWith([[-22.9, -47.06]], expect.objectContaining({ maxZoom: 14 }));

    fireEvent.click(screen.getByRole("button", { name: /Localizar/ }));
    fireEvent.click(await screen.findByRole("option", { name: /Sem cliente/ }));
    expect(mapa.flyToBounds).toHaveBeenLastCalledWith([[-23.5, -46.6]], expect.anything());
  });

  it("centralizar enquadra os filtrados; trocar camada muda o mapa", async () => {
    responder(linhas);
    montar();
    await screen.findByTestId("mapa");
    fireEvent.click(screen.getByTitle("Centralizar todos os projetos"));
    expect(mapa.flyToBounds).toHaveBeenCalledWith(
      [
        [-22.9, -47.06],
        [-23.5, -46.6],
      ],
      expect.anything()
    );
    fireEvent.click(screen.getByRole("button", { name: /Rua/ }));
    fireEvent.click(screen.getByRole("button", { name: /Satélite/ }));
    expect(screen.getByText("camada:satelite")).toBeInTheDocument();
  });

  it("tela cheia pede e sai do modo", async () => {
    responder(linhas);
    const pedir = vi.fn().mockResolvedValue(undefined);
    const sair = vi.fn().mockResolvedValue(undefined);
    HTMLElement.prototype.requestFullscreen = pedir;
    document.exitFullscreen = sair;
    montar();
    await screen.findByTestId("mapa");
    fireEvent.click(screen.getByTitle("Tela cheia"));
    expect(pedir).toHaveBeenCalled();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: document.body });
    fireEvent(document, new Event("fullscreenchange"));
    fireEvent.click(await screen.findByTitle("Sair da tela cheia"));
    expect(sair).toHaveBeenCalled();
    Object.defineProperty(document, "fullscreenElement", { configurable: true, value: null });
  });

  it("marcador abre o painel com os dados e leva ao projeto", async () => {
    responder(linhas);
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "marcador:Residência Silva" }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("Residência Silva")).toBeInTheDocument();
    expect(within(painel).getByText("Ana Cliente")).toBeInTheDocument();
    expect(within(painel).getByText("Rua A, 10 - Campinas")).toBeInTheDocument();
    fireEvent.click(within(painel).getByRole("button", { name: /Abrir Projeto/ }));
    expect(await screen.findByText("pagina-projeto")).toBeInTheDocument();
  });

  it("painel de projeto sem cliente, valor e datas", async () => {
    responder(linhas);
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "marcador:Galpão Norte" }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("Galpão Norte")).toBeInTheDocument();
    fireEvent.keyDown(painel, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
