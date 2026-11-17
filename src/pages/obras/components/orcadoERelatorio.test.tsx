import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resultadoDoSobrado } from "@/test/estimativaFixtures";
import { obraDaEstimativa } from "@/pages/obras/estimativa/obraDaEstimativa";
import { montarOrcadoRealizado } from "@/lib/orcadoRealizado";

Element.prototype.scrollIntoView ??= () => {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const h = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
  estimativas: [] as unknown[],
  nos: [] as unknown[],
  orcamentos: [] as unknown[],
  conta: [] as unknown[],
  salvarLote: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: h.toast }));
vi.mock("@/hooks/useMoneyMask", () => ({ useMoneyMask: () => (v: number) => `R$ ${v.toFixed(2)}` }));
vi.mock("@/pages/obras/estimativa/hooks", () => ({ useEstimativas: () => ({ data: h.estimativas }) }));
vi.mock("@/pages/obras/hooks/useObraFrentes", () => ({ useObraFrentes: () => ({ data: h.nos }) }));
vi.mock("@/pages/obras/hooks/useObraOrcamento", () => ({
  useObraOrcamento: () => ({ data: h.orcamentos }),
  useSalvarOrcamentoEmLote: () => ({ mutateAsync: h.salvarLote, isPending: false }),
}));
vi.mock("@/pages/obras/hooks/useObraConta", () => ({ useObraConta: () => ({ data: h.conta }) }));

import { ObraOrcadoRealizadoCard } from "./ObraOrcadoRealizado";
import { PreencherOrcadoDialog } from "./PreencherOrcadoDialog";
import { RelatorioClienteDialog } from "./RelatorioClienteDialog";

const no = (id: string, nome: string, nivel: string, parent_id: string | null, ordem = 0) => ({
  id,
  nome,
  nivel,
  parent_id,
  ordem,
});
const nosDaObra = [
  no("f", "Fundação", "fase", null),
  no("e", "Escavação", "etapa", "f"),
  no("s", "Locação", "servico", "e"),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.estimativas = [];
  h.nos = [];
  h.orcamentos = [];
  h.conta = [];
  h.salvarLote.mockResolvedValue(undefined);
});

describe("ObraOrcadoRealizadoCard", () => {
  const dados = () => montarOrcadoRealizado(nosDaObra as never[], new Map([["e", 1000]]), { e: 1200, s: 50 });

  it("mostra a árvore com previsto, realizado, desvio e total", () => {
    render(<ObraOrcadoRealizadoCard dados={dados()} canEdit={false} onSave={vi.fn()} />);
    expect(screen.getByText("Fundação")).toBeInTheDocument();
    expect(screen.getByText("Total da obra")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$ 1000.00/).length).toBeGreaterThan(0);
  });

  it("recolhe e expande uma fase", async () => {
    render(<ObraOrcadoRealizadoCard dados={dados()} canEdit={false} onSave={vi.fn()} />);
    expect(screen.getByText("Escavação")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Recolher Fundação" }));
    expect(screen.queryByText("Escavação")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Expandir Fundação" }));
    expect(screen.getByText("Escavação")).toBeInTheDocument();
  });

  it("quem edita grava o previsto ao sair do campo, só quando mudou", async () => {
    const onSave = vi.fn();
    render(<ObraOrcadoRealizadoCard dados={dados()} canEdit onSave={onSave} />);
    const campo = screen.getByLabelText("Previsto de Escavação");
    await userEvent.click(campo);
    await userEvent.tab();
    expect(onSave).not.toHaveBeenCalled();
    await userEvent.clear(campo);
    await userEvent.type(campo, "2500");
    await userEvent.tab();
    expect(onSave).toHaveBeenCalledWith("e", 2500);
  });

  it("despesa sem fase aparece numa linha à parte", () => {
    const d = montarOrcadoRealizado(nosDaObra as never[], new Map(), { __sem_etapa__: 300 });
    render(<ObraOrcadoRealizadoCard dados={{ ...d, semEtapa: 300 }} canEdit={false} onSave={vi.fn()} />);
    expect(screen.getByText("Sem fase, etapa ou serviço")).toBeInTheDocument();
  });
});

describe("PreencherOrcadoDialog", () => {
  const est = obraDaEstimativa(resultadoDoSobrado());
  const nosIguais = () =>
    est.fases.flatMap((f, fi) => [
      no(`f${fi}`, f.nome, "fase", null, fi),
      ...f.etapas.map((e, ei) => no(`f${fi}e${ei}`, e.nome, "etapa", `f${fi}`, ei)),
    ]);

  it("sem estimativa calculada avisa no seletor", () => {
    render(<PreencherOrcadoDialog open onOpenChange={vi.fn()} obraId="o1" />);
    expect(screen.getByText("Nenhuma estimativa calculada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Preencher o orçado" })).toBeDisabled();
  });

  it("escolhe a estimativa, mostra o que entra e grava em lote", async () => {
    h.estimativas = [{ id: "est1", nome: "Sobrado", clienteNome: "Marcelo", resultado: resultadoDoSobrado() }];
    h.nos = nosIguais();
    const onOpenChange = vi.fn();
    render(<PreencherOrcadoDialog open onOpenChange={onOpenChange} obraId="o1" />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: /Sobrado · Marcelo/ }));
    expect(await screen.findByText(/Total que entra/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Preencher o orçado" }));
    await waitFor(() => expect(h.salvarLote).toHaveBeenCalled());
    expect(h.salvarLote.mock.calls[0][0].length).toBeGreaterThan(0);
    expect(h.toast.success).toHaveBeenCalledWith("Orçado preenchido", expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("valor já preenchido é mantido, e dá para substituir", async () => {
    h.estimativas = [{ id: "est1", nome: "Sobrado", clienteNome: null, resultado: resultadoDoSobrado() }];
    h.nos = nosIguais();
    h.orcamentos = [{ obra_frente_id: "f0e0", valor_previsto: "999" }];
    render(<PreencherOrcadoDialog open onOpenChange={vi.fn()} obraId="o1" />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Sobrado" }));
    expect(await screen.findByText(/mantido · R\$ 999.00/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(screen.queryByText(/mantido ·/)).not.toBeInTheDocument());
  });

  it("obra sem nomes iguais avisa que nada casa", async () => {
    h.estimativas = [{ id: "est1", nome: "Sobrado", clienteNome: null, resultado: resultadoDoSobrado() }];
    h.nos = [no("x", "Outro nome", "fase", null)];
    render(<PreencherOrcadoDialog open onOpenChange={vi.fn()} obraId="o1" />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Sobrado" }));
    expect(await screen.findByText(/Nenhuma fase ou etapa da obra tem o mesmo nome/)).toBeInTheDocument();
  });

  it("erro do banco avisa e mantém aberto", async () => {
    h.salvarLote.mockRejectedValue(new Error("RLS negou"));
    h.estimativas = [{ id: "est1", nome: "Sobrado", clienteNome: null, resultado: resultadoDoSobrado() }];
    h.nos = nosIguais();
    const onOpenChange = vi.fn();
    render(<PreencherOrcadoDialog open onOpenChange={onOpenChange} obraId="o1" />);
    await userEvent.click(screen.getByRole("combobox"));
    await userEvent.click(await screen.findByRole("option", { name: "Sobrado" }));
    await userEvent.click(await screen.findByRole("button", { name: "Preencher o orçado" }));
    await waitFor(() =>
      expect(h.toast.error).toHaveBeenCalledWith("Não foi possível preencher", { description: "RLS negou" })
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe("RelatorioClienteDialog", () => {
  const lancamentos = [
    { id: "1", tipo: "aporte", valor: 5000, data: "2026-11-01", descricao: "Aporte", confirmada_portal: true },
    {
      id: "2",
      tipo: "despesa",
      valor: 800,
      data: "2026-11-03",
      descricao: "Cimento",
      obra_frente_id: "e",
      quantidade: 40,
      unidade: "sc",
      confirmada_portal: true,
    },
    { id: "3", tipo: "despesa", valor: 300, data: "2026-11-04", descricao: "Em conferência", confirmada_portal: false },
  ];

  it("mostra o que o cliente vê, avisa das em conferência e imprime", async () => {
    h.nos = nosDaObra;
    h.orcamentos = [{ obra_frente_id: "e", valor_previsto: "1000" }];
    h.conta = lancamentos;
    const imprimir = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<RelatorioClienteDialog open onOpenChange={vi.fn()} obraId="o1" obraNome="Casa Azul" />);
    expect(screen.getByRole("heading", { name: "Casa Azul" })).toBeInTheDocument();
    expect(screen.getByText(/1 despesa em conferência não entra/)).toBeInTheDocument();
    expect(screen.getByText("Cimento")).toBeInTheDocument();
    expect(screen.queryByText("Em conferência")).not.toBeInTheDocument();
    expect(screen.getByText(/40 sc/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Imprimir ou salvar em PDF/ }));
    expect(imprimir).toHaveBeenCalled();
  });

  it("sem despesa confirmada diz isso", () => {
    h.nos = nosDaObra;
    h.conta = [lancamentos[0]];
    render(<RelatorioClienteDialog open onOpenChange={vi.fn()} obraId="o1" obraNome="Casa Azul" />);
    expect(screen.getByText("Nenhuma despesa confirmada ainda.")).toBeInTheDocument();
  });
});
