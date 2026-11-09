import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { Componente, Incidente } from "./hooks";

// Incidentes da status page (spec 055): estado dos componentes derivado dos incidentes
// abertos, declarar exige título e ao menos um componente, atualizar exige mudança de etapa
// ou mensagem, e resolver grava resolved_at.

const h = vi.hoisted(() => ({
  componentes: [] as Componente[],
  incidentes: [] as Incidente[],
  carregando: false,
  resolve: (() => ({ data: null })) as (q: ChainQuery) => ChainResult,
  calls: [] as ChainQuery[],
}));
vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from } };
});
vi.mock("./hooks", async (orig) => ({
  ...(await orig<typeof import("./hooks")>()),
  useComponentes: () => ({ data: h.componentes, isLoading: h.carregando }),
  useIncidentes: () => ({ data: h.incidentes, isLoading: h.carregando }),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({
    title,
    primaryAction,
    actions,
    children,
  }: {
    title: string;
    primaryAction?: { label: string; onClick: () => void };
    actions?: React.ReactNode;
    children: React.ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {primaryAction && <button onClick={primaryAction.onClick}>{primaryAction.label}</button>}
      {children}
    </main>
  ),
}));

// Radix Select usa APIs de ponteiro que o jsdom não implementa.
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import Incidentes from "./Incidentes";

const HORA = 3_600_000;

function incidente(over: Partial<Incidente>): Incidente {
  return {
    id: "i1",
    titulo: "Financeiro lento",
    severidade: "degradado",
    status: "investigando",
    createdAt: new Date(Date.now() - 2 * HORA).toISOString(),
    resolvedAt: null,
    componentIds: ["c1"],
    updates: [],
    ...over,
  };
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <Incidentes />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  h.carregando = false;
  h.componentes = [
    { id: "c1", slug: "app", nome: "Aplicativo" },
    { id: "c2", slug: "api", nome: "API" },
  ];
  h.incidentes = [];
  h.calls.length = 0;
  h.resolve = (q) => (q.single ? { data: { id: "novo-1" } } : { data: null });
});

describe("Incidentes: leitura", () => {
  it("sem incidente: tudo operando e nenhum aberto", () => {
    montar();
    expect(screen.getByText("Tudo operando normalmente")).toBeInTheDocument();
    expect(screen.getByText("Nenhum incidente aberto.")).toBeInTheDocument();
    expect(screen.queryByText(/Resolvidos/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver status page/ })).toHaveAttribute("href", "/status");
  });

  it("carregando não mostra o resumo nem o vazio", () => {
    h.carregando = true;
    montar();
    expect(screen.queryByText("Tudo operando normalmente")).not.toBeInTheDocument();
    expect(screen.queryByText("Nenhum incidente aberto.")).not.toBeInTheDocument();
  });

  it("incidente aberto conta componentes afetados e mostra a timeline", () => {
    h.incidentes = [
      incidente({ updates: [{ id: "u1", mensagem: "Investigando a lentidão", createdAt: "2026-11-07T10:00:00Z" }] }),
      incidente({
        id: "i2",
        titulo: "Sem componente",
        componentIds: [],
        severidade: "outage",
        createdAt: new Date(Date.now() - 30 * 60_000).toISOString(),
      }),
    ];
    montar();
    expect(screen.getByText("1 de 2 componentes com problema")).toBeInTheDocument();
    expect(screen.getByText("Investigando a lentidão")).toBeInTheDocument();
    expect(screen.getByText(/Lento ou instável · Aplicativo · começou .*, há 2 h/)).toBeInTheDocument();
    expect(screen.getByText(/Fora do ar · Sem componente · .*, há 30 min/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Postar atualização" })).toHaveLength(2);
  });

  it("resolvidos ficam recolhidos e mostram a duração, sem botão de atualizar", async () => {
    const user = userEvent.setup();
    h.incidentes = [
      incidente({
        id: "r1",
        titulo: "Queda antiga",
        status: "resolvido",
        createdAt: "2026-10-01T00:00:00Z",
        resolvedAt: "2026-10-04T00:00:00Z",
      }),
    ];
    montar();
    expect(screen.getByText("Tudo operando normalmente")).toBeInTheDocument();
    expect(screen.queryByText("Queda antiga")).not.toBeInTheDocument();
    await user.click(screen.getByText(/Resolvidos/));
    expect(screen.getByText("Queda antiga")).toBeInTheDocument();
    expect(screen.getByText(/durou 3 dias/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Postar atualização" })).not.toBeInTheDocument();
  });
});

describe("Incidentes: declarar", () => {
  it("exige título e componente; publica incidente, componentes e primeira atualização", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Declarar incidente" }));
    const dialogo = await screen.findByRole("dialog");
    const publicar = within(dialogo).getByRole("button", { name: "Publicar" });
    await user.type(within(dialogo).getByLabelText("O que está acontecendo"), "  API fora  ");
    expect(publicar).toBeDisabled();
    await user.click(within(dialogo).getByRole("checkbox", { name: "API" }));
    await user.click(within(dialogo).getByRole("checkbox", { name: "Aplicativo" }));
    await user.click(within(dialogo).getByRole("checkbox", { name: "Aplicativo" }));
    await user.click(within(dialogo).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: "Fora do ar" }));
    expect(within(dialogo).getByText("O recurso não funciona pra ninguém.")).toBeInTheDocument();
    await user.type(within(dialogo).getByLabelText(/Primeira atualização/), "Investigando");
    await user.click(publicar);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Incidente publicado na status page"));
    const inserts = h.calls.filter((c) => c.op === "insert");
    expect(inserts.map((c) => c.table)).toEqual([
      "status_incidents",
      "status_incident_components",
      "status_incident_updates",
    ]);
    expect(inserts[0].payload).toEqual({ titulo: "API fora", severidade: "outage" });
    expect(inserts[1].payload).toEqual([{ incident_id: "novo-1", component_id: "c2" }]);
    expect(inserts[2].payload).toEqual({ incident_id: "novo-1", mensagem: "Investigando" });
  });

  it("sem mensagem não grava atualização", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Declarar incidente" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("O que está acontecendo"), "Lento");
    await user.click(within(dialogo).getByRole("checkbox", { name: "API" }));
    await user.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
    expect(h.calls.some((c) => c.table === "status_incident_updates")).toBe(false);
    expect(h.calls[0].payload).toEqual({ titulo: "Lento", severidade: "parcial" });
  });

  it("falha ao ligar os componentes avisa o erro", async () => {
    h.resolve = (q) =>
      q.single
        ? { data: { id: "novo-1" } }
        : q.table === "status_incident_components"
          ? { error: new Error("fk") }
          : { data: null };
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Declarar incidente" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("O que está acontecendo"), "Lento");
    await user.click(within(dialogo).getByRole("checkbox", { name: "API" }));
    await user.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível criar o incidente", expect.anything())
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("falha ao criar o incidente não tenta ligar componentes", async () => {
    h.resolve = (q) => (q.single ? { data: null, error: new Error("rls") } : { data: null });
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Declarar incidente" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("O que está acontecendo"), "Lento");
    await user.click(within(dialogo).getByRole("checkbox", { name: "API" }));
    await user.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(h.calls.some((c) => c.table === "status_incident_components")).toBe(false);
  });
});

describe("Incidentes: atualizar", () => {
  beforeEach(() => {
    h.incidentes = [incidente({})];
  });

  it("sem mudança de etapa nem mensagem não publica; só mensagem grava update e mantém status", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Postar atualização" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText("Atualizar: Financeiro lento")).toBeInTheDocument();
    const publicar = within(dialogo).getByRole("button", { name: "Publicar" });
    expect(publicar).toBeDisabled();
    await user.type(within(dialogo).getByLabelText("Mensagem"), "Achamos a causa");
    await user.click(publicar);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Atualização publicada"));
    expect(h.calls.map((c) => `${c.table}:${c.op}`)).toEqual(["status_incident_updates:insert"]);
  });

  it("resolver sem mensagem só muda o status e grava resolved_at", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Postar atualização" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Resolvido/ }));
    expect(within(dialogo).getByText(/voltam a operacional/)).toBeInTheDocument();
    await user.click(within(dialogo).getByRole("button", { name: "Resolver" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Incidente resolvido"));
    const upd = h.calls.find((c) => c.op === "update")!;
    expect(upd.table).toBe("status_incidents");
    expect(upd.payload).toMatchObject({ status: "resolvido", resolved_at: expect.any(String) });
    expect(upd.filters).toContainEqual(["eq", "id", "i1"]);
    expect(h.calls.some((c) => c.table === "status_incident_updates")).toBe(false);
  });

  it("voltar para uma etapa aberta limpa resolved_at", async () => {
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Postar atualização" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("combobox"));
    await user.click(await screen.findByRole("option", { name: /Monitorando/ }));
    await user.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Atualização publicada"));
    expect(h.calls.find((c) => c.op === "update")!.payload).toEqual({ status: "monitorando", resolved_at: null });
  });

  it("erro ao publicar avisa", async () => {
    h.resolve = () => ({ error: new Error("rls") });
    const user = userEvent.setup();
    montar();
    await user.click(screen.getByRole("button", { name: "Postar atualização" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Mensagem"), "x");
    await user.click(within(dialogo).getByRole("button", { name: "Publicar" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível atualizar", expect.anything()));
  });
});
