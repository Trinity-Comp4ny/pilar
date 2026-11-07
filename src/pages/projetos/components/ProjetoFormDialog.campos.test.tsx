import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Projeto } from "@/types/projetos";

// A casca do formulário de projeto com o hook dublado: cada campo chama o
// handleInputChange certo, a navegação entre passos (criação × edição), estados
// de salvando/consultando CEP e o fallback de pessoas/disciplinas.

const f = vi.hoisted(() => ({
  form: {} as Record<string, unknown>,
  usarDisciplinasId: undefined as string | undefined,
  pessoasFallback: vi.fn(),
  podeFinanceiro: true,
}));

vi.mock("./useProjetoForm", () => ({
  ESTADOS_BR: ["PR", "SP"],
  useProjetoForm: () => f.form,
}));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useProjetoDisciplinas: (id: string | undefined) => {
    f.usarDisciplinasId = id;
    return { data: undefined };
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ is: () => ({ order: () => f.pessoasFallback() }) }),
    }),
  },
}));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => f.podeFinanceiro }) }));
vi.mock("@/hooks/useNivelConfianca", () => ({ useNivelConfianca: () => ({ isAdmin: true }) }));
vi.mock("@/components/trial/DesbloqueioNivel", () => ({
  DesbloqueioNivel: ({ onOpenChange, limite }: { onOpenChange: (o: boolean) => void; limite: number }) => (
    <button onClick={() => onOpenChange(false)}>desbloqueio {limite}</button>
  ),
}));
vi.mock("./DisciplinasSection", () => ({
  DisciplinasSection: ({ pessoas }: { pessoas: { nome: string }[] }) => (
    <p>secao-disciplinas:{pessoas.map((p) => p.nome).join(",")}</p>
  ),
}));
vi.mock("./DisciplinaDetailDialog", () => ({
  DisciplinaDetailDialog: ({ disciplina }: { disciplina: { disciplina: string } | null }) =>
    disciplina ? <p>detalhe:{disciplina.disciplina}</p> : null,
}));
vi.mock("@/components/ui/date-picker", () => ({
  DatePicker: ({ id, value, onChange }: { id?: string; value?: string; onChange: (v: string) => void }) => (
    <input data-testid={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { ProjetoFormDialog } from "./ProjetoFormDialog";

const handleInputChange = vi.fn();
const fetchCep = vi.fn();
const handleSubmit = vi.fn();
const applyTemplate = vi.fn();
const fecharCapacidadeErro = vi.fn();

function formBase(p: Record<string, unknown> = {}) {
  return {
    isEditMode: false,
    isSaving: false,
    isFetchingCep: false,
    isDirty: () => false,
    formData: {
      nome: "Residência Seed",
      cliente_id: "",
      prioridade: "Media",
      area_m2: "",
      loc_cep: "",
      loc_logradouro: "",
      loc_numero: "",
      loc_bairro: "",
      loc_cidade: "",
      loc_estado: "",
      valor_contrato: "",
      parcelas: "",
      dia_pagamento: "",
      data_inicio: "2026-03-01",
      data_previsao: "",
      data_final: "",
      prazo_dias_uteis: "",
      observacao: "",
    },
    handleInputChange,
    fetchCep,
    handleSubmit,
    applyTemplate,
    applyFluxo: vi.fn(),
    capacidadeErro: null,
    fecharCapacidadeErro,
    projetosDisciplinas: [{ disciplina: "Civil" }],
    selectedDisciplinaIndex: null,
    isDisciplinaDetailOpen: false,
    setIsDisciplinaDetailOpen: vi.fn(),
    ...p,
  };
}

function montar(p: Partial<React.ComponentProps<typeof ProjetoFormDialog>> = {}) {
  const onOpenChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(
    <ProjetoFormDialog
      open
      onOpenChange={onOpenChange}
      editProjeto={null}
      clientes={[{ id: "c1", nome: "Construtora Seed" }]}
      pessoas={[{ id: "p1", nome: "Ana" }]}
      disciplinas={[]}
      templatesData={[{ id: "tp1", nome: "Casa", tipo_servico: "Residencial" } as never]}
      currentUser={null}
      onSaved={vi.fn()}
      existingDisciplinas={[]}
      {...p}
    />,
    { wrapper: Wrapper }
  );
  return { onOpenChange };
}

function escolher(gatilho: HTMLElement, opcao: string | RegExp) {
  fireEvent.keyDown(gatilho, { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
}
const proximo = () => fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));

beforeEach(() => {
  vi.clearAllMocks();
  f.podeFinanceiro = true;
  f.form = formBase();
  f.pessoasFallback.mockResolvedValue({ data: [{ id: "px", nome: "Pessoa do banco" }] });
});

describe("ProjetoFormDialog: passo 1", () => {
  it("template, cliente, prioridade, área e endereço chamam o campo certo", () => {
    montar();
    const [template, cliente, prioridade, uf] = screen.getAllByRole("combobox");
    escolher(template, "Casa (Residencial)");
    expect(applyTemplate).toHaveBeenCalledWith("tp1");
    escolher(cliente, "Construtora Seed");
    expect(handleInputChange).toHaveBeenCalledWith("cliente_id", "c1");
    escolher(prioridade, /Alta/);
    expect(handleInputChange).toHaveBeenCalledWith("prioridade", "Alta");
    escolher(uf, "SP");
    expect(handleInputChange).toHaveBeenCalledWith("loc_estado", "SP");

    fireEvent.change(screen.getByLabelText("Área (m²)"), { target: { value: "120" } });
    expect(handleInputChange).toHaveBeenCalledWith("area_m2", "120");
    fireEvent.change(screen.getByPlaceholderText("Rua, Av, Travessa..."), { target: { value: "Rua A" } });
    expect(handleInputChange).toHaveBeenCalledWith("loc_logradouro", "Rua A");
    fireEvent.change(screen.getByPlaceholderText("Nº"), { target: { value: "10" } });
    expect(handleInputChange).toHaveBeenCalledWith("loc_numero", "10");
    fireEvent.change(screen.getByPlaceholderText("Bairro"), { target: { value: "Centro" } });
    expect(handleInputChange).toHaveBeenCalledWith("loc_bairro", "Centro");
    fireEvent.change(screen.getByPlaceholderText("Cidade"), { target: { value: "Curitiba" } });
    expect(handleInputChange).toHaveBeenCalledWith("loc_cidade", "Curitiba");
  });

  it("CEP é formatado e só consulta com 8 dígitos", () => {
    montar();
    const cep = screen.getByPlaceholderText("00000-000");
    fireEvent.change(cep, { target: { value: "8001" } });
    expect(handleInputChange).toHaveBeenLastCalledWith("loc_cep", "8001");
    expect(fetchCep).not.toHaveBeenCalled();
    fireEvent.change(cep, { target: { value: "80010-0a10" } });
    expect(handleInputChange).toHaveBeenLastCalledWith("loc_cep", "80010-010");
    expect(fetchCep).toHaveBeenCalledWith("80010010");
  });

  it("consultando CEP mostra a marca de espera", () => {
    f.form = formBase({ isFetchingCep: true });
    montar();
    expect(document.querySelector(".absolute.right-2")).not.toBeNull();
  });

  it("sem templates não mostra o seletor de template", () => {
    montar({ templatesData: [] });
    expect(screen.queryByText("Criar a partir de template")).not.toBeInTheDocument();
  });
});

describe("ProjetoFormDialog: passo 2", () => {
  it("valor, parcelas, dia de pagamento, datas, prazo e observação", () => {
    montar();
    proximo();
    expect(screen.getByText("Valor, parcelas e datas")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Parcelas"), { target: { value: "3" } });
    expect(handleInputChange).toHaveBeenCalledWith("parcelas", "3");
    fireEvent.change(screen.getByLabelText("Dia fixo de pagamento (opcional)"), { target: { value: "10" } });
    expect(handleInputChange).toHaveBeenCalledWith("dia_pagamento", "10");
    fireEvent.change(screen.getByLabelText("Prazo (dias úteis)"), { target: { value: "30" } });
    expect(handleInputChange).toHaveBeenCalledWith("prazo_dias_uteis", "30");
    fireEvent.change(screen.getByTestId("dataInicio"), { target: { value: "2026-04-01" } });
    expect(handleInputChange).toHaveBeenCalledWith("data_inicio", "2026-04-01");
    fireEvent.change(screen.getByTestId("dataPrevisao"), { target: { value: "2026-05-01" } });
    expect(handleInputChange).toHaveBeenCalledWith("data_previsao", "2026-05-01");
    fireEvent.change(screen.getByTestId("dataFinal"), { target: { value: "2026-06-01" } });
    expect(handleInputChange).toHaveBeenCalledWith("data_final", "2026-06-01");
    fireEvent.change(screen.getByLabelText("Observação Geral"), { target: { value: "Obs" } });
    expect(handleInputChange).toHaveBeenCalledWith("observacao", "Obs");
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "1500" } });
    expect(handleInputChange).toHaveBeenCalledWith("valor_contrato", expect.any(String));

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("Cliente e localização")).toBeInTheDocument();
  });

  it("sem financeiro esconde o bloco de valor", () => {
    f.podeFinanceiro = false;
    montar();
    proximo();
    expect(screen.queryByLabelText("Valor (R$)")).not.toBeInTheDocument();
  });
});

describe("ProjetoFormDialog: passo 3 e salvar", () => {
  it("Enter no passo 3 envia; nos outros passos não", () => {
    montar();
    const form = document.querySelector("form")!;
    fireEvent.submit(form);
    expect(handleSubmit).not.toHaveBeenCalled();
    proximo();
    proximo();
    expect(screen.getByText("secao-disciplinas:Ana")).toBeInTheDocument();
    fireEvent.submit(document.querySelector("form")!);
    expect(handleSubmit).toHaveBeenCalledTimes(1);
  });

  it("salvando: botão mostra Salvando..., Cancelar e Voltar travam e fechar não sai", () => {
    f.form = formBase({ isSaving: true });
    const { onOpenChange } = montar();
    proximo();
    proximo();
    expect(screen.getByRole("button", { name: /Salvando/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("detalhe da disciplina selecionada vai para o diálogo de detalhe", () => {
    f.form = formBase({ selectedDisciplinaIndex: 0 });
    montar();
    expect(screen.getByText("detalhe:Civil")).toBeInTheDocument();
  });

  it("desbloqueio de capacidade fecha pelo próprio diálogo", () => {
    f.form = formBase({ capacidadeErro: { recurso: "projetos", limite: 5 } });
    montar();
    fireEvent.click(screen.getByRole("button", { name: "desbloqueio 5", hidden: true }));
    expect(fecharCapacidadeErro).toHaveBeenCalled();
  });

  it("Esc com alteração pede confirmação; Continuar editando mantém aberto", () => {
    f.form = formBase({ isDirty: () => true });
    const { onOpenChange } = montar();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.getByText("Descartar alterações?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Continuar editando" }));
    expect(screen.queryByText("Descartar alterações?")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("ProjetoFormDialog: edição e fallbacks", () => {
  const projeto = { id: "proj-1", nome: "Aurora" } as Projeto;

  it("edição: título, passos livres, sem dia de pagamento e botão Atualizar", () => {
    f.form = formBase({ isEditMode: true });
    montar({ editProjeto: projeto });
    expect(screen.getByText("Editar projeto")).toBeInTheDocument();
    expect(screen.queryByText("Criar a partir de template")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Escopo & Prazo/ }));
    expect(screen.queryByLabelText("Dia fixo de pagamento (opcional)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Disciplinas/ }));
    fireEvent.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(handleSubmit).toHaveBeenCalled();
  });

  it("criação: sem nome o Próximo não avança", () => {
    f.form = formBase({ formData: { ...formBase().formData, nome: "" } });
    montar();
    proximo();
    expect(screen.getByText("Informe o nome do projeto")).toBeInTheDocument();
    expect(screen.getByText("Cliente e localização")).toBeInTheDocument();
  });

  it("criação: avança e volta pelo stepper", () => {
    montar();
    proximo();
    fireEvent.click(screen.getByRole("button", { name: /Escopo & Prazo/ }));
    expect(screen.getByText("Valor, parcelas e datas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Identificação/ }));
    expect(screen.getByText("Cliente e localização")).toBeInTheDocument();
  });

  it("salvar no passo 3 sem nome volta para o passo 1 com o erro", () => {
    montar();
    proximo();
    proximo();
    f.form = formBase({ formData: { ...formBase().formData, nome: " " } });
    // Força rerender com o novo estado do hook: alterna o passo e volta.
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    proximo();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(handleSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Cliente e localização")).toBeInTheDocument();
    expect(screen.getByText("Informe o nome do projeto")).toBeInTheDocument();
  });

  it("edição sem disciplinas passadas busca pelo id; sem pessoas usa a lista do banco", async () => {
    montar({ editProjeto: projeto, existingDisciplinas: undefined, pessoas: [] });
    expect(f.usarDisciplinasId).toBe("proj-1");
    proximo();
    proximo();
    await act(async () => {});
    expect(await screen.findByText("secao-disciplinas:Pessoa do banco")).toBeInTheDocument();
  });

  it("fallback de pessoas sem dados vira lista vazia", async () => {
    f.pessoasFallback.mockResolvedValue({ data: null });
    montar({ pessoas: [] });
    proximo();
    proximo();
    await act(async () => {});
    expect(screen.getByText("secao-disciplinas:")).toBeInTheDocument();
  });
});
