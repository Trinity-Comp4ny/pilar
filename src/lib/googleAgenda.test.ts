import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { buildEventosReunioes, linkDoEvento, rotuloAviso, rotuloHorario, type EventoAgenda } from "./googleAgenda";

const base: EventoAgenda = {
  id: "r1",
  calendario_id: "primary",
  titulo: "Reunião",
  inicio: "2026-11-20T13:00:00.000Z",
  fim: "2026-11-20T14:00:00.000Z",
  dia_inteiro: false,
  local: null,
  descricao: null,
  convidados: [],
  pode_editar: true,
  lembrete_minutos: null,
  link_reuniao: null,
  link_google: "https://www.google.com/calendar/event?eid=1",
};

describe("googleAgenda", () => {
  it("rótulo diz o horário e onde é", () => {
    expect(rotuloHorario({ ...base, link_reuniao: "https://meet.google.com/x" })).toMatch(/–.* · Meet$/);
    expect(rotuloHorario({ ...base, link_reuniao: "https://zoom.us/j/1" })).toMatch(/ · Online$/);
    expect(rotuloHorario({ ...base, local: "Sala 2" })).toMatch(/ · Sala 2$/);
    expect(rotuloHorario({ ...base, dia_inteiro: true })).toBe("Dia inteiro");
  });

  it("rótulo do aviso", () => {
    expect(rotuloAviso(10)).toBe("10 minutos antes");
    expect(rotuloAviso(0)).toBe("Na hora");
    expect(rotuloAviso(null)).toBe("Não avisar");
    expect(rotuloAviso(-1)).toBe("Não avisar");
    expect(rotuloAviso(45)).toBe("45 minutos antes");
  });

  it("o clique abre a sala; sem sala, o evento no Google", () => {
    expect(linkDoEvento({ link_reuniao: "https://meet.google.com/x", link_google: "g" })).toBe(
      "https://meet.google.com/x"
    );
    expect(linkDoEvento({ link_reuniao: null, link_google: "g" })).toBe("g");
  });

  it("reuniões viram eventos em ordem, e a que já passou fica concluída", () => {
    const agora = new Date("2026-11-20T15:00:00.000Z");
    const eventos = buildEventosReunioes(
      [
        { ...base, id: "depois", inicio: "2026-11-20T18:00:00.000Z", fim: "2026-11-20T19:00:00.000Z" },
        base,
        { ...base, id: "dia", dia_inteiro: true, inicio: "2026-11-21T12:00:00.000Z", fim: "2026-11-22T12:00:00.000Z" },
      ],
      agora
    );
    expect(eventos.map((e) => e.id)).toEqual(["r1", "depois", "dia"]);
    expect(eventos.map((e) => e.estado)).toEqual(["concluido", "compromisso", "compromisso"]);
    expect(eventos.every((e) => e.camada === "reuniao")).toBe(true);
    expect(eventos[2].data).toBe("2026-11-21");
  });
});
