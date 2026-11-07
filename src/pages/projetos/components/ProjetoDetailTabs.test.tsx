import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: { first_name: "Ana", last_name: "Lima", email: "ana@x" } }),
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

function montar(url = "/projetos/proj-1", props: Partial<Parameters<typeof ProjetoDetailTabs>[0]> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tabsEl = document.createElement("div");
  document.body.appendChild(tabsEl);
  render(
    <ProjetoDetailTabs
      projeto={projeto}
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
    salvar.mockResolvedValue(undefined);
    remover.mockResolvedValue(undefined);
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
