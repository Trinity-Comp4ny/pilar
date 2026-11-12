import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  corpoDoEvento,
  criarEvento,
  editarEvento,
  excluirEvento,
  janela,
  lembreteDoEvento,
  listarEventos,
  paraLinha,
} from "./google-calendar.ts";

Deno.test("paraLinha converte reunião com Meet", () => {
  const l = paraLinha({
    id: "abc123",
    summary: "  Reunião com a VRZ ",
    start: { dateTime: "2026-11-20T14:00:00-03:00" },
    end: { dateTime: "2026-11-20T15:00:00-03:00" },
    hangoutLink: "https://meet.google.com/xyz-abcd-efg",
    htmlLink: "https://www.google.com/calendar/event?eid=1",
  });
  assertEquals(l, {
    google_evento_id: "abc123",
    titulo: "Reunião com a VRZ",
    inicio: "2026-11-20T17:00:00.000Z",
    fim: "2026-11-20T18:00:00.000Z",
    dia_inteiro: false,
    local: null,
    descricao: null,
    convidados: [],
    link_reuniao: "https://meet.google.com/xyz-abcd-efg",
    link_google: "https://www.google.com/calendar/event?eid=1",
    pode_editar: true,
    lembrete_minutos: null,
  });
});

Deno.test("paraLinha ignora cancelado, recusado e evento que não é reunião", () => {
  const base = { id: "x1", start: { dateTime: "2026-11-20T14:00:00Z" }, end: { dateTime: "2026-11-20T15:00:00Z" } };
  assertEquals(paraLinha({ ...base, status: "cancelled" }), null);
  assertEquals(paraLinha({ ...base, attendees: [{ self: true, responseStatus: "declined" }] }), null);
  assertEquals(paraLinha({ ...base, eventType: "outOfOffice" }), null);
  assertEquals(paraLinha({ ...base, eventType: "workingLocation" }), null);
  assertEquals(paraLinha({ id: "x2" }), null);
});

Deno.test("paraLinha marca dia inteiro e não aceita link que não é https", () => {
  const l = paraLinha({
    id: "d1",
    start: { date: "2026-11-21" },
    end: { date: "2026-11-22" },
    location: "javascript:alert(1)",
    hangoutLink: "http://meet.google.com/x",
  });
  assertEquals(l?.dia_inteiro, true);
  assertEquals(l?.titulo, "(sem título)");
  assertEquals(l?.inicio, "2026-11-21T12:00:00.000Z");
  assertEquals(l?.link_reuniao, null);
});

Deno.test("paraLinha usa o local como link quando é URL https", () => {
  const l = paraLinha({
    id: "z1",
    start: { dateTime: "2026-11-20T14:00:00Z" },
    end: { dateTime: "2026-11-20T15:00:00Z" },
    location: "https://zoom.us/j/123",
  });
  assertEquals(l?.link_reuniao, "https://zoom.us/j/123");
});

Deno.test("listarEventos pagina e manda o token", async () => {
  const chamadas: string[] = [];
  const f = (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    chamadas.push(url);
    assertEquals((init?.headers as Record<string, string>).Authorization, "Bearer tk");
    const pagina2 = url.includes("pageToken=p2");
    return Promise.resolve(
      new Response(JSON.stringify(pagina2 ? { items: [{ id: "b" }] } : { items: [{ id: "a" }], nextPageToken: "p2" }))
    );
  };
  const { de, ate } = janela(new Date("2026-11-12T12:00:00Z"));
  const eventos = await listarEventos("tk", de, ate, f);
  assertEquals(
    eventos.map((e) => e.id),
    ["a", "b"]
  );
  assertEquals(chamadas.length, 2);
  assertEquals(chamadas[0].includes("singleEvents=true"), true);
});

Deno.test("aviso da reunião segue o lembrete pop-up do Google", () => {
  assertEquals(lembreteDoEvento(undefined), null);
  assertEquals(lembreteDoEvento({ useDefault: true }), null);
  assertEquals(lembreteDoEvento({ useDefault: false, overrides: [] }), -1);
  assertEquals(
    lembreteDoEvento({
      useDefault: false,
      overrides: [
        { method: "email", minutes: 5 },
        { method: "popup", minutes: 30 },
        { method: "popup", minutes: 10 },
      ],
    }),
    10
  );
});

Deno.test("paraLinha traz convidados, descrição e se dá para editar", () => {
  const l = paraLinha({
    id: "c1",
    start: { dateTime: "2026-11-20T14:00:00Z" },
    end: { dateTime: "2026-11-20T15:00:00Z" },
    description: "Pauta",
    organizer: { self: false },
    attendees: [{ email: "eu@vrz.com", self: true }, { email: "cliente@x.com" }],
  });
  assertEquals(l?.convidados, ["cliente@x.com"]);
  assertEquals(l?.descricao, "Pauta");
  assertEquals(l?.pode_editar, false);
});

Deno.test("corpo do evento: Meet, convidados, aviso e fim exclusivo no dia inteiro", () => {
  const c = corpoDoEvento(
    {
      titulo: "Visita",
      inicio: "2026-11-21",
      fim: "2026-11-22",
      dia_inteiro: true,
      convidados: ["a@b.com"],
      lembrete_minutos: 10,
    },
    true
  ) as Record<string, unknown>;
  assertEquals(c.start, { date: "2026-11-21" });
  assertEquals(c.end, { date: "2026-11-23" });
  assertEquals(c.attendees, [{ email: "a@b.com" }]);
  assertEquals(c.reminders, { useDefault: false, overrides: [{ method: "popup", minutes: 10 }] });
  assertEquals(
    (c.conferenceData as { createRequest: { conferenceSolutionKey: unknown } }).createRequest.conferenceSolutionKey,
    { type: "hangoutsMeet" }
  );

  const sem = corpoDoEvento(
    {
      titulo: "x",
      inicio: "2026-11-20T14:00:00-03:00",
      fim: "2026-11-20T15:00:00-03:00",
      dia_inteiro: false,
      lembrete_minutos: -1,
    },
    false
  ) as Record<string, unknown>;
  assertEquals(sem.start, { dateTime: "2026-11-20T17:00:00.000Z" });
  assertEquals(sem.reminders, { useDefault: false, overrides: [] });
  assertEquals(sem.conferenceData, undefined);
  assertEquals(
    (
      corpoDoEvento(
        { titulo: "x", inicio: "2026-11-20T14:00:00Z", fim: "2026-11-20T15:00:00Z", dia_inteiro: false },
        false
      ) as Record<string, unknown>
    ).reminders,
    { useDefault: true }
  );
});

Deno.test("criar, editar e excluir chamam a API com convite aos convidados", async () => {
  const chamadas: { url: string; metodo?: string }[] = [];
  const f = (input: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(input), metodo: init?.method });
    if (init?.method === "DELETE") return Promise.resolve(new Response(null, { status: 410 }));
    return Promise.resolve(new Response(JSON.stringify({ id: "novo123" })));
  };
  const d = {
    titulo: "x",
    inicio: "2026-11-20T14:00:00Z",
    fim: "2026-11-20T15:00:00Z",
    dia_inteiro: false,
    meet: true,
  };
  assertEquals((await criarEvento("tk", d, f)).id, "novo123");
  await editarEvento("tk", "novo123", d, true, f);
  await excluirEvento("tk", "novo123", f); // 410: já apagado, não é erro
  assertEquals(
    chamadas.map((c) => c.metodo),
    ["POST", "PATCH", "DELETE"]
  );
  assertEquals(
    chamadas.every((c) => c.url.includes("sendUpdates=all")),
    true
  );
  assertEquals(chamadas[0].url.includes("conferenceDataVersion=1"), true);
});
