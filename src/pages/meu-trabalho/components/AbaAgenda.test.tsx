import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { PrazoEvento } from "@/components/calendario/eventos";
import type { TarefaInput, TarefaItem } from "../hooks";
import type { NovaTarefaNoDiaDados } from "./NovaTarefaNoDia";
import { AbaAgenda } from "./AbaAgenda";

/**
 * Aba Agenda do "Meu trabalho": junta disciplinas e tarefas com prazo como
 * eventos, abre a tarefa ou o projeto ao clicar, cria tarefa no dia (atalho e
 * formulário completo) e respeita o mobile e a falta do módulo Projetos.
 * As visões de calendário são dubladas: elas têm testes próprios.
 */

const h = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return {
    resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
    rpc: vi.fn(),
    calls: [] as ChainQuery[],
    toast,
    mobile: false,
    dados: { titulo: "Rápida", responsavelId: "pe1", projetoId: null } as NovaTarefaNoDiaDados,
    salvarCom: { titulo: "Editada", status: "fazendo" } as TarefaInput,
  };
});

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: h.rpc } };
});
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { id: "u1", empresa_id: "e1" } }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => h.mobile }));

const DIA = new Date(2026, 10, 20);

function ListaEventos({
  eventos,
  onEventoClick,
  renderNovoNoDia,
  nome,
}: {
  eventos: PrazoEvento[];
  onEventoClick: (e: PrazoEvento) => void;
  renderNovoNoDia?: (dia: Date, fechar: () => void) => ReactNode;
  nome: string;
}) {
  return (
    <section aria-label={nome}>
      {eventos.map((e) => (
        <button key={`${e.camada}:${e.id}`} onClick={() => onEventoClick(e)}>
          {e.camada}: {e.titulo}
        </button>
      ))}
      {renderNovoNoDia?.(DIA, () => {})}
    </section>
  );
}

vi.mock("@/components/calendario/MesView", () => ({
  MesView: (p: {
    eventosPorDia: Map<string, PrazoEvento[]>;
    onEventoClick: (e: PrazoEvento) => void;
    renderNovoNoDia?: (dia: Date, fechar: () => void) => ReactNode;
  }) => <ListaEventos nome="Mês" eventos={[...p.eventosPorDia.values()].flat()} {...p} />,
}));
vi.mock("@/components/calendario/SemanaView", () => ({
  SemanaView: (p: { eventosPorDia: Map<string, PrazoEvento[]>; onEventoClick: (e: PrazoEvento) => void }) => (
    <ListaEventos nome="Semana" eventos={[...p.eventosPorDia.values()].flat()} {...p} />
  ),
}));
vi.mock("@/components/calendario/AgendaView", () => ({
  AgendaView: (p: {
    eventos: PrazoEvento[];
    onEventoClick: (e: PrazoEvento) => void;
    renderNovoNoDia?: (dia: Date, fechar: () => void) => ReactNode;
  }) => <ListaEventos nome="Agenda" {...p} />,
}));
vi.mock("@/components/calendario/CalendarioSidebar", () => ({
  CalendarioSidebar: (p: { camadas: string[]; onToggleCamada: (id: string, v: boolean) => void }) => (
    <aside aria-label="Camadas">
      {p.camadas.map((c) => (
        <button key={c} onClick={() => p.onToggleCamada(c, false)}>
          Esconder {c}
        </button>
      ))}
    </aside>
  ),
}));
vi.mock("./NovaTarefaNoDia", () => ({
  NovaTarefaNoDia: (p: {
    onCriar: (d: NovaTarefaNoDiaDados) => Promise<boolean>;
    onMaisCampos: (titulo: string) => void;
  }) => (
    <div>
      <button onClick={() => void p.onCriar(h.dados)}>Criar no dia</button>
      <button onClick={() => p.onMaisCampos("Rascunho")}>Mais campos</button>
    </div>
  ),
}));
vi.mock("./TarefaDialog", () => ({
  TarefaDialog: (p: {
    open: boolean;
    tarefa: TarefaItem | null;
    defaultPrazo?: string;
    defaultTitulo?: string;
    readOnly: boolean;
    onSave: (i: TarefaInput) => Promise<string | null>;
    onOpenChange: (o: boolean) => void;
  }) =>
    p.open ? (
      <div role="dialog" aria-label="Tarefa">
        {p.tarefa ? `editando ${p.tarefa.titulo}` : `nova ${p.defaultTitulo} em ${p.defaultPrazo}`}
        {p.readOnly && " (leitura)"}
        <button onClick={() => void p.onSave(h.salvarCom)}>Salvar</button>
        <button onClick={() => p.onOpenChange(false)}>Fechar</button>
      </div>
    ) : null,
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const hojeIso = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
})();

const TAREFA = {
  id: "t1",
  numero: 1,
  titulo: "Entregar memorial",
  status: "a_fazer",
  prioridade: "media",
  prazo: hojeIso,
  labels: [],
  links: [],
  comentarios: [],
  projeto: { id: "p1", nome: "Casa" },
  responsaveis: [],
  obra: null,
  servico: null,
};
const DISCIPLINA = {
  id: "d1",
  titulo: "Estrutural",
  status_bucket: "fazendo",
  status_raw: "Pausado",
  prioridade: "alta",
  prazo: hojeIso,
  projeto_id: "p1",
  projeto_nome: "Casa",
  responsavel_id: null,
  responsavel_nome: null,
  labels: [],
  links: [],
};

function padrao(q: ChainQuery): ChainResult {
  if (q.table === "tarefas" && q.op === "select") return { data: [TAREFA] };
  if (q.table === "tarefas" && q.op === "insert") return { data: { id: "novo" } };
  if (q.table === "tarefa_etapas")
    return { data: [{ id: "e-fazer", nome: "A fazer", ordem: 0, cor: null, bucket: "a_fazer" }] };
  if (q.table === "pessoas") return { data: [{ id: "pe1", nome: "Ana", profile_id: "u1", profiles: null }] };
  return { data: [] };
}

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname + l.search}</div>;
}

function renderAgenda(props: Partial<Parameters<typeof AbaAgenda>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/tarefas"]}>
        <Routes>
          <Route
            path="/tarefas"
            element={<AbaAgenda pessoaIds={null} minhaPessoaId="pe1" canEdit temProjetos {...props} />}
          />
          <Route path="*" element={<Local />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return userEvent.setup();
}

const inserts = () => h.calls.filter((c) => c.table === "tarefas" && c.op === "insert");

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.mobile = false;
  h.dados = { titulo: "Rápida", responsavelId: "pe1", projetoId: null };
  h.salvarCom = { titulo: "Editada", status: "fazendo" };
  h.resolve.mockImplementation(padrao);
  h.rpc.mockResolvedValue({ data: [DISCIPLINA], error: null });
});

describe("AbaAgenda", () => {
  it("mostra tarefas e disciplinas como eventos no mês", async () => {
    renderAgenda();
    const mes = screen.getByRole("region", { name: "Mês" });
    expect(await within(mes).findByRole("button", { name: "tarefa: Entregar memorial" })).toBeInTheDocument();
    expect(await within(mes).findByRole("button", { name: "disciplina: Estrutural" })).toBeInTheDocument();
  });

  it("esconder uma camada tira os eventos dela", async () => {
    const user = renderAgenda();
    await screen.findByRole("button", { name: "disciplina: Estrutural" });
    await user.click(screen.getByRole("button", { name: "Esconder disciplina" }));
    expect(screen.queryByRole("button", { name: "disciplina: Estrutural" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "tarefa: Entregar memorial" })).toBeInTheDocument();
  });

  it("sem módulo Projetos não busca disciplinas nem oferece a camada", async () => {
    renderAgenda({ temProjetos: false });
    await screen.findByRole("button", { name: "tarefa: Entregar memorial" });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Esconder disciplina" })).not.toBeInTheDocument();
  });

  it("disciplina abre o projeto; tarefa abre a edição e salva", async () => {
    const user = renderAgenda();
    await user.click(await screen.findByRole("button", { name: "tarefa: Entregar memorial" }));
    expect(screen.getByRole("dialog", { name: "Tarefa" })).toHaveTextContent("editando Entregar memorial");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Tarefa atualizada."));
    expect(screen.queryByRole("dialog", { name: "Tarefa" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "disciplina: Estrutural" }));
    expect(screen.getByTestId("local")).toHaveTextContent("/projetos/p1?disciplina=d1");
  });

  it("erro ao salvar a edição avisa e mantém o diálogo", async () => {
    h.resolve.mockImplementation((q) => (q.op === "update" ? { error: { message: "rls" } } : padrao(q)));
    const user = renderAgenda();
    await user.click(await screen.findByRole("button", { name: "tarefa: Entregar memorial" }));
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Não deu para salvar a tarefa. Tente de novo."));
    expect(screen.getByRole("dialog", { name: "Tarefa" })).toBeInTheDocument();
  });

  it("criar no dia grava com prazo do dia, primeira coluna e responsável", async () => {
    const user = renderAgenda();
    await screen.findByRole("button", { name: "tarefa: Entregar memorial" });
    await user.click(screen.getByRole("button", { name: "Criar no dia" }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Tarefa criada para 20/11."));
    expect(inserts()[0].payload).toMatchObject({
      titulo: "Rápida",
      prazo: "2026-11-20",
      etapa_id: "e-fazer",
      responsavel_id: "pe1",
    });
  });

  it("falha ao criar no dia avisa", async () => {
    h.resolve.mockImplementation((q) => (q.op === "insert" ? { error: { message: "x" } } : padrao(q)));
    const user = renderAgenda();
    await screen.findByRole("button", { name: "tarefa: Entregar memorial" });
    await user.click(screen.getByRole("button", { name: "Criar no dia" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Não deu para criar a tarefa. Tente de novo."));
  });

  it("'mais campos' abre o formulário completo com título e prazo, e cria", async () => {
    const user = renderAgenda();
    await screen.findByRole("button", { name: "tarefa: Entregar memorial" });
    await user.click(screen.getByRole("button", { name: "Mais campos" }));
    expect(screen.getByRole("dialog", { name: "Tarefa" })).toHaveTextContent("nova Rascunho em 2026-11-20");
    h.salvarCom = { titulo: "Completa", status: "a_fazer", prazo: "2026-11-20" };
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Tarefa criada."));
    expect(inserts()[0].payload).toMatchObject({ titulo: "Completa" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tarefa" })).not.toBeInTheDocument());
  });

  it("sem permissão de edição não oferece criar no dia e abre em leitura", async () => {
    const user = renderAgenda({ canEdit: false });
    await user.click(await screen.findByRole("button", { name: "tarefa: Entregar memorial" }));
    expect(screen.queryByRole("button", { name: "Criar no dia" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Tarefa" })).toHaveTextContent("(leitura)");
    await user.click(screen.getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog", { name: "Tarefa" })).not.toBeInTheDocument();
  });

  it("troca entre semana e agenda e navega no período", async () => {
    const user = renderAgenda();
    const periodo = () => screen.getByRole("button", { name: "Anterior" }).nextElementSibling!.textContent;
    const antes = periodo();
    await user.click(screen.getByRole("button", { name: "Próximo" }));
    expect(periodo()).not.toBe(antes);
    await user.click(screen.getByRole("button", { name: "Hoje" }));
    expect(periodo()).toBe(antes);
    await user.click(screen.getByRole("button", { name: /Semana/ }));
    expect(screen.getByRole("region", { name: "Semana" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anterior" }));
    await user.click(screen.getByRole("button", { name: /Agenda/ }));
    expect(screen.getByRole("region", { name: "Agenda" })).toBeInTheDocument();
  });

  it("no mobile só existe a visão agenda", () => {
    h.mobile = true;
    renderAgenda();
    expect(screen.getByRole("region", { name: "Agenda" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Modo do calendário" })).not.toBeInTheDocument();
  });
});
