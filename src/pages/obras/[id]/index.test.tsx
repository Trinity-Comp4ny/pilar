import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

// Página da obra: carregando, obra inexistente, abas por permissão/sub-feature, deep link
// por ?tab=, alerta de clima, edição e exclusão (com erro do servidor).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const perms = vi.hoisted(() => ({ negadas: new Set<string>() }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (f: string, a = "view") => !perms.negadas.has(`${f}:${a}`) && !perms.negadas.has(f),
  }),
}));
const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));
const titulo = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: titulo }));
const clima = vi.hoisted(() => ({ alertas: [] as unknown[] }));
vi.mock("@/pages/obras/hooks/useAlertasClima", () => ({ useAlertasClimaCronograma: () => clima.alertas }));

const stub = vi.hoisted(
  () => (nome: string) =>
    function Stub(props: Record<string, unknown>) {
      return (
        <div data-testid={nome}>
          {nome}
          {typeof props.onIrParaDiario === "function" && (
            <button onClick={props.onIrParaDiario as () => void}>ir-diario</button>
          )}
          {typeof props.aoMontarCronograma === "function" && (
            <button onClick={props.aoMontarCronograma as () => void}>montar-cronograma</button>
          )}
        </div>
      );
    }
);
vi.mock("../components/ObraAcessosTab", () => ({ ObraAcessosTab: stub("aba-acessos") }));
vi.mock("../components/ObraTimelineTab", () => ({ ObraTimelineTab: stub("aba-timeline") }));
vi.mock("../components/ObraDiarioTab", () => ({ ObraDiarioTab: stub("aba-diario") }));
vi.mock("../components/ObraCronogramaTab", () => ({ ObraCronogramaTab: stub("aba-cronograma") }));
vi.mock("../components/ObraTarefasTab", () => ({ ObraTarefasTab: stub("aba-tarefas") }));
vi.mock("../components/ObraContaTab", () => ({ ObraContaTab: stub("aba-conta") }));
vi.mock("../components/ObraCotacoesTab", () => ({ ObraCotacoesTab: stub("aba-cotacoes") }));
vi.mock("../components/ObraEstoqueTab", () => ({ ObraEstoqueTab: stub("aba-estoque") }));
vi.mock("../components/ObraFormDialog", () => ({
  ObraFormDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog">form-obra</div> : null),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import ObraDetalhePage from "./index";

const obra = {
  id: "obra-1",
  nome: "Residência Silva",
  status: "em_andamento",
  projeto_id: "proj-1",
  projeto: { id: "proj-1", nome: "Projeto Silva" },
  responsavel: { id: "p-1", nome: "Ana" },
  cidade: "Campinas",
  localizacao: null,
  data_inicio_prevista: "2026-10-01",
  data_fim_prevista: null,
  latitude: 1,
  longitude: 2,
};

function montar(url = "/obras/obra-1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/obras/:id" element={children} />
          <Route path="/obras" element={<div>lista-obras</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return render(<ObraDetalhePage />, { wrapper: Wrapper });
}

function comObra(o: Record<string, unknown> | null = obra) {
  fake.responder((c) => {
    if (c.tabela === "obras") return { data: o, error: null };
    return undefined;
  });
}

const abas = () =>
  within(screen.getByRole("tablist", { name: "Seções da obra" }))
    .getAllByRole("tab")
    .map((t) => t.textContent);

describe("ObraDetalhePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
    perms.negadas = new Set();
    mobile.value = false;
    clima.alertas = [];
  });

  it("obra inexistente mostra o aviso e volta para a lista", async () => {
    comObra(null);
    montar();
    expect(await screen.findByText("Obra não encontrada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar para Obras" }));
    expect(await screen.findByText("lista-obras")).toBeInTheDocument();
  });

  it("erro ao carregar a obra cai no mesmo aviso", async () => {
    fake.responder(() => ({ data: null, error: { message: "RLS" } }));
    montar();
    expect(await screen.findByText("Obra não encontrada")).toBeInTheDocument();
  });

  it("com todas as permissões mostra todas as abas e o cabeçalho", async () => {
    comObra();
    montar();
    expect(await screen.findByRole("heading", { name: "Residência Silva" })).toBeInTheDocument();
    expect(abas()).toEqual([
      "Visão",
      "Diário",
      "Cronograma",
      "Tarefas",
      "Cotações",
      "Estoque",
      "Conta da obra",
      "Acessos",
    ]);
    expect(screen.getByRole("link", { name: "Projeto Silva" })).toHaveAttribute("href", "/projetos/proj-1");
    expect(screen.getByText("Ana")).toBeInTheDocument();
    expect(screen.getByText("Campinas")).toBeInTheDocument();
    expect(screen.getByText(/—\s*\?/)).toBeInTheDocument();
    expect(screen.getByTestId("aba-timeline")).toBeInTheDocument();
    expect(titulo).toHaveBeenCalledWith("Residência Silva");
  });

  it("sub-features desligadas e sem financeiro escondem as abas; sem edição não há ações", async () => {
    perms.negadas = new Set([
      "obras_diario",
      "obras_cronograma",
      "obras_cotacoes",
      "obras_estoque",
      "financeiro",
      "obras:edit",
      "obras:delete",
    ]);
    comObra({ ...obra, projeto: null, responsavel: null, cidade: null, data_inicio_prevista: null });
    montar();
    await screen.findByRole("heading", { name: "Residência Silva" });
    expect(abas()).toEqual(["Visão", "Tarefas"]);
    expect(screen.getByText("Sem responsável")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("deep link ?tab=cotacoes abre direto na aba", async () => {
    comObra();
    montar("/obras/obra-1?tab=cotacoes");
    expect(await screen.findByTestId("aba-cotacoes")).toBeInTheDocument();
  });

  it("atalhos das abas trocam de seção", async () => {
    comObra();
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "ir-diario" }));
    expect(await screen.findByTestId("aba-diario")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "Tarefas" }));
    fireEvent.click(await screen.findByRole("button", { name: "montar-cronograma" }));
    expect(await screen.findByTestId("aba-cronograma")).toBeInTheDocument();
  });

  it("alerta de clima lista as etapas e leva ao cronograma", async () => {
    clima.alertas = [
      {
        tarefaId: "t-1",
        titulo: "Concretar laje",
        tipo: "concretagem",
        data: "2026-11-10",
        detalhe: "chuva (90%)",
        motivo: "chuva",
      },
      {
        tarefaId: "t-2",
        titulo: "Içar treliça",
        tipo: "icamento",
        data: "2026-11-11",
        detalhe: "vento 60 km/h",
        motivo: "vento",
      },
    ];
    comObra();
    montar();
    expect(await screen.findByText("Clima pode atrapalhar 2 etapas")).toBeInTheDocument();
    expect(screen.getByText("Concretar laje")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver cronograma" }));
    expect(await screen.findByTestId("aba-cronograma")).toBeInTheDocument();
  });

  it("um alerta só usa o singular", async () => {
    clima.alertas = [
      { tarefaId: "t-1", titulo: "Concretar", tipo: "concretagem", data: "2026-11-10", detalhe: "chuva" },
    ];
    comObra();
    montar();
    expect(await screen.findByText("Clima pode atrapalhar uma etapa")).toBeInTheDocument();
  });

  it("no celular os botões ficam só com ícone e mantêm o rótulo acessível", async () => {
    mobile.value = true;
    comObra();
    montar();
    const editar = await screen.findByRole("button", { name: "Editar" });
    expect(editar).not.toHaveTextContent("Editar");
    fireEvent.click(editar);
    expect(screen.getByRole("dialog")).toHaveTextContent("form-obra");
  });

  it("excluir confirma, remove e volta para a lista", async () => {
    comObra();
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Excluir obra?")).toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Obra removida"));
    expect(fake.rpc).toHaveBeenCalledWith("rpc_soft_delete", { p_tabela: "obras", p_id: "obra-1" });
    expect(await screen.findByText("lista-obras")).toBeInTheDocument();
  });

  it("erro ao excluir mantém na página e avisa", async () => {
    rpcComEmpresa({ rpc_soft_delete: { data: null, error: new Error("sem permissão") } });
    comObra();
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível remover", { description: "sem permissão" })
    );
    expect(screen.queryByText("lista-obras")).not.toBeInTheDocument();
  });
});
