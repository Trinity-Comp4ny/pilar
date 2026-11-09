import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const monitoring = vi.hoisted(() => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
}));
vi.mock("@/lib/monitoring", () => ({ monitoring }));

import {
  buscarClimaDoDia,
  buscarHistorico,
  buscarLocais,
  buscarPrevisao,
  climaPorCodigo,
  geocodarCidade,
  nomeDaCoordenada,
} from "./clima";

function respondeCom(json: unknown, ok = true) {
  const fn = vi.fn().mockResolvedValue({ ok, json: async () => json });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  monitoring.captureException.mockClear();
  monitoring.addBreadcrumb.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("climaPorCodigo: tabela WMO completa", () => {
  it.each([
    [1, "Predomínio de sol", "ensolarado"],
    [2, "Parcialmente nublado", "nublado"],
    [3, "Nublado", "nublado"],
    [45, "Névoa", "nublado"],
    [48, "Névoa", "nublado"],
    [53, "Garoa", "chuvoso"],
    [61, "Chuva", "chuvoso"],
    [66, "Chuva congelante", "chuvoso"],
    [67, "Chuva congelante", "chuvoso"],
    [73, "Neve", "nublado"],
    [80, "Pancadas de chuva", "chuvoso"],
    [81, "Pancadas de chuva", "chuvoso"],
    [82, "Pancadas fortes", "chuva_forte"],
    [85, "Pancadas de neve", "nublado"],
    [86, "Pancadas de neve", "nublado"],
    [96, "Trovoada com granizo", "chuva_forte"],
    [99, "Trovoada com granizo", "chuva_forte"],
    [undefined, "Indisponível", "nublado"],
  ])("código %s → %s", (code, label, rdo) => {
    const r = climaPorCodigo(code);
    expect(r.label).toBe(label);
    expect(r.rdo).toBe(rdo);
  });
});

describe("buscarLocais", () => {
  it("consulta curta não chama a API", async () => {
    const f = respondeCom({});
    expect(await buscarLocais("a")).toEqual([]);
    expect(await buscarLocais(", PR")).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });

  it("monta rótulo e põe primeiro quem casa com o estado informado", async () => {
    const f = respondeCom({
      results: [
        { name: "Toledo", latitude: 1, longitude: 2, admin1: "Castilla", country: "Espanha" },
        { name: "Toledo", latitude: 3, longitude: 4, admin1: "Paraná", country: "Brasil" },
        { name: "Toledo", latitude: 5, longitude: 6 },
      ],
    });
    const r = await buscarLocais("Toledo, paraná");
    expect(f.mock.calls[0][0]).toContain("name=Toledo");
    expect(r[0].rotulo).toBe("Toledo, Paraná, Brasil");
    expect(r.map((l) => l.admin1)).toEqual(["Paraná", "Castilla", null]);
    expect(r[2]).toMatchObject({ pais: null, rotulo: "Toledo" });
  });

  it("sem estado mantém a ordem da API e sem results devolve vazio", async () => {
    respondeCom({ results: [{ name: "A", latitude: 1, longitude: 1, admin1: "X" }] });
    expect((await buscarLocais("Abc")).map((l) => l.nome)).toEqual(["A"]);
    respondeCom({});
    expect(await geocodarCidade("Curitiba")).toEqual([]);
  });

  it("HTTP com erro lança", async () => {
    respondeCom({}, false);
    await expect(buscarLocais("Curitiba")).rejects.toThrow("Falha ao buscar a cidade");
  });

  it("formato inesperado reporta ao Sentry e lança", async () => {
    respondeCom({ results: [{ name: 1 }] });
    await expect(buscarLocais("Curitiba")).rejects.toThrow("Falha ao buscar a cidade");
    expect(monitoring.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ fn: "buscarLocais" }),
      expect.anything()
    );
  });
});

describe("buscarPrevisao: falhas e defaults", () => {
  it("HTTP com erro lança", async () => {
    respondeCom({}, false);
    await expect(buscarPrevisao(1, 2)).rejects.toThrow("Falha ao buscar a previsão");
  });

  it("formato inesperado reporta e lança", async () => {
    respondeCom({ daily: { time: "x" } });
    await expect(buscarPrevisao(1, 2)).rejects.toThrow("Falha ao buscar a previsão");
    expect(monitoring.captureException).toHaveBeenCalled();
  });

  it("resposta vazia vira previsão com defaults (sem dias nem horas)", async () => {
    respondeCom({});
    const p = await buscarPrevisao(1, 2);
    expect(p.dias).toEqual([]);
    expect(p.horas).toEqual([]);
    expect(p.atual).toMatchObject({ temp: 0, sensacao: 0, code: -1, ehDia: true, direcao: "" });
  });

  it("dias com campos opcionais nulos caem nos defaults; horas no passado começam do início", async () => {
    respondeCom({
      current: { temperature_2m: 20.4, is_day: 0, wind_direction_10m: 90 },
      hourly: {
        time: ["2000-01-01T00:00", "2000-01-01T01:00"],
        temperature_2m: [10, 11],
        weather_code: [0, 1],
        precipitation_probability: [null, 5],
        precipitation: [null, 1.26],
        is_day: [null, 0],
      },
      daily: {
        time: ["2026-01-01"],
        weather_code: [1],
        temperature_2m_max: [30],
        temperature_2m_min: [20],
        precipitation_probability_max: [null],
        precipitation_sum: [null],
        wind_speed_10m_max: [null],
        uv_index_max: [null],
        sunrise: [],
        sunset: [],
      },
    });
    const p = await buscarPrevisao(1, 2);
    expect(p.atual).toMatchObject({ temp: 20, sensacao: 20, ehDia: false, direcao: "L" });
    expect(p.dias[0]).toMatchObject({ chuvaProb: 0, chuvaMm: 0, ventoMax: 0, uvMax: 0, nascer: null, ocaso: null });
    expect(p.horas).toHaveLength(2);
    expect(p.horas[0]).toMatchObject({ chuvaProb: 0, chuvaMm: 0, ehDia: true });
    expect(p.horas[1]).toMatchObject({ chuvaProb: 5, chuvaMm: 1.3, ehDia: false });
  });
});

describe("buscarHistorico", () => {
  it("conta dias com chuva ≥ 1mm e soma o total (nulos como zero)", async () => {
    const f = respondeCom({ daily: { precipitation_sum: [0.5, 2, null, 10.6, 3] } });
    const h = await buscarHistorico(1, 2, 4);
    expect(f.mock.calls[0][0]).toContain("past_days=4");
    expect(h).toEqual({ totalDias: 4, diasChuva: 2, chuvaMm: 13 });
  });

  it("sem daily devolve zeros, com 14 dias por padrão", async () => {
    respondeCom({});
    expect(await buscarHistorico(1, 2)).toEqual({ totalDias: 14, diasChuva: 0, chuvaMm: 0 });
  });

  it("HTTP com erro lança", async () => {
    respondeCom({}, false);
    await expect(buscarHistorico(1, 2)).rejects.toThrow("Falha ao buscar o histórico");
  });

  it("formato inesperado reporta e lança", async () => {
    respondeCom({ daily: { precipitation_sum: "x" } });
    await expect(buscarHistorico(1, 2)).rejects.toThrow("Falha ao buscar o histórico");
    expect(monitoring.captureException).toHaveBeenCalled();
  });
});

describe("buscarClimaDoDia: falhas silenciosas", () => {
  it("formato inesperado reporta e devolve null", async () => {
    respondeCom({ daily: { time: 1 } });
    expect(await buscarClimaDoDia(1, 2, "2026-09-01")).toBeNull();
    expect(monitoring.captureException).toHaveBeenCalled();
  });

  it("exceção de rede devolve null", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("boom")));
    expect(await buscarClimaDoDia(1, 2, "2099-01-01")).toBeNull();
  });
});

describe("nomeDaCoordenada", () => {
  it("cidade + estado", async () => {
    respondeCom({ city: "Curitiba", principalSubdivision: "Paraná" });
    expect(await nomeDaCoordenada(1, 2)).toBe("Curitiba, Paraná");
  });

  it("cai para locality e omite estado ausente", async () => {
    respondeCom({ city: "", locality: "Distrito" });
    expect(await nomeDaCoordenada(1, 2)).toBe("Distrito");
  });

  it("sem cidade nem localidade usa o rótulo padrão", async () => {
    respondeCom({});
    expect(await nomeDaCoordenada(1, 2)).toBe("Minha localização");
  });

  it("HTTP com erro usa o rótulo padrão", async () => {
    respondeCom({}, false);
    expect(await nomeDaCoordenada(1, 2)).toBe("Minha localização");
  });

  it("formato inesperado reporta e usa o rótulo padrão", async () => {
    respondeCom({ city: 42 });
    expect(await nomeDaCoordenada(1, 2)).toBe("Minha localização");
    expect(monitoring.captureException).toHaveBeenCalled();
  });

  it("rede offline (TypeError) só deixa breadcrumb", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    expect(await nomeDaCoordenada(1, 2)).toBe("Minha localização");
    expect(monitoring.addBreadcrumb).toHaveBeenCalledWith("reverse_geocode_offline", { provider: "bigdatacloud" });
    expect(monitoring.captureException).not.toHaveBeenCalled();
  });

  it("outro erro é capturado com a tag request-failed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("500")));
    expect(await nomeDaCoordenada(1, 2)).toBe("Minha localização");
    expect(monitoring.captureException).toHaveBeenCalledWith(
      expect.any(Error),
      { fn: "nomeDaCoordenada" },
      { tags: { provider: "bigdatacloud", reason: "request-failed" } }
    );
  });
});
