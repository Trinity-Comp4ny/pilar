import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import type { TarefaInput, TarefaItem } from "./hooks";
import { TarefasWorkspace, type MolduraTarefasProps } from "./TarefasWorkspace";
import MeuTrabalho from "./index";

/**
 * Workspace de Tarefas com os hooks reais e o Supabase dublado: lista, quadro e
 * agenda; busca e filtros; quem pode mexer em qual tarefa; criar, salvar,
 * excluir; colunas (etapas); link de notificação; e o modo obra.
 * O formulário (TarefaDialog) e a agenda têm testes próprios e entram dublados.
 */

const h = vi.hoisted(() => {
  const toast = Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() });
  return {
    resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
    rpc: vi.fn(),
    calls: [] as ChainQuery[],
    toast,
    perm: { isAdmin: false, role: "user" as string },
    temProjetos: true,
    minhaPessoa: { id: "pe-me", nome: "Ana" } as { id: string; nome: string } | null,
    salvarCom: { titulo: "Nova", status: "a_fazer" } as TarefaInput,
  };
});

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: h.rpc } };
});
vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: { id: "u-me", empresa_id: "e1" }, user: { id: "u-me" } }),
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => h.perm }));
vi.mock("@/hooks/useFeatureAccess", () => ({ useFeatureAccess: () => ({ canView: h.temProjetos }) }));
vi.mock("@/hooks/useMinhaPessoa", () => ({ useMinhaPessoa: () => ({ data: h.minhaPessoa }) }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("./components/TarefaDialog", () => ({
  TarefaDialog: (p: {
    open: boolean;
    tarefa: TarefaItem | null;
    readOnly: boolean;
    defaultEtapaId: string | null;
    onSave: (i: TarefaInput) => Promise<string | null>;
    onOpenChange: (o: boolean) => void;
  }) =>
    p.open ? (
      <div role="dialog" aria-label="Tarefa">
        <span>{p.tarefa ? `editando ${p.tarefa.titulo}` : `nova em ${p.defaultEtapaId ?? "padrão"}`}</span>
        {p.readOnly && <span>somente leitura</span>}
        <button onClick={() => void p.onSave(h.salvarCom)}>Salvar tarefa</button>
        <button onClick={() => p.onOpenChange(false)}>Fechar tarefa</button>
      </div>
    ) : null,
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

const ETAPAS = [
  { id: "e-fazer", nome: "A fazer", ordem: 0, cor: null, bucket: "a_fazer" },
  { id: "x1", nome: "Revisão", ordem: 1, cor: "#3b82f6", bucket: null },
  { id: "e-fazendo", nome: "Fazendo", ordem: 2, cor: null, bucket: "fazendo" },
  { id: "e-ok", nome: "Concluído", ordem: 3, cor: null, bucket: "concluida" },
];

const tarefa = (p: Record<string, unknown>) => ({
  numero: 1,
  descricao: null,
  status: "a_fazer",
  prioridade: "media",
  created_by: "u-outro",
  responsavel_id: null,
  projeto_id: null,
  etapa_id: null,
  obra_id: null,
  obra_frente_id: null,
  prazo: null,
  horas_estimadas: null,
  horas_reais: null,
  labels: [],
  links: [],
  comentarios: [],
  projeto: null,
  responsaveis: [],
  obra: null,
  servico: null,
  ...p,
});

const MINHA = tarefa({
  id: "t1",
  numero: 42,
  titulo: "Revisar prancha",
  created_by: "u-me",
  responsaveis: [{ pessoa: { id: "pe-me", nome: "Ana" } }],
  labels: ["urgente"],
});
const DE_OUTRO = tarefa({
  id: "t2",
  numero: 43,
  titulo: "Medir terreno",
  etapa_id: "x1",
  prazo: "2020-01-01",
  responsaveis: [{ pessoa: { id: "pe2", nome: "Bruno" } }],
});
const DA_OBRA = tarefa({
  id: "t3",
  numero: 44,
  titulo: "Concretar laje",
  obra_id: "o1",
  obra: { id: "o1", nome: "Obra Aurora" },
});

const DISCIPLINA = {
  id: "d1",
  titulo: "Estrutural",
  status_bucket: "fazendo",
  status_raw: "Em Andamento",
  prioridade: "alta",
  prazo: null,
  projeto_id: "p1",
  projeto_nome: "Casa Ipê",
  responsavel_id: null,
  responsavel_nome: null,
  labels: [],
  links: [],
};

let tarefas: unknown[] = [];
function padrao(q: ChainQuery): ChainResult {
  if (q.table === "tarefa_etapas" && q.op === "select") return { data: ETAPAS };
  if (q.table === "tarefas" && q.op === "select") return { data: q.single ? null : tarefas };
  if (q.table === "tarefas" && q.op === "insert") return { data: { id: "novo" } };
  if (q.table === "pessoas") {
    return {
      data: [
        { id: "pe-me", nome: "Ana", profile_id: "u-me", profiles: null },
        { id: "pe2", nome: "Bruno", profile_id: null, profiles: null },
      ],
    };
  }
  if (q.table === "projetos") return { data: [{ id: "p1", nome: "Casa Ipê" }] };
  return {};
}

function Moldura({ toolbar, search, primaryAction, children }: MolduraTarefasProps) {
  return (
    <div>
      <div data-testid="toolbar">{toolbar}</div>
      {search && <input aria-label="Buscar" value={search.value} onChange={(e) => search.onChange(e.target.value)} />}
      {primaryAction && <button onClick={primaryAction.onClick}>{primaryAction.label}</button>}
      {children}
    </div>
  );
}

function Local() {
  const l = useLocation();
  return <div data-testid="local">{l.pathname + l.search}</div>;
}

function renderWorkspace(opts: { path?: string; obra?: Parameters<typeof TarefasWorkspace>[0]["obra"] } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[opts.path ?? "/tarefas"]}>
        <Routes>
          <Route path="/tarefas" element={<TarefasWorkspace moldura={Moldura} obra={opts.obra} />} />
          <Route path="*" element={<Local />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return userEvent.setup();
}

const toolbar = () => within(screen.getByTestId("toolbar"));
const linha = (titulo: string) => screen.getByRole("group", { name: titulo });
const writes = (op: ChainQuery["op"], table = "tarefas") => h.calls.filter((c) => c.table === table && c.op === op);

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  localStorage.clear();
  h.perm = { isAdmin: false, role: "user" };
  h.temProjetos = true;
  h.minhaPessoa = { id: "pe-me", nome: "Ana" };
  h.salvarCom = { titulo: "Nova", status: "a_fazer" };
  tarefas = [MINHA, DE_OUTRO];
  h.resolve.mockImplementation(padrao);
  h.rpc.mockResolvedValue({ data: [DISCIPLINA], error: null });
});

describe("TarefasWorkspace: lista", () => {
  it("agrupa tarefas e disciplinas nas colunas", async () => {
    renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    expect(screen.queryByText("#42")).not.toBeInTheDocument();
    expect(linha("Medir terreno")).toBeInTheDocument();
    expect(linha("Estrutural")).toHaveTextContent("Disciplina");
    expect(screen.getByRole("button", { name: /Revisão\s*1/ })).toBeInTheDocument();
  });

  it("busca por título, número e etiqueta", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    const busca = screen.getByRole("textbox", { name: "Buscar" });
    await user.type(busca, "#43");
    expect(screen.queryByRole("group", { name: "Revisar prancha" })).not.toBeInTheDocument();
    expect(linha("Medir terreno")).toBeInTheDocument();
    await user.clear(busca);
    await user.type(busca, "URGENTE");
    expect(linha("Revisar prancha")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Medir terreno" })).not.toBeInTheDocument();
  });

  it("filtro de prazo e de tipo, com limpar", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(toolbar().getByRole("button", { name: "Prazo" }));
    await user.click(
      within(await screen.findByRole("listbox", { name: "Prazo" })).getByRole("option", { name: "Atrasadas" })
    );
    expect(linha("Medir terreno")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Revisar prancha" })).not.toBeInTheDocument();

    await user.click(toolbar().getByRole("button", { name: /^Limpar\s*\(1\)$/ }));
    expect(await screen.findByRole("group", { name: "Revisar prancha" })).toBeInTheDocument();

    await user.click(toolbar().getByRole("button", { name: "Tipo" }));
    await user.click(
      within(await screen.findByRole("listbox", { name: "Tipo" })).getByRole("option", { name: "Tarefas" })
    );
    await waitFor(() => expect(screen.queryByRole("group", { name: "Estrutural" })).not.toBeInTheDocument());
  });

  it("sem módulo Projetos não busca disciplinas nem mostra o filtro de tipo", async () => {
    h.temProjetos = false;
    renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    expect(h.rpc).not.toHaveBeenCalled();
    expect(toolbar().queryByRole("button", { name: "Tipo" })).not.toBeInTheDocument();
  });

  it("carregando e erro", async () => {
    h.resolve.mockImplementation((q) => (q.table === "tarefas" ? { error: { message: "rls" } } : padrao(q)));
    renderWorkspace();
    expect(await screen.findByText("Não deu para carregar. Recarregue a página.")).toBeInTheDocument();
  });
});

describe("TarefasWorkspace: permissão de edição", () => {
  it("dono muda a prioridade com update otimista", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(within(linha("Revisar prancha")).getByTitle("Mudar prioridade"));
    await user.click(await screen.findByRole("menuitem", { name: "Alta" }));
    await waitFor(() => expect(writes("update")[0]?.payload).toEqual({ prioridade: "alta" }));
    expect(writes("update")[0].filters).toContainEqual(["eq", "id", "t1"]);
  });

  it("tarefa de outra pessoa não muda e avisa; abre em modo leitura", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Medir terreno" });
    await user.click(within(linha("Medir terreno")).getByTitle("Mudar prioridade"));
    await user.click(await screen.findByRole("menuitem", { name: "Alta" }));
    expect(h.toast).toHaveBeenCalledWith("Só quem é responsável pode alterar esta tarefa.");
    expect(writes("update")).toHaveLength(0);

    await user.click(within(linha("Medir terreno")).getByText("Medir terreno"));
    const dialog = screen.getByRole("dialog", { name: "Tarefa" });
    expect(dialog).toHaveTextContent("editando Medir terreno");
    expect(dialog).toHaveTextContent("somente leitura");
  });

  it("coordenador pode mexer em qualquer tarefa", async () => {
    h.perm = { isAdmin: false, role: "coordenador" };
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Medir terreno" });
    await user.click(within(linha("Medir terreno")).getByTitle("Mudar prioridade"));
    await user.click(await screen.findByRole("menuitem", { name: "Baixa" }));
    await waitFor(() => expect(writes("update")).toHaveLength(1));
  });

  it("falha ao salvar a prioridade avisa", async () => {
    h.resolve.mockImplementation((q) => (q.op === "update" ? { error: { message: "rls" } } : padrao(q)));
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(within(linha("Revisar prancha")).getByTitle("Mudar prioridade"));
    await user.click(await screen.findByRole("menuitem", { name: "Baixa" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Não deu para mudar a prioridade."));
  });

  it("disciplina abre o projeto na disciplina", async () => {
    const user = renderWorkspace();
    await user.click(within(await screen.findByRole("group", { name: "Estrutural" })).getByText("Estrutural"));
    expect(screen.getByTestId("local")).toHaveTextContent("/projetos/p1?disciplina=d1");
  });
});

describe("TarefasWorkspace: criar, salvar e excluir", () => {
  it("nova tarefa nasce na âncora 'A fazer' e atribuída a quem cria", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    // O botão primário da moldura vem antes do "Nova tarefa" dos grupos vazios.
    await user.click(screen.getAllByRole("button", { name: "Nova tarefa" })[0]);
    expect(screen.getByRole("dialog", { name: "Tarefa" })).toHaveTextContent("nova em padrão");
    await user.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Tarefa criada."));
    expect(writes("insert")[0].payload).toMatchObject({ etapa_id: "e-fazer", responsavel_id: "pe-me", obra_id: null });
    expect(screen.queryByRole("dialog", { name: "Tarefa" })).not.toBeInTheDocument();
  });

  it("'+' do grupo cria já naquela coluna", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(screen.getByRole("button", { name: "Nova tarefa em Revisão" }));
    expect(screen.getByRole("dialog", { name: "Tarefa" })).toHaveTextContent("nova em x1");
  });

  it("editar a própria tarefa atualiza; erro mantém o diálogo aberto", async () => {
    const user = renderWorkspace();
    await user.click(
      within(await screen.findByRole("group", { name: "Revisar prancha" })).getByText("Revisar prancha")
    );
    await user.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Tarefa atualizada."));
    expect(writes("update")[0].filters).toContainEqual(["eq", "id", "t1"]);

    h.resolve.mockImplementation((q) => (q.op === "update" ? { error: { message: "x" } } : padrao(q)));
    await user.click(within(linha("Revisar prancha")).getByText("Revisar prancha"));
    await user.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Não deu para salvar a tarefa. Tente de novo."));
    expect(screen.getByRole("dialog", { name: "Tarefa" })).toBeInTheDocument();
  });

  it("excluir pelo menu da linha confirma e apaga", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(within(linha("Revisar prancha")).getByRole("button", { name: "Ações da tarefa" }));
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.toast.success).toHaveBeenCalledWith("Tarefa excluída."));
    expect(writes("delete")[0].filters).toContainEqual(["eq", "id", "t1"]);
  });

  it("excluir tarefa de outra pessoa é bloqueado; falha no delete avisa", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Medir terreno" });
    await user.click(within(linha("Medir terreno")).getByRole("button", { name: "Ações da tarefa" }));
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    h.resolve.mockImplementation((q) => (q.op === "delete" ? { error: { message: "fk" } } : padrao(q)));
    await user.click(within(linha("Revisar prancha")).getByRole("button", { name: "Ações da tarefa" }));
    await user.click(await screen.findByRole("menuitem", { name: "Excluir" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Não deu para excluir."));
  });
});

describe("TarefasWorkspace: colunas", () => {
  it("cria lista inline com a próxima ordem", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "tarefa_etapas" && q.op === "insert"
        ? { data: { id: "n", nome: "Bloqueado", ordem: 4, cor: "#94a3b8", bucket: null } }
        : padrao(q)
    );
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(screen.getByRole("button", { name: /Nova lista/ }));
    await user.type(screen.getByPlaceholderText(/Nome da lista/), "  Bloqueado {Enter}");
    await waitFor(() => expect(writes("insert", "tarefa_etapas")).toHaveLength(1));
    expect(writes("insert", "tarefa_etapas")[0].payload).toMatchObject({ nome: "Bloqueado", ordem: 4 });
  });

  it("falha ao criar lista avisa", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "tarefa_etapas" && q.op === "insert" ? { error: { message: "dup" } } : padrao(q)
    );
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(screen.getByRole("button", { name: /Nova lista/ }));
    await user.type(screen.getByPlaceholderText(/Nome da lista/), "X");
    await user.click(screen.getByRole("button", { name: "Adicionar" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalledWith("Não deu para criar a coluna."));
  });

  it("mover lista para baixo troca a ordem com a vizinha", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(screen.getAllByRole("button", { name: "Ações da lista" })[0]);
    await user.click(await screen.findByRole("menuitem", { name: "Mover para baixo" }));
    await waitFor(() => expect(writes("update", "tarefa_etapas")).toHaveLength(2));
    expect(writes("update", "tarefa_etapas").map((c) => c.payload)).toEqual([{ ordem: 1 }, { ordem: 0 }]);
  });

  it("excluir lista extra confirma; âncora de status não tem excluir", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(screen.getAllByRole("button", { name: "Ações da lista" })[0]);
    expect(screen.queryByRole("menuitem", { name: "Excluir lista" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(screen.getAllByRole("button", { name: "Ações da lista" })[1]);
    await user.click(await screen.findByRole("menuitem", { name: "Excluir lista" }));
    await user.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir coluna" }));
    await waitFor(() =>
      expect(h.toast.success).toHaveBeenCalledWith('Coluna excluída. As tarefas foram para "A fazer".')
    );
    expect(writes("delete", "tarefa_etapas")[0].filters).toContainEqual(["eq", "id", "x1"]);
  });

  it("editar lista abre o diálogo da coluna e salva", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(screen.getAllByRole("button", { name: "Ações da lista" })[1]);
    await user.click(await screen.findByRole("menuitem", { name: "Editar" }));
    const dialog = await screen.findByRole("dialog");
    const nome = within(dialog).getByDisplayValue("Revisão");
    await user.clear(nome);
    await user.type(nome, "Em revisão");
    await user.click(within(dialog).getByRole("button", { name: /Salvar/ }));
    await waitFor(() => expect(writes("update", "tarefa_etapas")[0]?.payload).toMatchObject({ nome: "Em revisão" }));
  });
});

describe("TarefasWorkspace: visões, links e obra", () => {
  it("quadro mostra os cards e a visão fica lembrada", async () => {
    const user = renderWorkspace();
    await screen.findByRole("group", { name: "Revisar prancha" });
    await user.click(toolbar().getByRole("button", { name: /Quadro/ }));
    expect(await screen.findByText("Medir terreno")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Medir terreno" })).not.toBeInTheDocument();
    expect(localStorage.getItem("pilar.meu-trabalho.visao")).toBe("quadro");
  });

  it("filtro de pessoa pela URL consulta só as tarefas dela", async () => {
    h.resolve.mockImplementation((q) =>
      q.table === "tarefa_responsaveis" ? { data: [{ tarefa_id: "t2" }] } : padrao(q)
    );
    renderWorkspace({ path: "/tarefas?pessoas=eu,pe2" });
    await waitFor(() => expect(h.calls.some((c) => c.table === "tarefa_responsaveis")).toBe(true));
    const ponte = h.calls.find((c) => c.table === "tarefa_responsaveis")!;
    expect(ponte.filters).toContainEqual(["in", "pessoa_id", ["pe-me", "pe2"]]);
  });

  it("link de notificação para tarefa inacessível avisa e limpa a URL", async () => {
    renderWorkspace({ path: "/tarefas?tarefa=t9&comentario=c1" });
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("Você não tem acesso a esta tarefa.", expect.any(Object))
    );
  });

  it("link de notificação abre a tarefa e fechar limpa o parâmetro", async () => {
    h.resolve.mockImplementation((q) => (q.table === "tarefas" && q.single ? { data: DE_OUTRO } : padrao(q)));
    const user = renderWorkspace({ path: "/tarefas?tarefa=t2" });
    expect(await screen.findByRole("dialog", { name: "Tarefa" })).toHaveTextContent("editando Medir terreno");
    await user.click(screen.getByRole("button", { name: "Fechar tarefa" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Tarefa" })).not.toBeInTheDocument());
  });

  it("modo obra: vazio oferece criar ou montar o cronograma", async () => {
    const aoMontarCronograma = vi.fn();
    const user = renderWorkspace({ obra: { id: "o1", servicos: [], aoMontarCronograma } });
    expect(await screen.findByText("Esta obra ainda não tem tarefas")).toBeInTheDocument();
    expect(h.rpc).not.toHaveBeenCalled();
    expect(toolbar().queryByRole("button", { name: /Agenda/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Montar no cronograma" }));
    expect(aoMontarCronograma).toHaveBeenCalledOnce();
  });

  it("modo obra: só as tarefas da obra, e a nova nasce nela", async () => {
    tarefas = [MINHA, DA_OBRA];
    const user = renderWorkspace({ obra: { id: "o1", servicos: [], aoMontarCronograma: vi.fn() } });
    expect(await screen.findByRole("group", { name: "Concretar laje" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Revisar prancha" })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Nova tarefa" })[0]);
    await user.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    await waitFor(() => expect(writes("insert")[0]?.payload).toMatchObject({ obra_id: "o1" }));
  });

  it("página /tarefas monta o workspace com o título", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <MeuTrabalho />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(screen.getByRole("heading", { name: "Tarefas" })).toBeInTheDocument();
    expect(await screen.findByText("Revisar prancha")).toBeInTheDocument();
  });
});
