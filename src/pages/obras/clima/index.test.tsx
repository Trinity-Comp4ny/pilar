import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Página de Clima: lugares (obras com coordenada, cidades salvas, minha localização),
// previsão atual/48h/16 dias, alerta de chuva, histórico, salvar/remover cidade, busca
// de cidade e os erros (API fora, cidade não encontrada, geolocalização negada).

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));
const obrasMock = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock("@/pages/obras/hooks/useObras", () => ({ useObras: () => ({ data: obrasMock.data }) }));
const api = vi.hoisted(() => ({
  buscarPrevisao: vi.fn(),
  buscarHistorico: vi.fn(),
  buscarLocais: vi.fn(),
  nomeDaCoordenada: vi.fn(),
}));
vi.mock("@/pages/obras/lib/clima", async (original) => ({
  ...(await original<typeof import("@/pages/obras/lib/clima")>()),
  buscarPrevisao: (...a: unknown[]) => api.buscarPrevisao(...a),
  buscarHistorico: (...a: unknown[]) => api.buscarHistorico(...a),
  buscarLocais: (...a: unknown[]) => api.buscarLocais(...a),
  nomeDaCoordenada: (...a: unknown[]) => api.nomeDaCoordenada(...a),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import ObraClimaPage from "./index";

const previsao = {
  atual: {
    temp: 27,
    sensacao: 29,
    umidade: 70,
    vento: 12,
    rajada: 30,
    direcao: "NE",
    precipitacao: 0.4,
    code: 0,
    ehDia: false,
  },
  horas: [
    { hora: "2026-11-07T22:00", code: 2, temp: 24, chuvaProb: 0, chuvaMm: 0, ehDia: false },
    { hora: "2026-11-07T23:00", code: 61, temp: 23, chuvaProb: 40, chuvaMm: 1.2, ehDia: false },
    { hora: "2026-11-08T00:00", code: 0, temp: 22, chuvaProb: 0, chuvaMm: 0, ehDia: true },
  ],
  dias: [
    {
      data: "2026-11-07",
      code: 0,
      tempMax: 31,
      tempMin: 19,
      chuvaProb: 10,
      chuvaMm: 0,
      ventoMax: 20,
      uvMax: 9,
      nascer: "2026-11-07T05:20",
      ocaso: "2026-11-07T18:30",
    },
    {
      data: "2026-11-08",
      code: 63,
      tempMax: 25,
      tempMin: 18,
      chuvaProb: 80,
      chuvaMm: 12,
      ventoMax: 30,
      uvMax: 4,
      nascer: null,
      ocaso: null,
    },
    {
      data: "2026-11-09",
      code: 95,
      tempMax: 24,
      tempMin: 17,
      chuvaProb: 0,
      chuvaMm: 0,
      ventoMax: 30,
      uvMax: 3,
      nascer: null,
      ocaso: null,
    },
  ],
};

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<ObraClimaPage />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter>
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      </MemoryRouter>
    ),
  });
}

const geo = (impl: Geolocation["getCurrentPosition"]) =>
  Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: impl } });

describe("ObraClimaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    obrasMock.data = [];
    api.buscarPrevisao.mockResolvedValue(previsao);
    api.buscarHistorico.mockResolvedValue({ totalDias: 14, diasChuva: 3, chuvaMm: 42 });
  });
  afterEach(() => {
    // jsdom não traz geolocalização; cada teste instala a sua.
    delete (navigator as { geolocation?: unknown }).geolocation;
  });

  it("sem lugares nem último local pede para adicionar", () => {
    montar();
    expect(screen.getByText("Nenhum lugar ainda")).toBeInTheDocument();
    expect(api.buscarPrevisao).not.toHaveBeenCalled();
  });

  it("com obras mas sem escolha pede para escolher", () => {
    obrasMock.data = [
      { id: "o-1", nome: "Casa", cidade: "Campinas", latitude: -22.9, longitude: -47.06 },
      { id: "o-2", nome: "Sem local", cidade: null, latitude: null, longitude: null },
    ];
    montar();
    expect(screen.getByText("Escolha um lugar acima")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sem local" })).not.toBeInTheDocument();
  });

  it("escolher a obra mostra condição atual, 48 h, 16 dias, alerta de chuva e histórico", async () => {
    obrasMock.data = [{ id: "o-1", nome: "Casa", cidade: "Campinas", latitude: -22.9, longitude: -47.06 }];
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Casa" }));
    expect(await screen.findByText("27°C")).toBeInTheDocument();
    expect(api.buscarPrevisao).toHaveBeenCalledWith(-22.9, -47.06);
    expect(screen.getByText("Casa · Campinas")).toBeInTheDocument();
    expect(screen.getByText(/Céu limpo · sensação 29°C/)).toBeInTheDocument();
    expect(screen.getByText("12 km/h NE")).toBeInTheDocument();
    expect(screen.getByText(/9 · Muito alto/)).toBeInTheDocument();
    expect(screen.getByText("05h–18h")).toBeInTheDocument();
    expect(screen.getByText("Chuva prevista:")).toBeInTheDocument();
    expect(screen.getByText("Agora")).toBeInTheDocument();
    expect(screen.getByText("1.2 mm")).toBeInTheDocument();
    expect(screen.getByText("12 mm")).toBeInTheDocument();
    expect(await screen.findByText(/choveu em 3 dias · 42 mm/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("pilar.clima.ultimo")!)).toMatchObject({ label: "Casa · Campinas" });
  });

  it("histórico sem chuva e um dia de chuva", async () => {
    localStorage.setItem("pilar.clima.ultimo", JSON.stringify({ label: "Último", latitude: 1, longitude: 2 }));
    api.buscarHistorico.mockResolvedValueOnce({ totalDias: 14, diasChuva: 0, chuvaMm: 0 });
    montar();
    expect(await screen.findByText(/sem chuva registrada/)).toBeInTheDocument();
  });

  it("erro na previsão mostra o estado de erro", async () => {
    localStorage.setItem("pilar.clima.ultimo", JSON.stringify({ label: "Último", latitude: 1, longitude: 2 }));
    api.buscarPrevisao.mockRejectedValue(new Error("open-meteo fora"));
    montar();
    expect(await screen.findByText("Não foi possível obter o clima")).toBeInTheDocument();
  });

  it("último local corrompido no storage é ignorado", () => {
    localStorage.setItem("pilar.clima.ultimo", "{quebrado");
    montar();
    expect(screen.getByText("Nenhum lugar ainda")).toBeInTheDocument();
  });

  it("salvar a cidade vira aba; remover tira", async () => {
    localStorage.setItem("pilar.clima.ultimo", JSON.stringify({ label: "Sorocaba", latitude: 5, longitude: 6 }));
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Salvar" }));
    expect(screen.getByRole("button", { name: "Salva" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover Sorocaba" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Salva" }));
    expect(screen.queryByRole("button", { name: "Remover Sorocaba" })).not.toBeInTheDocument();
  });

  it("cidade salva é selecionável e removível pela aba", async () => {
    localStorage.setItem("pilar.clima.cidades", JSON.stringify([{ label: "Rio", latitude: 7, longitude: 8 }]));
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Rio" }));
    await waitFor(() => expect(api.buscarPrevisao).toHaveBeenCalledWith(7, 8));
    fireEvent.click(screen.getByRole("button", { name: "Remover Rio" }));
    expect(screen.queryByRole("button", { name: "Rio" })).not.toBeInTheDocument();
  });

  describe("adicionar cidade", () => {
    const abrir = () => fireEvent.click(screen.getAllByRole("button", { name: "Adicionar cidade" })[0]);

    it("busca, escolhe e passa a mostrar a previsão", async () => {
      api.buscarLocais.mockResolvedValue([
        {
          nome: "Campos",
          latitude: -21.7,
          longitude: -41.3,
          admin1: "RJ",
          pais: "Brasil",
          rotulo: "Campos, RJ, Brasil",
        },
      ]);
      montar();
      abrir();
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByPlaceholderText("Ex.: Sorocaba"), { target: { value: "Campos, RJ" } });
      fireEvent.keyDown(within(dialog).getByPlaceholderText("Ex.: Sorocaba"), { key: "Enter" });
      fireEvent.click(await within(dialog).findByRole("button", { name: "Campos, RJ, Brasil" }));
      expect(api.buscarLocais).toHaveBeenCalledWith("Campos, RJ");
      await waitFor(() => expect(api.buscarPrevisao).toHaveBeenCalledWith(-21.7, -41.3));
      expect(screen.getByRole("button", { name: "Remover Campos, RJ, Brasil" })).toBeInTheDocument();
    });

    it("consulta curta não busca", async () => {
      montar();
      abrir();
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByPlaceholderText("Ex.: Sorocaba"), { target: { value: "a" } });
      fireEvent.keyDown(within(dialog).getByPlaceholderText("Ex.: Sorocaba"), { key: "Enter" });
      expect(api.buscarLocais).not.toHaveBeenCalled();
    });

    it("cidade não encontrada avisa", async () => {
      api.buscarLocais.mockResolvedValue([]);
      montar();
      abrir();
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByPlaceholderText("Ex.: Sorocaba"), { target: { value: "Xyzwq" } });
      const campo = within(dialog).getByPlaceholderText("Ex.: Sorocaba");
      fireEvent.click(campo.parentElement!.querySelector("button")!);
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Cidade não encontrada", { description: "Tente 'cidade, estado'." })
      );
    });

    it("erro na busca avisa", async () => {
      api.buscarLocais.mockRejectedValue(new Error("rede"));
      montar();
      abrir();
      const dialog = await screen.findByRole("dialog");
      fireEvent.change(within(dialog).getByPlaceholderText("Ex.: Sorocaba"), { target: { value: "Sorocaba" } });
      fireEvent.keyDown(within(dialog).getByPlaceholderText("Ex.: Sorocaba"), { key: "Enter" });
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao buscar a cidade"));
    });
  });

  describe("minha localização", () => {
    it("sem geolocalização no dispositivo avisa", () => {
      montar();
      fireEvent.click(screen.getByRole("button", { name: /Minha localização/ }));
      expect(toast.error).toHaveBeenCalledWith("Localização não disponível neste dispositivo");
    });

    it("permissão negada avisa e volta ao estado normal", async () => {
      geo((_ok, erro) => erro?.({ code: 1 } as GeolocationPositionError));
      montar();
      fireEvent.click(screen.getByRole("button", { name: /Minha localização/ }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Não foi possível obter sua localização", {
          description: "Verifique a permissão no navegador.",
        })
      );
      expect(screen.getByRole("button", { name: /Minha localização/ })).not.toBeDisabled();
    });

    it("com permissão usa o nome da coordenada", async () => {
      geo((ok) => ok({ coords: { latitude: -23.5, longitude: -46.6 } } as GeolocationPosition));
      api.nomeDaCoordenada.mockResolvedValue("São Paulo, SP");
      montar();
      fireEvent.click(screen.getByRole("button", { name: /Minha localização/ }));
      expect(await screen.findByText("São Paulo, SP")).toBeInTheDocument();
      expect(api.buscarPrevisao).toHaveBeenCalledWith(-23.5, -46.6);
    });
  });
});
