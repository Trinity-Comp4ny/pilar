import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";

// Diário da obra: escolha da visão inicial (Registros quando há gravações), lista densa
// com tarefas/efetivo/impedimentos/visitas/fotos/medições, feed, sem edição e exclusão.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const mobile = vi.hoisted(() => ({ value: false }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => mobile.value }));
vi.mock("./RdoFormDialog", () => ({
  RdoFormDialog: ({
    open,
    rdoInicial,
    rascunho,
  }: {
    open: boolean;
    rdoInicial: { id: string } | null;
    rascunho: { data: string } | null;
  }) =>
    open ? (
      <div role="dialog" aria-label="rdo-form">
        {rdoInicial ? `editar ${rdoInicial.id}` : "novo"}
        {rascunho && ` rascunho ${rascunho.data}`}
      </div>
    ) : null,
}));
vi.mock("./RegistroGravarDialog", () => ({
  RegistroGravarDialog: ({ open, onEnviado }: { open: boolean; onEnviado: () => void }) =>
    open ? (
      <div role="dialog" aria-label="gravar">
        <button onClick={onEnviado}>enviado</button>
      </div>
    ) : null,
}));
vi.mock("./ObraRegistrosTimeline", () => ({
  ObraRegistrosTimeline: ({ onFecharDia }: { onFecharDia: (d: string, r: unknown[]) => void }) => (
    <div>
      timeline-registros
      <button onClick={() => onFecharDia("2026-11-05", [])}>fechar-dia-com-rdo</button>
      <button onClick={() => onFecharDia("2026-11-06", [])}>fechar-dia-novo</button>
    </div>
  ),
}));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

import { ObraDiarioTab } from "./ObraDiarioTab";

function montar(canEdit = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<ObraDiarioTab obraId="obra-1" canEdit={canEdit} />, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  });
}

const rdos = [
  {
    id: "r-1",
    obra_id: "obra-1",
    data: "2026-11-05",
    clima: "sol",
    condicao_trabalho: "normal",
    efetivo: 8,
    atividades: "Concretagem da laje",
    ocorrencias: "Chuva à tarde",
    pendencias: null,
    created_by: "u-1",
  },
  {
    id: "r-2",
    obra_id: "obra-1",
    data: "2026-11-04",
    clima: null,
    condicao_trabalho: null,
    efetivo: null,
    atividades: null,
    ocorrencias: null,
    pendencias: null,
    created_by: null,
  },
];

function comDados(extra: Record<string, unknown> = {}) {
  const tabelas: Record<string, unknown> = {
    obra_rdo: rdos,
    obra_rdo_tarefa: [
      {
        id: "v-1",
        rdo_id: "r-1",
        tarefa_id: "t-1",
        resultado: "concluiu",
        observacao: "liberado",
        tarefa: { titulo: "Laje" },
      },
      { id: "v-2", rdo_id: "r-1", tarefa_id: "t-2", resultado: "parou", observacao: null, tarefa: null },
      {
        id: "v-3",
        rdo_id: "r-2",
        tarefa_id: "t-3",
        resultado: "avancou",
        observacao: null,
        tarefa: { titulo: "Alvenaria" },
      },
    ],
    obra_rdo_efetivo: [
      { id: "e-1", rdo_id: "r-1", fornecedor: { nome: "Equipe Forma" }, fornecedor_nome: null, quantidade: 4 },
      { id: "e-2", rdo_id: "r-1", fornecedor: null, fornecedor_nome: "Avulsos", quantidade: 2 },
      { id: "e-3", rdo_id: "r-1", fornecedor: null, fornecedor_nome: null, quantidade: 1 },
    ],
    obra_rdo_impedimento: [{ id: "i-1", rdo_id: "r-1", tipo: "clima", descricao: "Chuva forte" }],
    obra_rdo_visita: [
      { id: "vi-1", rdo_id: "r-1", fornecedor: { nome: "Gerdau" }, fornecedor_nome: null, observacao: "entrega" },
      { id: "vi-2", rdo_id: "r-1", fornecedor: null, fornecedor_nome: null, observacao: null },
    ],
    obra_rdo_medicao: [{ id: "m-1", rdo_id: "r-1", item: "Concreto", quantidade: 12, unidade: "m³" }],
    obra_rdo_foto: [{ id: "f-1", rdo_id: "r-1", path: "a.jpg" }],
    profiles: [{ id: "u-1", nome: "Ana", first_name: null }],
    obra_registro: [],
    ...extra,
  };
  fake.responder((c) =>
    c.op === "select" && c.tabela in tabelas ? { data: tabelas[c.tabela], error: null } : undefined
  );
  fake.supabase.storage.from.mockImplementation(
    () =>
      ({
        createSignedUrls: async () => ({ data: [{ path: "a.jpg", signedUrl: "https://foto/a" }] }),
        remove: vi.fn(),
        upload: fake.upload,
      }) as never
  );
}

describe("ObraDiarioTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
    mobile.value = false;
    fake.supabase.storage.from.mockReset();
  });

  it("sem RDO nem registros abre na lista vazia e oferece registrar o dia", async () => {
    montar();
    expect(await screen.findByText("Diário vazio")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Registrar dia" })[0]);
    expect(screen.getByRole("dialog", { name: "rdo-form" })).toHaveTextContent("novo");
  });

  it("sem edição não mostra os botões de registrar", async () => {
    montar(false);
    expect(await screen.findByText("Diário vazio")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Registrar dia|Gravar registro/ })).not.toBeInTheDocument();
  });

  it("lista mostra o detalhe de cada dia", async () => {
    comDados();
    montar();
    expect(await screen.findByText("Concretagem da laje")).toBeInTheDocument();
    expect(screen.getByText("Chuva à tarde")).toBeInTheDocument();
    expect(await screen.findByText("Laje")).toBeInTheDocument();
    expect(screen.getByText("Tarefa removida")).toBeInTheDocument();
    expect(screen.getByText(/— liberado/)).toBeInTheDocument();
    expect(screen.getByText("Concluiu")).toBeInTheDocument();
    expect(screen.getByText("Parou")).toBeInTheDocument();
    expect(await screen.findByText(/Equipe Forma: 4/)).toBeInTheDocument();
    expect(screen.getByText(/Avulsos: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Sem nome: 1/)).toBeInTheDocument();
    expect(await screen.findByText("Chuva forte")).toBeInTheDocument();
    expect(await screen.findByText("Gerdau")).toBeInTheDocument();
    expect(await screen.findByText(/Concreto: 12 m³/)).toBeInTheDocument();
    expect(await screen.findByAltText("Foto da obra")).toHaveAttribute("src", "https://foto/a");
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("editar um dia abre o formulário com o RDO", async () => {
    comDados();
    montar();
    const card = (await screen.findByText("Concretagem da laje")).closest(".rounded-2xl") as HTMLElement;
    fireEvent.click(within(card).getAllByRole("button")[0]);
    expect(screen.getByRole("dialog", { name: "rdo-form" })).toHaveTextContent("editar r-1");
  });

  it("excluir pede confirmação e remove", async () => {
    comDados();
    montar();
    const card = (await screen.findByText("Concretagem da laje")).closest(".rounded-2xl") as HTMLElement;
    fireEvent.click(within(card).getAllByRole("button")[1]);
    expect(await screen.findByText("Excluir registro?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Registro removido"));
    expect(fake.escritas("obra_rdo")[0]).toMatchObject({ op: "delete", filtros: [["eq", "id", "r-1"]] });
  });

  it("erro ao excluir avisa", async () => {
    comDados();
    fake.responder((c) => {
      if (c.op === "delete") return { data: null, error: new Error("RLS negou") };
      if (c.tabela === "obra_rdo") return { data: rdos, error: null };
      return undefined;
    });
    montar();
    const card = (await screen.findByText("Concretagem da laje")).closest(".rounded-2xl") as HTMLElement;
    fireEvent.click(within(card).getAllByRole("button")[1]);
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível remover", { description: "RLS negou" })
    );
  });

  it("feed mostra o resumo com contagens e abre a edição ao clicar", async () => {
    comDados();
    montar();
    await screen.findByText("Concretagem da laje");
    fireEvent.click(screen.getByRole("button", { name: "Feed" }));
    expect(await screen.findByText("2 tarefas")).toBeInTheDocument();
    expect(screen.getByText("3 equipes")).toBeInTheDocument();
    expect(screen.getByText("⚠ 1 impedimento")).toBeInTheDocument();
    expect(screen.getByText("2 visitas")).toBeInTheDocument();
    expect(screen.getByText("1 tarefa")).toBeInTheDocument();
    expect(screen.getByText(/Ana/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("2 tarefas"));
    expect(screen.getByRole("dialog", { name: "rdo-form" })).toHaveTextContent("editar r-1");
  });

  it("com registros gravados abre na visão Registros e fecha o dia", async () => {
    comDados({ obra_registro: [{ id: "reg-1", status: "pronto", data_registro: "2026-11-05", fotos: [] }] });
    montar();
    expect(await screen.findByText("timeline-registros")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "fechar-dia-com-rdo" }));
    expect(screen.getByRole("dialog", { name: "rdo-form" })).toHaveTextContent("editar r-1 rascunho 2026-11-05");
  });

  it("fechar um dia sem RDO abre o formulário novo com rascunho", async () => {
    comDados({ obra_registro: [{ id: "reg-1", status: "pronto", data_registro: "2026-11-06", fotos: [] }] });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "fechar-dia-novo" }));
    expect(screen.getByRole("dialog", { name: "rdo-form" })).toHaveTextContent("novo rascunho 2026-11-06");
  });

  it("gravar registro e enviar troca para a visão Registros", async () => {
    comDados();
    montar();
    await screen.findByText("Concretagem da laje");
    fireEvent.click(screen.getAllByRole("button", { name: /Gravar registro/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: "enviado" }));
    expect(await screen.findByText("timeline-registros")).toBeInTheDocument();
  });

  it("no celular o botão de registrar fica só com ícone", async () => {
    mobile.value = true;
    montar();
    const [btn] = await screen.findAllByRole("button", { name: "Registrar dia" });
    expect(btn).not.toHaveTextContent("Registrar dia");
  });
});
