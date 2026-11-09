import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Projeto, ProjetoDisciplinaDB } from "@/types/projetos";

// Fronteira com o Supabase: as RPCs de criar/editar projeto, o delete de rollback,
// o update de coordenadas e a edge function de geocodificação.
const rpc = vi.fn();
const invoke = vi.fn();
const deleteEq = vi.fn();
const updateEq = vi.fn();
const from = vi.fn(() => ({
  delete: () => ({ eq: deleteEq }),
  update: () => ({ eq: updateEq }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: (...a: unknown[]) => from(...(a as [])),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));

const bulkSave = vi.fn();
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useBulkSaveDisciplinas: () => ({ mutateAsync: bulkSave }),
}));

let podeFinanceiro = true;
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (m: string) => (m === "financeiro" ? podeFinanceiro : true) }),
}));

const lookupCEP = vi.fn();
vi.mock("@/lib/brasilApi", () => ({ lookupCEP: (...a: unknown[]) => lookupCEP(...a) }));

const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

import { useProjetoForm } from "./useProjetoForm";

const pessoas = [
  { id: "p1", nome: "Ana" },
  { id: "p2", nome: "Bruno" },
];

// Referência estável: o hook reidrata o form quando a lista muda de identidade
// (o ProjetoFormDialog memoiza a dele).
const SEM_DISCIPLINAS: ProjetoDisciplinaDB[] = [];

function montar(
  opts: { editProjeto?: Projeto | null; existingDisciplinas?: ProjetoDisciplinaDB[]; open?: boolean } = {}
) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useProjetoForm({
        open: opts.open ?? true,
        onOpenChange,
        editProjeto: opts.editProjeto ?? null,
        existingDisciplinas: opts.existingDisciplinas ?? SEM_DISCIPLINAS,
        pessoas,
        templatesData: [],
        currentUser: { name: "Dev", email: "dev@local.test" },
        onSaved,
      }),
    { wrapper }
  );
  return { ...hook, onOpenChange, onSaved };
}

function preencher(result: { current: ReturnType<typeof useProjetoForm> }, campos: Record<string, string>) {
  for (const [k, v] of Object.entries(campos)) {
    act(() => result.current.handleInputChange(k, v));
  }
}

const projetoExistente = {
  id: "proj-1",
  codigo_projeto: "PRJ-0001",
  nome: "Edifício Aurora",
  cliente_id: "cli-1",
  localizacao: "",
  parcelas: "",
  area_m2: 1200,
  data_inicio: "2026-01-10",
  data_previsao: "2026-06-30",
  data_final: "",
  valor_contrato: 50000,
  observacao: "",
  status: "Em andamento",
  prioridade: "Alta",
  disciplinas: [],
} as unknown as Projeto;

describe("useProjetoForm: criação", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    podeFinanceiro = true;
    rpc.mockResolvedValue({ data: "novo-id", error: null });
    bulkSave.mockResolvedValue(undefined);
    invoke.mockResolvedValue({ data: { found: false }, error: null });
    updateEq.mockReturnValue(Promise.resolve({ error: null }));
    deleteEq.mockResolvedValue({ error: null });
  });

  it("sem nome: avisa campo obrigatório e não chama o servidor", async () => {
    const { result, onOpenChange, onSaved } = montar();
    preencher(result, { valor_contrato: "10.000,00", cliente_id: "cli-1" });

    await act(() => result.current.handleSubmit());

    expect(toast.error).toHaveBeenCalledWith("Campo obrigatório", { description: "Preencha o nome do projeto" });
    expect(rpc).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("parcelas com dia de pagamento mas sem cliente: bloqueia na criação", async () => {
    const { result } = montar();
    preencher(result, { nome: "Casa Lima", parcelas: "3", dia_pagamento: "10" });

    await act(() => result.current.handleSubmit());

    expect(toast.error).toHaveBeenCalledWith("Escolha o cliente do projeto", expect.anything());
    expect(rpc).not.toHaveBeenCalled();
  });

  it("caminho feliz: só o nome salva, sem parcelas nem geocodificação", async () => {
    const { result, onOpenChange, onSaved } = montar();
    preencher(result, { nome: "Casa Lima" });

    await act(() => result.current.handleSubmit());

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith(
      "create_projeto_completo",
      expect.objectContaining({
        p_codigo: "",
        p_nome: "Casa Lima",
        p_cliente_id: null,
        p_valor_contrato: 0,
        p_area_m2: 0,
        p_disciplinas: [],
      })
    );
    expect(bulkSave).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Projeto cadastrado", expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSaved).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("projeto_criado", { projeto_id: "novo-id", disciplinas: 0 });
  });

  it("caminho feliz completo: valor, área, parcelas e disciplina vão no payload", async () => {
    const { result } = montar();
    preencher(result, {
      nome: "Galpão Norte",
      cliente_id: "cli-9",
      valor_contrato: "12.500,50",
      area_m2: "830.5",
      parcelas: "4",
      dia_pagamento: "15",
      data_inicio: "2026-03-01",
    });
    act(() =>
      result.current.setTempDisciplina({ disciplina: "Estrutural", responsavel_id: "p1", data_inicio: "2026-03-02" })
    );
    act(() => result.current.addProjetoDisciplina());

    await act(() => result.current.handleSubmit());

    expect(rpc).toHaveBeenCalledWith(
      "create_projeto_completo",
      expect.objectContaining({
        p_nome: "Galpão Norte",
        p_cliente_id: "cli-9",
        p_valor_contrato: 12500.5,
        p_area_m2: 830.5,
        p_parcelas: "4",
        p_data_inicio: "2026-03-01",
      })
    );
    expect(bulkSave).toHaveBeenCalledWith({
      projetoId: "novo-id",
      disciplinas: [
        expect.objectContaining({ nome: "Estrutural", responsavel_ids: ["p1"], data_inicio: "2026-03-02" }),
      ],
    });
    expect(rpc).toHaveBeenCalledWith("rpc_gerar_parcelas_dia_fixo", {
      p_projeto_id: "novo-id",
      p_num_parcelas: 4,
      p_dia_fixo: 15,
    });
    expect(toast.success).toHaveBeenCalledWith("4 parcela(s) geradas", expect.anything());
  });

  it("sem permissão de financeiro: não envia valor (null = não mexe no contrato)", async () => {
    podeFinanceiro = false;
    const { result } = montar();
    preencher(result, { nome: "Sem financeiro", valor_contrato: "9.999,00" });

    await act(() => result.current.handleSubmit());

    expect(rpc).toHaveBeenCalledWith("create_projeto_completo", expect.objectContaining({ p_valor_contrato: null }));
  });

  it("erro do servidor: mantém o diálogo aberto e mostra toast", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "duplicate key", code: "23505" } });
    const { result, onOpenChange, onSaved } = montar();
    preencher(result, { nome: "Casa Lima" });

    await act(() => result.current.handleSubmit());

    expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", expect.anything());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
    expect(result.current.formData.nome).toBe("Casa Lima");
    expect(result.current.capacidadeErro).toBeNull();
  });

  it("capacidade:projetos abre o desbloqueio com o limite e não mostra toast genérico", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "capacidade:projetos", hint: "3" } });
    const { result, onOpenChange } = montar();
    preencher(result, { nome: "Quarto projeto" });

    await act(() => result.current.handleSubmit());

    expect(result.current.capacidadeErro).toEqual({ recurso: "projetos", limite: 3 });
    expect(toast.error).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith("trial_limite_atingido", { recurso: "projetos", limite: 3 });

    act(() => result.current.fecharCapacidadeErro());
    expect(result.current.capacidadeErro).toBeNull();
  });

  it("falha ao gravar disciplinas: desfaz o projeto criado e mantém aberto", async () => {
    bulkSave.mockRejectedValueOnce(new Error("rls"));
    const { result, onOpenChange } = montar();
    preencher(result, { nome: "Com disciplina" });
    act(() => result.current.setTempDisciplina({ disciplina: "Elétrica" }));
    act(() => result.current.addProjetoDisciplina());

    await act(() => result.current.handleSubmit());

    expect(from).toHaveBeenCalledWith("projetos");
    expect(deleteEq).toHaveBeenCalledWith("id", "novo-id");
    expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", expect.anything());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("parcelas que falham ao gerar: projeto salvo, avisa para gerar de novo", async () => {
    rpc.mockImplementation((nome: string) =>
      nome === "rpc_gerar_parcelas_dia_fixo"
        ? Promise.resolve({ error: { message: "falhou" } })
        : Promise.resolve({ data: "novo-id", error: null })
    );
    const { result, onOpenChange } = montar();
    preencher(result, { nome: "Parcelado", cliente_id: "c1", parcelas: "2", dia_pagamento: "5" });

    await act(() => result.current.handleSubmit());

    expect(toast.error).toHaveBeenCalledWith("Projeto salvo, mas as parcelas não foram geradas", expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("dia de pagamento fora de 1..31 não gera parcelas", async () => {
    const { result } = montar();
    preencher(result, { nome: "Dia 32", cliente_id: "c1", parcelas: "2", dia_pagamento: "32" });

    await act(() => result.current.handleSubmit());

    expect(rpc).not.toHaveBeenCalledWith("rpc_gerar_parcelas_dia_fixo", expect.anything());
  });

  it("disciplina com início antes do projeto: bloqueia com Datas inválidas", async () => {
    const { result } = montar();
    preencher(result, { nome: "Datas", data_inicio: "2026-05-10" });
    act(() => result.current.setTempDisciplina({ disciplina: "Hidráulica", data_inicio: "2026-05-01" }));
    act(() => result.current.addProjetoDisciplina());

    await act(() => result.current.handleSubmit());

    expect(toast.error).toHaveBeenCalledWith("Datas inválidas", {
      description: 'Disciplina "Hidráulica" tem início anterior ao do projeto',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("disciplina concluída depois da conclusão do projeto: bloqueia", async () => {
    const { result } = montar();
    preencher(result, { nome: "Datas", data_final: "2026-08-01" });
    act(() => result.current.setTempDisciplina({ disciplina: "MEP", data_final: "2026-09-01" }));
    act(() => result.current.addProjetoDisciplina());

    await act(() => result.current.handleSubmit());

    expect(toast.error).toHaveBeenCalledWith("Datas inválidas", expect.anything());
    expect(rpc).not.toHaveBeenCalled();
  });

  it("disciplina digitada e não incluída entra sozinha antes de salvar", async () => {
    const { result } = montar();
    preencher(result, { nome: "Esquecida" });
    act(() => result.current.setTempDisciplina({ disciplina: "Fundações", responsavel_id: "p2" }));

    await act(() => result.current.handleSubmit());

    expect(toast.info).toHaveBeenCalledWith("Disciplina pendente incluída automaticamente", expect.anything());
    expect(bulkSave).toHaveBeenCalledWith({
      projetoId: "novo-id",
      disciplinas: [expect.objectContaining({ nome: "Fundações", responsavel_ids: ["p2"] })],
    });
  });

  it("geocodificação: salva coordenadas quando o endereço é achado", async () => {
    invoke.mockResolvedValueOnce({ data: { found: true, lat: -23.5, lng: -46.6 }, error: null });
    const { result } = montar();
    preencher(result, { nome: "Com endereço", loc_cidade: "São Paulo", loc_estado: "SP", loc_cep: "01310100" });

    await act(() => result.current.handleSubmit());
    await act(async () => {});

    expect(invoke).toHaveBeenCalledWith(
      "geocode-address",
      expect.objectContaining({ body: expect.objectContaining({ city: "São Paulo", postalcode: "01310-100" }) })
    );
    expect(updateEq).toHaveBeenCalledWith("id", "novo-id");
  });

  it("geocodificação que falha avisa sem desfazer o projeto", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: new Error("edge") });
    const { result } = montar();
    preencher(result, { nome: "Endereço ruim", loc_cidade: "Xyz" });

    await act(() => result.current.handleSubmit());
    await act(async () => {});

    expect(toast.warning).toHaveBeenCalledWith("Geocodificação falhou", expect.anything());
    expect(toast.success).toHaveBeenCalledWith("Projeto cadastrado", expect.anything());
  });

  it("prazo em dias úteis calcula a previsão a partir do início", () => {
    const { result } = montar();
    preencher(result, { data_inicio: "2026-11-02", prazo_dias_uteis: "5" });
    expect(result.current.formData.data_previsao).toBe("2026-11-09");
  });

  it("prazo zero ou acima de 999 não mexe na previsão", () => {
    const { result } = montar();
    preencher(result, { data_inicio: "2026-11-02", prazo_dias_uteis: "0" });
    expect(result.current.formData.data_previsao).toBe("");
    preencher(result, { prazo_dias_uteis: "1000" });
    expect(result.current.formData.data_previsao).toBe("");
  });

  it("CEP com menos de 8 dígitos não consulta; CEP inexistente avisa", async () => {
    const { result } = montar();
    await act(() => result.current.fetchCep("123"));
    expect(lookupCEP).not.toHaveBeenCalled();

    lookupCEP.mockResolvedValueOnce(null);
    await act(() => result.current.fetchCep("00000-000"));
    expect(toast.error).toHaveBeenCalledWith("CEP não encontrado");
  });

  it("CEP válido preenche o endereço", async () => {
    lookupCEP.mockResolvedValueOnce({ street: "Av. Paulista", neighborhood: "Bela Vista", city: "SP", state: "SP" });
    const { result } = montar();
    await act(() => result.current.fetchCep("01310-100"));
    expect(result.current.formData).toEqual(
      expect.objectContaining({ loc_logradouro: "Av. Paulista", loc_bairro: "Bela Vista", loc_estado: "SP" })
    );
  });

  it("isDirty acusa alteração não salva", () => {
    const { result } = montar();
    expect(result.current.isDirty()).toBe(false);
    preencher(result, { nome: "x" });
    expect(result.current.isDirty()).toBe(true);
  });
});

describe("useProjetoForm: disciplinas no formulário", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it("não inclui disciplina sem nome", () => {
    const { result } = montar();
    act(() => result.current.setTempDisciplina({ responsavel_id: "p1" }));
    act(() => result.current.addProjetoDisciplina());
    expect(result.current.projetosDisciplinas).toHaveLength(0);
  });

  it("não deixa o mesmo responsável duas vezes na disciplina", () => {
    const { result } = montar();
    act(() => result.current.setTempDisciplina({ disciplina: "Civil", responsavel_id: "p1" }));
    act(() => result.current.addProjetoDisciplina());
    act(() =>
      result.current.setNewFormResp({ responsavel_id: "p1", data_inicio: "", data_previsao: "", data_final: "" })
    );
    act(() => result.current.addResponsavelToDisc(0));

    expect(toast.error).toHaveBeenCalledWith("Responsável já adicionado nesta disciplina");
    expect(result.current.projetosDisciplinas[0].responsaveis).toHaveLength(1);
  });

  it("adiciona segundo responsável e não deixa remover o último", () => {
    const { result } = montar();
    act(() => result.current.setTempDisciplina({ disciplina: "Civil", responsavel_id: "p1" }));
    act(() => result.current.addProjetoDisciplina());
    act(() =>
      result.current.setNewFormResp({ responsavel_id: "p2", data_inicio: "", data_previsao: "", data_final: "" })
    );
    act(() => result.current.addResponsavelToDisc(0));
    expect(result.current.projetosDisciplinas[0].responsaveis).toHaveLength(2);

    act(() => result.current.removeResponsavelFromDisc(0, 0));
    expect(result.current.projetosDisciplinas[0].responsaveis?.map((r) => r.responsavel_id)).toEqual(["p2"]);

    act(() => result.current.removeResponsavelFromDisc(0, 0));
    expect(toast.error).toHaveBeenCalledWith("A disciplina precisa ter ao menos um responsável");
    expect(result.current.projetosDisciplinas[0].responsaveis).toHaveLength(1);
  });

  it("adicionar responsável vazio e sem datas não muda nada", () => {
    const { result } = montar();
    act(() => result.current.setTempDisciplina({ disciplina: "Civil" }));
    act(() => result.current.addProjetoDisciplina());
    const antes = result.current.projetosDisciplinas[0];
    act(() => result.current.addResponsavelToDisc(0));
    expect(result.current.projetosDisciplinas[0]).toBe(antes);
  });

  it("observação vazia não entra; observação com texto entra com o autor", () => {
    const { result } = montar();
    act(() => result.current.setTempDisciplina({ disciplina: "Civil" }));
    act(() => result.current.addProjetoDisciplina());
    act(() => result.current.handleOpenDisciplinaDetail(0));
    act(() => result.current.setNewObservation("   "));
    act(() => result.current.handleAddObservation());
    expect(result.current.projetosDisciplinas[0].observacoes).toHaveLength(0);

    act(() => result.current.setNewObservation("Aguardando arquitetura"));
    act(() => result.current.handleAddObservation());
    expect(result.current.projetosDisciplinas[0].observacoes).toEqual([
      expect.objectContaining({ texto: "Aguardando arquitetura", usuario: "Dev" }),
    ]);
    expect(result.current.newObservation).toBe("");
  });

  it("remove disciplina da lista", () => {
    const { result } = montar();
    act(() => result.current.setTempDisciplina({ disciplina: "A" }));
    act(() => result.current.addProjetoDisciplina());
    act(() => result.current.setTempDisciplina({ disciplina: "B" }));
    act(() => result.current.addProjetoDisciplina());
    act(() => result.current.removeProjetoDisciplina(0));
    expect(result.current.projetosDisciplinas.map((d) => d.disciplina)).toEqual(["B"]);
  });
});

describe("useProjetoForm: edição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    podeFinanceiro = true;
    rpc.mockResolvedValue({ data: null, error: null });
    bulkSave.mockResolvedValue(undefined);
    updateEq.mockReturnValue(Promise.resolve({ error: null }));
  });

  it("hidrata o formulário com o projeto e não exige cliente para parcelas", async () => {
    const { result, onOpenChange } = montar({
      editProjeto: { ...projetoExistente, cliente_id: "" } as Projeto,
    });
    expect(result.current.isEditMode).toBe(true);
    expect(result.current.formData.nome).toBe("Edifício Aurora");
    expect(result.current.formData.area_m2).toBe("1200");

    preencher(result, { parcelas: "3", dia_pagamento: "10" });
    await act(() => result.current.handleSubmit());

    expect(rpc).toHaveBeenCalledWith(
      "update_projeto_completo",
      expect.objectContaining({ p_projeto_id: "proj-1", p_nome: "Edifício Aurora", p_cliente_id: null })
    );
    expect(bulkSave).toHaveBeenCalledWith({ projetoId: "proj-1", disciplinas: [] });
    expect(toast.success).toHaveBeenCalledWith("Projeto atualizado", expect.anything());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("edição sem localização limpa as coordenadas", async () => {
    const { result } = montar({ editProjeto: projetoExistente });
    await act(() => result.current.handleSubmit());
    expect(from).toHaveBeenCalledWith("projetos");
    expect(updateEq).toHaveBeenCalledWith("id", "proj-1");
  });

  it("apagar o nome na edição bloqueia o salvar", async () => {
    const { result } = montar({ editProjeto: projetoExistente });
    preencher(result, { nome: "" });
    await act(() => result.current.handleSubmit());
    expect(toast.error).toHaveBeenCalledWith("Campo obrigatório", expect.anything());
    expect(rpc).not.toHaveBeenCalled();
  });

  it("erro na edição mantém aberto com os dados", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const { result, onOpenChange } = montar({ editProjeto: projetoExistente });
    preencher(result, { nome: "Novo nome" });
    await act(() => result.current.handleSubmit());
    expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", expect.anything());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(result.current.formData.nome).toBe("Novo nome");
    expect(bulkSave).not.toHaveBeenCalled();
  });
});
