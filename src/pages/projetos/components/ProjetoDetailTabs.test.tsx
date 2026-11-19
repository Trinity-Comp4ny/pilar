import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import type { DisciplinaResponsavel, Projeto, ProjetoDisciplinaDB } from "@/types/projetos";

// Abas do detalhe do projeto: deep link por hash e por ?disciplina=, troca de visão
// (tabela/Gantt/fluxo) lembrada no navegador, fluxo aplicável ou não, e o caminho de cada
// edição feita no detalhe da disciplina até o handler de gravação.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    profile: { id: "u-1", empresa_id: "emp-1", first_name: "Ana", last_name: "Lima", email: "ana@x" },
  }),
}));
const fluxos = vi.hoisted(() => ({ lista: [] as unknown[] }));
vi.mock("@/hooks/useFluxosDisciplinas", () => ({ useFluxosDisciplinas: () => ({ data: fluxos.lista }) }));
const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));

const stub = vi.hoisted(
  () => (nome: string) =>
    function Stub() {
      return <div data-testid={nome}>{nome}</div>;
    }
);
vi.mock("./ProjetoVisaoGeralTab", () => ({
  ProjetoVisaoGeralTab: ({ indicadores, proximasAcoes }: { indicadores: ReactNode; proximasAcoes?: ReactNode }) => (
    <div data-testid="aba-visao-geral">
      aba-visao-geral{indicadores}
      {proximasAcoes}
    </div>
  ),
}));
const acesso = vi.hoisted(() => ({ isAdmin: true, role: "admin" }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ ...acesso, can: () => acesso.isAdmin }),
}));
vi.mock("@/components/tarefas/TarefaDialog", () => ({
  TarefaDialog: (p: {
    tarefa?: { titulo: string };
    defaultTitulo?: string;
    defaultDisciplinaId?: string;
    defaultDescricao?: string;
    readOnly: boolean;
    projetoFixoId: string;
    onSave: (input: unknown) => void;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div role="dialog">
      <span>{p.tarefa?.titulo ?? p.defaultTitulo ?? "Nova tarefa do projeto"}</span>
      <span>{p.defaultDisciplinaId}</span>
      <span>{p.defaultDescricao}</span>
      <button
        disabled={p.readOnly}
        onClick={() =>
          p.onSave({
            titulo: "Ajustar prancha",
            status: "a_fazer",
            projeto_id: p.projetoFixoId,
            projeto_disciplina_id: p.defaultDisciplinaId,
          })
        }
      >
        Salvar tarefa
      </button>
      <button onClick={() => p.onOpenChange(false)}>Cancelar tarefa</button>
    </div>
  ),
}));
vi.mock("./PagamentosTab", () => ({ PagamentosTab: stub("aba-pagamentos") }));
vi.mock("./EscopoTab", () => ({ EscopoTab: stub("aba-escopo") }));
vi.mock("./ProjetoHistoricoTab", () => ({ ProjetoHistoricoTab: stub("aba-historico") }));
vi.mock("./ProjetoAtividadesPanel", () => ({ ProjetoAtividadesPanel: stub("aba-atividades") }));
vi.mock("./AplicarFluxoDialog", () => ({
  AplicarFluxoDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">aplicar-fluxo</div> : null),
}));
vi.mock("./DisciplinasTableView", () => ({
  DisciplinasTableView: ({ onAplicarFluxo }: { onAplicarFluxo?: () => void }) => (
    <div data-testid="tabela-disciplinas">
      {onAplicarFluxo && <button onClick={onAplicarFluxo}>aplicar-pela-tabela</button>}
    </div>
  ),
}));
vi.mock("./FluxoPipeline", () => ({
  FluxoPipeline: ({
    disciplinas,
    onOpenDisciplina,
  }: {
    disciplinas: DisciplinaResponsavel[];
    onOpenDisciplina: (d: DisciplinaResponsavel) => void;
  }) => (
    <div data-testid="fluxo">
      <button onClick={() => onOpenDisciplina(disciplinas[0])}>abrir-pelo-fluxo</button>
    </div>
  ),
}));
type DialogProps = Record<string, unknown> & { open: boolean; disciplina: DisciplinaResponsavel | null };
vi.mock("./DisciplinaDetailDialog", () => ({
  DisciplinaDetailDialog: (p: DialogProps) => {
    if (!p.open) return null;
    const chamar =
      (nome: string, ...args: unknown[]) =>
      () =>
        (p[nome] as (...a: unknown[]) => unknown)(...args);
    return (
      <div role="dialog" aria-label="disciplina">
        <span>disciplina:{p.disciplina?.disciplina}</span>
        <span>autor:{String(p.autorNome)}</span>
        <span>destaque:{String(p.comentarioDestacado)}</span>
        <span>obs:{String(p.disciplina?.observacoes ?? "")}</span>
        <button onClick={chamar("onUpdateField", "data_previsao", "2026-09-30")}>campo</button>
        <button onClick={chamar("onUpdateField", "labels", "x")}>campo-direto</button>
        <button onClick={chamar("onUpdateResponsaveis", ["pes-2", "pes-x"])}>responsaveis</button>
        <button onClick={chamar("onUpdateLabels", ["urgente"])}>labels</button>
        <button onClick={chamar("onUpdateLinks", [{ url: "u" }])}>links</button>
        <button onClick={chamar("onUpdateComentarios", [{ id: "c" }])}>comentarios</button>
        <button onClick={chamar("onUpdateDescricao", "texto")}>descricao</button>
        <button onClick={chamar("onUpdateHorasEstimadas", 12)}>horas-est</button>
        <button onClick={chamar("onUpdateHorasRealizadas", 3)}>horas-real</button>
        <button onClick={chamar("onNewObservationChange", "  nova obs  ")}>digitar-obs</button>
        <button onClick={chamar("onAddObservation")}>add-obs</button>
        {typeof p.onDelete === "function" && <button onClick={chamar("onDelete")}>excluir</button>}
        <button onClick={chamar("onOpenChange", false)}>fechar</button>
      </div>
    );
  },
}));

Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
Element.prototype.scrollIntoView ??= () => {};
Element.prototype.scrollTo ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { PageSlotsContext } from "@/components/pageSlotsContext";
import { ProjetoDetailTabs } from "./ProjetoDetailTabs";

const projeto = {
  id: "proj-1",
  nome: "Residência",
  data_inicio: "2026-03-01",
  data_previsao: "2026-12-31",
  status: "Em Andamento",
} as unknown as Projeto;

const dbDisciplinas = [
  {
    id: "d-1",
    nome: "Estrutural",
    status: "Em Andamento",
    data_inicio: "2026-03-10",
    data_fim: "2026-06-30",
    data_fim_real: null,
    observacoes: "inicial",
    responsaveis: [{ id: "pes-1", nome: "Ana" }],
    ordem_etapa: null,
  },
  {
    id: "d-2",
    nome: "Elétrica",
    status: "Concluído",
    data_inicio: "2026-04-01",
    data_fim: "2026-05-15",
    data_fim_real: "2026-05-10",
    observacoes: null,
    responsaveis: [],
    ordem_etapa: null,
  },
] as unknown as ProjetoDisciplinaDB[];

const legacy = [
  {
    id: "d-1",
    disciplina: "Estrutural",
    status: "Em Andamento",
    data_inicio: "2026-03-10",
    data_previsao: "2026-06-30",
    responsavel_id: "pes-1",
    responsavel_nome: "Ana",
    responsaveis: [{ responsavel_id: "pes-1", responsavel_nome: "Ana" }],
    observacoes: "inicial",
  },
  {
    id: "d-2",
    disciplina: "Elétrica",
    status: "Concluído",
    data_inicio: "2026-04-01",
    data_previsao: "2026-05-15",
    data_final: "2026-05-10",
    responsavel_id: "",
    responsavel_nome: "",
    responsaveis: [],
  },
  { id: "d-3", disciplina: "Hidráulica", status: "Não Iniciado", responsaveis: [] },
] as unknown as DisciplinaResponsavel[];

const salvar = vi.fn();
const remover = vi.fn();
const rota = { atual: "" };
function Local() {
  const l = useLocation();
  const atual = `${l.pathname}${l.search}${l.hash}`;
  useEffect(() => {
    rota.atual = atual;
  }, [atual]);
  return null;
}

function montar(url = "/projetos/proj-1#disciplinas", props: Partial<Parameters<typeof ProjetoDetailTabs>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tabsEl = document.createElement("div");
  document.body.appendChild(tabsEl);
  render(
    <ProjetoDetailTabs
      projeto={projeto}
      progresso={0}
      canEdit
      disciplinasLegacy={legacy}
      dbDisciplinas={dbDisciplinas}
      disciplinasCatalog={[{ id: "cat", nome: "Estrutural" }]}
      pessoas={[
        { id: "pes-1", nome: "Ana" },
        { id: "pes-2", nome: "Bruno" },
      ]}
      getDbDisc={(i) => dbDisciplinas[i]}
      applyDiscStatusChange={vi.fn()}
      handleRemoveDisc={remover}
      handleAddDisc={vi.fn()}
      handleSaveDiscChanges={salvar}
      handleAddResponsavel={vi.fn()}
      handleRemoveResponsavel={vi.fn()}
      {...props}
    />,
    {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>
          <PageSlotsContext.Provider value={{ tabsEl, toolbarEl: null }}>
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
          </PageSlotsContext.Provider>
        </QueryClientProvider>
      ),
    }
  );
}

describe("ProjetoDetailTabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
    localStorage.clear();
    fluxos.lista = [];
    mobile.value = false;
    acesso.isAdmin = true;
    acesso.role = "admin";
    salvar.mockResolvedValue(undefined);
    remover.mockResolvedValue(undefined);
  });

  const pendente = {
    id: "t-1",
    titulo: "Conferir fundações",
    status: "a_fazer",
    prazo: "2020-01-01",
    projeto_disciplina_id: "d-1",
    horas_reais: 2,
    retrabalho: true,
    etapa_id: "et-1",
    responsaveis: [{ pessoa: { id: "pes-1", nome: "Ana" } }],
  };
  const concluida = { id: "t-2", titulo: "Emitir memorial", status: "concluida", horas_reais: 6, responsaveis: [] };
  const revisao = {
    id: "r-0",
    titulo: "Prancha",
    tipo: "aprovacao",
    status: "revisao_solicitada",
    numero_revisao: 0,
    projeto_disciplina_id: "d-1",
    resposta_cliente: "Conferir a cota",
    drive_url: "https://drive.google.com/file/d/r0",
    created_at: "2026-01-01",
    projeto_disciplinas: { nome: "Estrutural" },
  };

  function dadosDoProjeto({ falha = false, falhaGrava = false, versaoSeguinte = false, semRevisoes = false } = {}) {
    fake.responder(({ tabela, op, filtros }) => {
      if (tabela === "tarefas" && op === "insert") return { data: { id: "t-nova" }, error: null };
      if (tabela === "tarefas" && op === "update")
        return { data: null, error: falhaGrava ? { message: "falhou" } : null };
      if (tabela === "tarefas" && op === "select")
        return { data: falha ? null : [pendente, concluida], error: falha ? { message: "falhou" } : null };
      if (tabela === "pessoas") return { data: [{ id: "pes-1", nome: "Ana" }], error: null };
      if (tabela === "tarefa_etapas")
        return { data: [{ id: "et-1", nome: "A fazer", ordem: 0, bucket: "a_fazer" }], error: null };
      if (tabela === "portal_entregas" && op === "select") {
        if (filtros.some(([tipo]) => tipo === "not"))
          return { data: [{ id: "r-pendente", status: "pendente", revisao_anterior_id: null }], error: null };
        if (semRevisoes) return { data: [], error: null };
        return {
          data: [
            revisao,
            { ...revisao, id: "antiga", numero_revisao: null, titulo: "Solicitação antiga" },
            ...(versaoSeguinte
              ? [{ ...revisao, id: "r-1", numero_revisao: 1, revisao_anterior_id: "r-0", status: "pendente" }]
              : []),
          ],
          error: null,
        };
      }
      return undefined;
    });
  }

  it.each([
    [/Tarefas concluídas · 1\/2/, "#tarefas"],
    [/Tarefas em atraso · 1/, "#tarefas"],
    [/Retrabalho nas tarefas · 25,0%/, "#tarefas"],
    [/Revisões internas/, "#revisoes"],
    [/Aguardando cliente · 1/, "#revisoes"],
    [/Horas das disciplinas · 2h \/ 8h/, "#disciplinas"],
    [/Ver cronograma/, "#cronograma"],
  ])("leva do indicador %s à seção correspondente", async (indicador, hash) => {
    dadosDoProjeto();
    montar("/projetos/proj-1", {
      dbDisciplinas: dbDisciplinas.map((d) => ({ ...d, horas_realizadas: 1, horas_estimadas: 4 })),
    });
    fireEvent.click(await screen.findByRole("button", { name: indicador }));
    await waitFor(() => expect(rota.atual).toContain(hash));
    if (indicador.source.includes("atraso")) {
      expect(await screen.findByText("Conferir fundações")).toBeInTheDocument();
      expect(screen.queryByText("Emitir memorial")).not.toBeInTheDocument();
    }
  });

  it("agrupa tarefas por disciplina, permite filtros e reabre a mesma tarefa para editar", async () => {
    dadosDoProjeto();
    montar("/projetos/proj-1#tarefas");
    expect(await screen.findByText("Conferir fundações")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Estrutural/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Sem disciplina/ })).toBeInTheDocument();
    const escolher = (rotulo: string, opcao: string) => {
      fireEvent.keyDown(screen.getByRole("combobox", { name: rotulo }), { key: "Enter" });
      fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
    };
    escolher("Filtrar por responsável", "Ana");
    expect(screen.queryByText("Emitir memorial")).not.toBeInTheDocument();
    escolher("Filtrar por status", "Concluído · sem coluna");
    expect(screen.getByText(/Nenhuma tarefa corresponde/)).toBeInTheDocument();
    escolher("Filtrar por status", "A fazer");
    fireEvent.click(screen.getByRole("button", { name: /Conferir fundações/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fake.escritas("tarefas")[0]).toMatchObject({ op: "update", filtros: [["eq", "id", "t-1"]] });
    fireEvent.click(screen.getByRole("button", { name: "Nova tarefa" }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Nova tarefa do projeto");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar tarefa" }));
    escolher("Filtrar por responsável", "Todos os responsáveis");
    escolher("Filtrar por status", "Todos os status");
    fireEvent.click(screen.getAllByRole("button", { name: "Adicionar tarefa" })[0]);
    expect(screen.getByRole("dialog")).toHaveTextContent("d-1");
  });

  it("mantém a edição aberta quando a alteração falha", async () => {
    dadosDoProjeto({ falhaGrava: true });
    montar("/projetos/proj-1#tarefas");
    fireEvent.click(await screen.findByRole("button", { name: /Conferir fundações/ }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar tarefa" }));
    await waitFor(() => expect(fake.escritas("tarefas")).toHaveLength(1));
    expect(screen.getByRole("dialog")).toHaveTextContent("Conferir fundações");
  });

  it("abre tarefas de outro responsável sem permitir edição e oculta a publicação de revisões", async () => {
    acesso.isAdmin = false;
    acesso.role = "viewer";
    dadosDoProjeto();
    montar("/projetos/proj-1#tarefas");
    fireEvent.click(await screen.findByRole("button", { name: /Conferir fundações/ }));
    expect(screen.getByRole("button", { name: "Salvar tarefa" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar tarefa" }));
    fireEvent.click(screen.getByRole("button", { name: "Em atraso" }));
    expect(screen.queryByText("Emitir memorial")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Em atraso" }));
    expect(screen.getByText("Emitir memorial")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Revisões" }));
    expect(await screen.findByText("R00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publicar/ })).not.toBeInTheDocument();
  });

  it("publica a primeira revisão com arquivo e mantém a lista vazia antes do envio", async () => {
    dadosDoProjeto({ semRevisoes: true });
    montar("/projetos/proj-1#revisoes");
    expect(await screen.findByText("Nenhuma revisão publicada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publicar revisão" }));
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Prancha de fundações" } });
    const enviar = screen.getByRole("button", { name: "Enviar ao cliente" });
    expect(enviar).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Link do Google Drive"), {
      target: { value: "https://drive.google.com/file/d/r0" },
    });
    fireEvent.click(enviar);
    await waitFor(() =>
      expect(fake.escritas("portal_entregas")[0]?.payload).toMatchObject({
        numero_revisao: 0,
        revisao_anterior_id: null,
        tipo: "aprovacao",
      })
    );
  });

  it("permite recarregar tarefas depois de uma falha na consulta", async () => {
    dadosDoProjeto({ falha: true });
    montar("/projetos/proj-1#tarefas");
    expect(screen.getByRole("status")).toHaveTextContent("Carregando tarefas");
    const retry = await screen.findByRole("button", { name: /Tentar novamente/ });
    dadosDoProjeto();
    fireEvent.click(retry);
    expect(await screen.findByText("Conferir fundações")).toBeInTheDocument();
  });

  it("transforma o pedido de revisão numa tarefa vinculada", async () => {
    dadosDoProjeto();
    montar("/projetos/proj-1#revisoes");
    expect(await screen.findByText("R00")).toBeInTheDocument();
    expect(screen.queryByText("Solicitação antiga")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa de ajuste" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Conferir a cota");
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar tarefa" }));
    await waitFor(() =>
      expect(fake.escritas("tarefas")[0]?.payload).toMatchObject({
        projeto_id: "proj-1",
        projeto_disciplina_id: "d-1",
        portal_entrega_id: "r-0",
      })
    );
  });

  it("publica nova versão a partir da solicitada pelo cliente", async () => {
    dadosDoProjeto();
    montar("/projetos/proj-1#revisoes");
    fireEvent.click(await screen.findByRole("button", { name: "Publicar nova versão" }));
    expect(screen.getByLabelText("Título")).toHaveValue("Prancha");
    fireEvent.change(screen.getByLabelText("Link do Google Drive"), {
      target: { value: "https://drive.google.com/file/d/r1" },
    });
    dadosDoProjeto({ versaoSeguinte: true });
    fireEvent.click(screen.getByRole("button", { name: "Enviar ao cliente" }));
    expect(await screen.findByText("R01")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Publicar nova versão" })).not.toBeInTheDocument();
    expect(fake.escritas("portal_entregas")[0]?.payload).toMatchObject({
      revisao_anterior_id: "r-0",
      tipo: "aprovacao",
    });
    fireEvent.click(screen.getByRole("button", { name: /Revisões internas abertas/ }));
    await waitFor(() => expect(rota.atual).toContain("#disciplinas"));
  });

  it("abre em Disciplinas/tabela e troca de aba atualiza o hash", async () => {
    montar();
    expect(screen.getByTestId("tabela-disciplinas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Pagamentos" }));
    expect(await screen.findByTestId("aba-pagamentos")).toBeInTheDocument();
    expect(rota.atual).toContain("#pagamentos");
  });

  it.each([
    ["#escopo", "aba-escopo"],
    ["#historico", "aba-historico"],
    ["#atividades", "aba-atividades"],
    ["#pagamentos", "aba-pagamentos"],
  ])("hash %s abre a aba certa", (hash, testid) => {
    montar(`/projetos/proj-1${hash}`);
    expect(screen.getByTestId(testid)).toBeInTheDocument();
  });

  it("hash #cronograma (alias antigo) abre o Gantt e mostra as disciplinas sem data", async () => {
    montar("/projetos/proj-1#cronograma");
    expect(await screen.findByText("Cronograma do Projeto")).toBeInTheDocument();
    expect(screen.getAllByText("Estrutural").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/sem datas definidas/i));
    expect(screen.getAllByText("Hidráulica").length).toBeGreaterThan(0);
    expect(screen.getByText("Início do projeto")).toBeInTheDocument();
    expect(screen.getByText("Previsão do projeto")).toBeInTheDocument();
  });

  const barra = (nome: string) =>
    [...document.querySelectorAll("span.text-white")].find((e) => e.textContent === nome) as HTMLElement;

  it("clicar na barra do Gantt abre a disciplina", async () => {
    montar("/projetos/proj-1#cronograma", { canEdit: false });
    await screen.findByText("Cronograma do Projeto");
    fireEvent.click(barra("Estrutural"));
    expect(await screen.findByText("disciplina:Estrutural")).toBeInTheDocument();
  });

  it("arrastar a barra no Gantt grava as novas datas pela disciplina", async () => {
    const largura = vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(3000);
    montar("/projetos/proj-1#cronograma");
    await screen.findByText("Cronograma do Projeto");
    const corpo = barra("Estrutural").parentElement as HTMLElement;
    fireEvent.mouseDown(corpo, { clientX: 100 });
    fireEvent.mouseMove(document, { clientX: 400 });
    fireEvent.mouseUp(document, { clientX: 400 });
    await waitFor(() => expect(salvar).toHaveBeenCalled());
    const gravado = salvar.mock.calls[0][0];
    expect(gravado.id).toBe("d-1");
    expect(gravado.data_inicio > "2026-03-10").toBe(true);
    expect(gravado.data_fim > "2026-06-30").toBe(true);
    largura.mockRestore();
  });

  it("trocar o zoom para semanas e voltar para hoje não quebra", async () => {
    montar("/projetos/proj-1#cronograma");
    await screen.findByText("Cronograma do Projeto");
    fireEvent.click(screen.getByRole("button", { name: /Semanas/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hoje/ }));
    expect(screen.getByText("Cronograma do Projeto")).toBeInTheDocument();
  });

  it("a visão escolhida fica guardada no navegador", () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Gantt" }));
    expect(localStorage.getItem("pilar-disc-view")).toBe("gantt");
    expect(screen.getByText("Cronograma do Projeto")).toBeInTheDocument();
  });

  it("visão Fluxo sem fluxo e sem modelos orienta onde criar", () => {
    localStorage.setItem("pilar-disc-view", "fluxo");
    montar();
    expect(screen.getByText("Este projeto ainda não segue um fluxo")).toBeInTheDocument();
    expect(screen.getByText(/Monte um fluxo em Projetos/)).toBeInTheDocument();
  });

  it("visão Fluxo sem edição explica quem pode aplicar", () => {
    localStorage.setItem("pilar-disc-view", "fluxo");
    montar(undefined, { canEdit: false });
    expect(screen.getByText(/Quem edita o projeto pode aplicar/)).toBeInTheDocument();
  });

  it("com modelos de fluxo, oferece aplicar (pelo vazio e pela tabela)", async () => {
    fluxos.lista = [{ id: "fx-1" }];
    localStorage.setItem("pilar-disc-view", "fluxo");
    montar();
    fireEvent.click(screen.getByRole("button", { name: "Aplicar fluxo" }));
    expect(await screen.findByText("aplicar-fluxo")).toBeInTheDocument();
  });

  it("projeto que já segue fluxo mostra o pipeline e abre a disciplina por ele", async () => {
    fluxos.lista = [{ id: "fx-1" }];
    localStorage.setItem("pilar-disc-view", "fluxo");
    montar(undefined, { dbDisciplinas: [{ ...dbDisciplinas[0], ordem_etapa: 1 }, dbDisciplinas[1]] });
    fireEvent.click(screen.getByRole("button", { name: "abrir-pelo-fluxo" }));
    expect(await screen.findByText("disciplina:Estrutural")).toBeInTheDocument();
    expect(screen.getByText("autor:Ana Lima")).toBeInTheDocument();
  });

  it("link de notificação abre a disciplina com o comentário em destaque e limpa a URL ao fechar", async () => {
    montar("/projetos/proj-1?disciplina=d-2&comentario=c-9");
    expect(await screen.findByText("disciplina:Elétrica")).toBeInTheDocument();
    expect(screen.getByText("destaque:c-9")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "fechar" }));
    await waitFor(() => expect(rota.atual).not.toContain("disciplina="));
    expect(rota.atual).not.toContain("comentario=");
  });

  it("link para disciplina inexistente não abre nada", () => {
    montar("/projetos/proj-1?disciplina=nao-existe");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  describe("edições no detalhe da disciplina", () => {
    async function abrir() {
      montar("/projetos/proj-1?disciplina=d-1");
      await screen.findByText("disciplina:Estrutural");
    }
    const clicar = async (nome: string) => {
      fireEvent.click(screen.getByRole("button", { name: nome }));
      await waitFor(() => expect(salvar).toHaveBeenCalled());
      return salvar.mock.calls.at(-1)![0];
    };

    it("campo legado vira a coluna do banco", async () => {
      await abrir();
      expect(await clicar("campo")).toMatchObject({ id: "d-1", data_fim: "2026-09-30" });
    });

    it("campo sem mapeamento vai com o mesmo nome", async () => {
      await abrir();
      expect(await clicar("campo-direto")).toMatchObject({ labels: "x" });
    });

    it("responsáveis são resolvidos pelo nome das pessoas", async () => {
      await abrir();
      expect((await clicar("responsaveis")).responsaveis).toEqual([
        { id: "pes-2", nome: "Bruno" },
        { id: "pes-x", nome: "" },
      ]);
    });

    it.each([
      ["labels", { labels: ["urgente"] }],
      ["links", { links: [{ url: "u" }] }],
      ["comentarios", { comentarios: [{ id: "c" }] }],
      ["descricao", { descricao: "texto" }],
      ["horas-est", { horas_estimadas: 12 }],
      ["horas-real", { horas_realizadas: 3 }],
    ])("%s grava como patch da disciplina", async (botao, esperado) => {
      await abrir();
      expect(await clicar(botao)).toMatchObject({ id: "d-1", ...esperado });
    });

    it("observação nova é acrescentada às anteriores; vazia não grava", async () => {
      await abrir();
      fireEvent.click(screen.getByRole("button", { name: "add-obs" }));
      expect(salvar).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "digitar-obs" }));
      expect(await clicar("add-obs")).toMatchObject({ observacoes: "inicial\nnova obs" });
    });

    it("excluir fecha o diálogo e remove pelo índice", async () => {
      await abrir();
      fireEvent.click(screen.getByRole("button", { name: "excluir" }));
      await waitFor(() => expect(remover).toHaveBeenCalledWith(0));
    });

    it("sem edição não oferece excluir", async () => {
      montar("/projetos/proj-1?disciplina=d-1", { canEdit: false });
      await screen.findByText("disciplina:Estrutural");
      expect(screen.queryByRole("button", { name: "excluir" })).not.toBeInTheDocument();
    });

    it("disciplina sem linha no banco não grava", async () => {
      montar("/projetos/proj-1?disciplina=d-1", { getDbDisc: () => undefined });
      await screen.findByText("disciplina:Estrutural");
      for (const b of ["campo", "responsaveis", "labels"]) fireEvent.click(screen.getByRole("button", { name: b }));
      await new Promise((r) => setTimeout(r, 10));
      expect(salvar).not.toHaveBeenCalled();
    });
  });
});
