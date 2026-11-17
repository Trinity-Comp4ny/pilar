import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EstruturaFluxo } from "@/pages/obras/lib/fluxoObra";

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
  sincronizacoes: { data: [] as unknown[], isLoading: false },
  aplicarObras: vi.fn(),
  aplicarProjetos: vi.fn(),
  sincronizacoesProjetos: { data: [] as unknown[], isLoading: false },
  salvarFluxo: vi.fn(),
  vincularObra: vi.fn(),
  fluxos: [] as unknown[],
  importar: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/pages/obras/hooks/useSincronizarFluxoObra", () => ({
  useSincronizacoesDoFluxoObra: () => h.sincronizacoes,
  useAplicarSincronizacoesObra: () => ({ mutateAsync: h.aplicarObras, isPending: false }),
  vincularObraAoFluxo: (...a: unknown[]) => h.vincularObra(...a),
}));
vi.mock("@/pages/projetos/hooks/useSincronizarFluxoProjetos", () => ({
  useSincronizacoesDoFluxoProjetos: () => h.sincronizacoesProjetos,
  useAplicarSincronizacoesProjetos: () => ({ mutateAsync: h.aplicarProjetos, isPending: false }),
}));
vi.mock("@/pages/obras/hooks/useFluxosObra", () => ({
  useSalvarFluxoObra: () => ({ mutateAsync: h.salvarFluxo, isPending: false }),
  useFluxosObra: () => ({ data: h.fluxos }),
}));
vi.mock("@/pages/obras/hooks/useImportarCronograma", () => ({
  useImportarCronograma: () => ({ mutateAsync: h.importar, isPending: false }),
}));
vi.mock("@/hooks/useMoneyMask", () => ({
  useMoneyMask: () => (v: number) => `R$ ${v.toFixed(2)}`,
}));

import { SincronizarObrasDialog } from "./SincronizarObrasDialog";
import { SincronizarProjetosDialog } from "@/pages/projetos/components/SincronizarProjetosDialog";
import { SalvarComoFluxoDialog } from "./SalvarComoFluxoDialog";
import { AplicarFluxoObraDialog } from "./AplicarFluxoObraDialog";
import { ObraDespesasAgrupadas } from "./ObraDespesasAgrupadas";

const estrutura: EstruturaFluxo = [
  {
    nome: "Fundação",
    etapas: [
      {
        nome: "Escavação",
        servicos: [
          { nome: "Locação", duracao_dias: 3, fornecedor_id: null, paralelo: false, tarefas: ["Marcar eixos"] },
        ],
      },
    ],
  },
];

const planoVazio = { nos: [], tarefas: [], prestadores: [], periodos: [] };
const planoComItens = {
  nos: [{ nivel: "fase" }, { nivel: "etapa" }, { nivel: "servico" }],
  tarefas: [{}, {}],
  prestadores: [{}],
  periodos: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.sincronizacoes = { data: [], isLoading: false };
  h.sincronizacoesProjetos = { data: [], isLoading: false };
  h.fluxos = [];
  h.aplicarObras.mockResolvedValue({ ok: 1, falhas: [] });
  h.aplicarProjetos.mockResolvedValue({ ok: 1, falhas: [] });
  h.salvarFluxo.mockResolvedValue("novo-id");
  h.vincularObra.mockResolvedValue(undefined);
  h.importar.mockResolvedValue({ nos: 3, tarefas: 1 });
});

describe("SincronizarObrasDialog", () => {
  it("descreve o que entra em cada obra e atualiza só as marcadas", async () => {
    h.sincronizacoes = {
      isLoading: false,
      data: [
        { obra: { id: "o1", nome: "Casa A" }, plano: { ...planoComItens, nos: [{ nivel: "fase" }] }, temAlgo: true },
        { obra: { id: "o2", nome: "Casa B" }, plano: planoVazio, temAlgo: false },
      ],
    };
    const onOpenChange = vi.fn();
    render(<SincronizarObrasDialog fluxo={{ id: "x", nome: "Residencial", estrutura }} onOpenChange={onOpenChange} />);
    expect(screen.getByText(/item novo/)).toBeInTheDocument();
    expect(screen.getByText("Já está em dia")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Atualizar 1" }));
    await waitFor(() => expect(h.aplicarObras).toHaveBeenCalled());
    expect(h.aplicarObras.mock.calls[0][0]).toHaveLength(1);
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(h.toast.success).toHaveBeenCalledWith("1 obra atualizada");
  });

  it("se alguma falha, avisa quais e não fecha", async () => {
    h.sincronizacoes = {
      isLoading: false,
      data: [{ obra: { id: "o1", nome: "Casa A" }, plano: planoComItens, temAlgo: true }],
    };
    h.aplicarObras.mockResolvedValue({ ok: 0, falhas: ["Casa A"] });
    const onOpenChange = vi.fn();
    render(<SincronizarObrasDialog fluxo={{ id: "x", nome: "Residencial", estrutura }} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Atualizar 1" }));
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("sem fluxo escolhido fica fechado", () => {
    render(<SincronizarObrasDialog fluxo={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });
});

describe("SincronizarProjetosDialog", () => {
  it("mostra novas disciplinas e mudanças de coluna e confirma", async () => {
    h.sincronizacoesProjetos = {
      isLoading: false,
      data: [
        {
          projeto: { id: "p1", nome: "Residência" },
          plano: { novas: [{}, {}], encaixadas: [{}] },
          mudamDeColuna: 1,
          temAlgo: true,
        },
        {
          projeto: { id: "p2", nome: "Galpão" },
          plano: { novas: [], encaixadas: [] },
          mudamDeColuna: 0,
          temAlgo: false,
        },
      ],
    };
    const onOpenChange = vi.fn();
    render(
      <SincronizarProjetosDialog
        fluxo={{ id: "x", nome: "Projeto padrão", disciplinas: [] } as never}
        onOpenChange={onOpenChange}
      />
    );
    expect(screen.getByText("Residência")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Atualizar 1" }));
    await waitFor(() => expect(h.aplicarProjetos).toHaveBeenCalled());
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("falha parcial avisa e mantém aberto", async () => {
    h.sincronizacoesProjetos = {
      isLoading: false,
      data: [
        {
          projeto: { id: "p1", nome: "Residência" },
          plano: { novas: [{}], encaixadas: [] },
          mudamDeColuna: 0,
          temAlgo: true,
        },
      ],
    };
    h.aplicarProjetos.mockResolvedValue({ ok: 0, falhas: ["Residência"] });
    render(
      <SincronizarProjetosDialog fluxo={{ id: "x", nome: "Padrão", disciplinas: [] } as never} onOpenChange={vi.fn()} />
    );
    await userEvent.click(screen.getByRole("button", { name: "Atualizar 1" }));
    await waitFor(() => expect(h.toast.warning).toHaveBeenCalled());
  });
});

describe("SalvarComoFluxoDialog", () => {
  const nos = [
    {
      id: "f",
      nome: "Fundação",
      nivel: "fase",
      parent_id: null,
      ordem: 0,
      data_inicio: "2026-11-01",
      data_fim: "2026-11-10",
    },
    {
      id: "e",
      nome: "Escavação",
      nivel: "etapa",
      parent_id: "f",
      ordem: 0,
      data_inicio: "2026-11-01",
      data_fim: "2026-11-05",
    },
    {
      id: "s",
      nome: "Locação",
      nivel: "servico",
      parent_id: "e",
      ordem: 0,
      data_inicio: "2026-11-01",
      data_fim: "2026-11-03",
    },
  ] as never[];

  it("salva a estrutura da obra como fluxo e vincula a obra a ele", async () => {
    const onOpenChange = vi.fn();
    render(
      <SalvarComoFluxoDialog
        open
        onOpenChange={onOpenChange}
        nos={nos}
        tarefas={[]}
        nomeSugerido="Casa A"
        obraId="o1"
      />
    );
    expect(screen.getByLabelText("Nome do fluxo")).toHaveValue("Fluxo Casa A");
    await userEvent.click(screen.getByRole("button", { name: "Salvar fluxo" }));
    await waitFor(() => expect(h.salvarFluxo).toHaveBeenCalled());
    expect(h.salvarFluxo.mock.calls[0][0].nome).toBe("Fluxo Casa A");
    expect(h.vincularObra).toHaveBeenCalledWith("o1", "novo-id");
    expect(h.toast.success).toHaveBeenCalledWith("Fluxo salvo", expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("recusa cronograma sem serviços", async () => {
    render(
      <SalvarComoFluxoDialog open onOpenChange={vi.fn()} nos={[]} tarefas={[]} nomeSugerido="Casa A" obraId="o1" />
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar fluxo" }));
    await waitFor(() => expect(h.toast.error).toHaveBeenCalled());
    expect(h.salvarFluxo).not.toHaveBeenCalled();
  });

  it("erro do banco vira aviso e não fecha", async () => {
    h.salvarFluxo.mockRejectedValue(new Error("RLS negou"));
    const onOpenChange = vi.fn();
    render(
      <SalvarComoFluxoDialog
        open
        onOpenChange={onOpenChange}
        nos={nos}
        tarefas={[]}
        nomeSugerido="Casa A"
        obraId="o1"
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Salvar fluxo" }));
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "RLS negou" })
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("AplicarFluxoObraDialog", () => {
  it("sem fluxo escolhido não deixa aplicar", () => {
    render(
      <AplicarFluxoObraDialog
        open
        onOpenChange={vi.fn()}
        obraId="o1"
        projetoId={null}
        fasesExistentes={0}
        inicioPadrao="2026-11-01"
      />
    );
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
    expect(screen.getByText("Nenhum fluxo cadastrado")).toBeInTheDocument();
  });

  it("escolhe o fluxo, mostra o resumo e aplica, vinculando a obra", async () => {
    h.fluxos = [{ id: "x1", nome: "Residencial", descricao: null, estrutura }];
    const onOpenChange = vi.fn();
    render(
      <AplicarFluxoObraDialog
        open
        onOpenChange={onOpenChange}
        obraId="o1"
        projetoId="p1"
        fasesExistentes={1}
        inicioPadrao="2026-11-02"
      />
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Residencial" }));
    expect(await screen.findByText(/1 serviços e 1 tarefas/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() => expect(h.importar).toHaveBeenCalled());
    expect(h.vincularObra).toHaveBeenCalledWith("o1", "x1");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("erro ao aplicar avisa e não fecha", async () => {
    h.fluxos = [{ id: "x1", nome: "Residencial", descricao: null, estrutura }];
    h.importar.mockRejectedValue(new Error("falhou"));
    const onOpenChange = vi.fn();
    render(
      <AplicarFluxoObraDialog open onOpenChange={onOpenChange} obraId="o1" projetoId={null} fasesExistentes={0} />
    );
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Residencial" }));
    await userEvent.click(screen.getByRole("button", { name: "Aplicar" }));
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("Não foi possível aplicar", { description: "falhou" })
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("ObraDespesasAgrupadas", () => {
  const despesas = [
    { id: "1", tipo: "despesa", valor: 300, descricao: "Cimento", fornecedor_id: "f1", quantidade: 10, unidade: "sc" },
    { id: "2", tipo: "despesa", valor: 100, descricao: "Cimento", fornecedor_id: "f2", quantidade: 5, unidade: "sc" },
    { id: "3", tipo: "aporte", valor: 999, descricao: "Aporte", fornecedor_id: null, quantidade: null, unidade: null },
  ] as never[];

  it("soma por fornecedor e alterna para item", async () => {
    render(<ObraDespesasAgrupadas lancamentos={despesas} nomeFornecedor={new Map([["f1", "Casa do Construtor"]])} />);
    expect(screen.getByText("Casa do Construtor")).toBeInTheDocument();
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Por item" }));
    expect(screen.getByText("Cimento")).toBeInTheDocument();
    expect(screen.getByText(/15 sc/)).toBeInTheDocument();
  });

  it("sem despesa não mostra nada", () => {
    const { container } = render(<ObraDespesasAgrupadas lancamentos={[]} nomeFornecedor={new Map()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
