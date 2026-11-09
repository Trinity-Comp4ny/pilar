import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type L from "leaflet";
import type { ProjetoMapa } from "./constants";

// Canvas do mapa de projetos: um marcador por projeto com o ícone do status
// (fallback para status desconhecido), tooltip com símbolo, enquadramento nos
// projetos, voo até o selecionado e o ícone do cluster por tamanho. O
// react-leaflet vira componentes simples: o jsdom não tem layout para o Leaflet.

const mapa = vi.hoisted(() => ({
  invalidateSize: vi.fn(),
  fitBounds: vi.fn(),
  flyTo: vi.fn(),
}));
const cluster = vi.hoisted(() => ({ iconCreate: null as null | ((c: { getChildCount: () => number }) => L.DivIcon) }));

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => <div data-testid="mapa">{children}</div>,
  TileLayer: ({ url, attribution }: { url: string; attribution: string }) => (
    <div data-testid="tiles" data-url={url} data-attribution={attribution} />
  ),
  Marker: ({
    children,
    icon,
    position,
    eventHandlers,
  }: {
    children: ReactNode;
    icon: L.DivIcon;
    position: [number, number];
    eventHandlers: { click: () => void };
  }) => (
    <button
      type="button"
      data-html={String(icon.options.html)}
      data-pos={position.join(",")}
      onClick={eventHandlers.click}
    >
      {children}
    </button>
  ),
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  useMap: () => mapa,
}));
vi.mock("react-leaflet-cluster", () => ({
  default: ({
    children,
    iconCreateFunction,
  }: {
    children: ReactNode;
    iconCreateFunction: (c: { getChildCount: () => number }) => L.DivIcon;
  }) => {
    cluster.iconCreate = iconCreateFunction;
    return <div data-testid="cluster">{children}</div>;
  },
}));

import MapCanvas from "./MapCanvas";
import { temCoordenadaValida, TILE_LAYERS } from "./constants";

function projeto(p: Partial<ProjetoMapa>): ProjetoMapa {
  return {
    id: "p1",
    nome: "Torre A",
    codigo_projeto: "P-01",
    status: "Em andamento",
    localizacao: null,
    latitude: -23.5,
    longitude: -46.6,
    valor_contrato: null,
    cliente_nome: null,
    cliente_id: null,
    data_inicio: null,
    data_previsao: null,
    area_m2: null,
    prioridade: null,
    ...p,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

function renderCanvas(p: Partial<Parameters<typeof MapCanvas>[0]> = {}) {
  const props = {
    filtrados: [] as ProjetoMapa[],
    tileKey: "rua" as const,
    selectedProjeto: null,
    mapRef: { current: null } as React.MutableRefObject<L.Map | null>,
    onMarkerClick: vi.fn(),
    ...p,
  };
  const view = render(<MapCanvas {...props} />);
  return { props, view };
}

describe("MapCanvas", () => {
  it("guarda o mapa na ref e recalcula o tamanho depois do layout", () => {
    const { props } = renderCanvas();
    expect(props.mapRef.current).toBe(mapa);
    expect(mapa.invalidateSize).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(mapa.invalidateSize).toHaveBeenCalledTimes(1);
  });

  it("sem projetos não reenquadra; com projetos enquadra todos", () => {
    renderCanvas();
    expect(mapa.fitBounds).not.toHaveBeenCalled();
    renderCanvas({ filtrados: [projeto({}), projeto({ id: "p2", latitude: -22.9, longitude: -43.2 })] });
    expect(mapa.fitBounds).toHaveBeenCalledTimes(1);
    const [bounds, opts] = mapa.fitBounds.mock.calls[0];
    expect(bounds.getSouthWest()).toMatchObject({ lat: -23.5, lng: -46.6 });
    expect(bounds.getNorthEast()).toMatchObject({ lat: -22.9, lng: -43.2 });
    expect(opts).toEqual({ padding: [40, 40], maxZoom: 14 });
  });

  it("marcador usa a cor do status, mostra símbolo e nome e avisa o clique", () => {
    const p = projeto({});
    const desconhecido = projeto({ id: "p2", nome: "Casa", status: "Outro" as ProjetoMapa["status"] });
    const { props } = renderCanvas({ filtrados: [p, desconhecido] });
    const torre = screen.getByText("Torre A").closest("button") as HTMLButtonElement;
    expect(torre.dataset.html).toContain("--status-progress");
    expect(torre.dataset.pos).toBe("-23.5,-46.6");
    expect(torre).toHaveTextContent("▸ Em andamento");
    const casa = screen.getByText("Casa").closest("button") as HTMLButtonElement;
    expect(casa.dataset.html).toContain("--status-unknown");
    expect(casa).toHaveTextContent("Outro");
    fireEvent.click(torre);
    expect(props.onMarkerClick).toHaveBeenCalledWith(p);
  });

  it("projeto selecionado: voa até ele e abre o detalhe depois da animação", () => {
    const p = projeto({});
    const { props, view } = renderCanvas({ selectedProjeto: p });
    expect(mapa.flyTo).toHaveBeenCalledWith([-23.5, -46.6], 16, { duration: 1.2 });
    act(() => {
      vi.advanceTimersByTime(1299);
    });
    expect(props.onMarkerClick).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(props.onMarkerClick).toHaveBeenCalledWith(p);

    // Desmontar antes do fim cancela o detalhe pendente.
    view.rerender(<MapCanvas {...props} selectedProjeto={projeto({ id: "p9" })} />);
    view.unmount();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(props.onMarkerClick).toHaveBeenCalledTimes(1);
  });

  it("camada de satélite troca a URL dos tiles", () => {
    renderCanvas({ tileKey: "satelite" });
    expect(screen.getByTestId("tiles").dataset.url).toBe(TILE_LAYERS.satelite.url);
  });

  it("ícone do cluster cresce com a quantidade", () => {
    renderCanvas();
    const icone = (n: number) => cluster.iconCreate!({ getChildCount: () => n });
    expect(icone(3).options.iconSize).toMatchObject({ x: 36, y: 36 });
    expect(String(icone(3).options.html)).toContain("font-size:13px");
    expect(icone(20).options.iconSize).toMatchObject({ x: 44, y: 44 });
    expect(String(icone(20).options.html)).toContain(">20<");
    expect(icone(80).options.iconSize).toMatchObject({ x: 52, y: 52 });
    expect(String(icone(80).options.html)).toContain("font-size:14px");
  });
});

describe("temCoordenadaValida", () => {
  it("aceita coordenadas dentro do Brasil", () => {
    expect(temCoordenadaValida(-23.5, -46.6)).toBe(true);
    expect(temCoordenadaValida(5, -34)).toBe(true);
  });

  it("recusa 0/0, fora da faixa, não numérico e infinito", () => {
    expect(temCoordenadaValida(0, 0)).toBe(false);
    expect(temCoordenadaValida(-35, -46)).toBe(false);
    expect(temCoordenadaValida(-23, -75)).toBe(false);
    expect(temCoordenadaValida(-23, -33)).toBe(false);
    expect(temCoordenadaValida(6, -46)).toBe(false);
    expect(temCoordenadaValida("-23", -46)).toBe(false);
    expect(temCoordenadaValida(-23, null)).toBe(false);
    expect(temCoordenadaValida(Number.NaN, -46)).toBe(false);
    expect(temCoordenadaValida(-23, Number.NEGATIVE_INFINITY)).toBe(false);
  });
});
