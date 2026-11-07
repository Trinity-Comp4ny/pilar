import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Projeto, ProjetoDisciplinaDB } from "@/types/projetos";
import type { FluxoDisciplinas } from "@/types/fluxoDisciplinas";
import type { TemplateProjeto } from "@/hooks/useTemplates";

// Complementa useProjetoForm.test: endereço salvo (parse/compose), hidratação das
// disciplinas relacionais, template e fluxo, edição dos campos da disciplina no
// detalhe e os desfechos da geocodificação.

const rpc = vi.fn();
const invoke = vi.fn();
const deleteEq = vi.fn();
const updateEq = vi.fn();
const update = vi.fn((_: unknown) => ({ eq: updateEq }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({ delete: () => ({ eq: deleteEq }), update: (p: unknown) => update(p) }),
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
  },
}));
const bulkSave = vi.fn();
vi.mock("@/hooks/useProjetoDisciplinas", () => ({ useBulkSaveDisciplinas: () => ({ mutateAsync: bulkSave }) }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => false }) }));
const lookupCEP = vi.fn();
vi.mock("@/lib/brasilApi", () => ({ lookupCEP: (...a: unknown[]) => lookupCEP(...a) }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { useProjetoForm } from "./useProjetoForm";

const pessoas = [
  { id: "p1", nome: "Ana" },
  { id: "p2", nome: "Bruno" },
];
const SEM: ProjetoDisciplinaDB[] = [];

const fluxo: FluxoDisciplinas = {
  id: "f1",
  empresa_id: "e",
  nome: "Residencial",
  descricao: null,
  ativo: true,
  created_at: "",
  disciplinas: [
    {
      ordem: 1,
      nome: "Arquitetura",
      duracao_dias_uteis: 5,
      responsaveis_ids: ["p1"],
      responsaveis_nomes: ["Ana"],
      checklist_padrao: [{ texto: "Planta" }],
    },
    { ordem: 2, nome: "Estrutural" },
  ],
};
const template = {
  id: "tp1",
  nome: "Casa",
  fases: [{ disciplinas: [{ disciplina: "Civil" }, { disciplina: "Elétrica" }] }],
} as unknown as TemplateProjeto;

function montar(
  opts: { editProjeto?: Projeto | null; existingDisciplinas?: ProjetoDisciplinaDB[]; currentUser?: null } = {}
) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const qc = new QueryClient();
  vi.spyOn(qc, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    () =>
      useProjetoForm({
        open: true,
        onOpenChange,
        editProjeto: opts.editProjeto ?? null,
        existingDisciplinas: opts.existingDisciplinas ?? SEM,
        pessoas,
        templatesData: [template],
        fluxosData: [fluxo],
        currentUser: opts.currentUser === null ? null : { name: "Dev", email: "dev@local.test" },
        onSaved,
      }),
    { wrapper }
  );
  return { ...hook, onOpenChange, onSaved, qc };
}

function preencher(result: { current: ReturnType<typeof useProjetoForm> }, campos: Record<string, string>) {
  for (const [k, v] of Object.entries(campos)) act(() => result.current.handleInputChange(k, v));
}

const projeto = (p: Partial<Projeto> = {}) =>
  ({
    id: "proj-1",
    codigo_projeto: "",
    nome: "Aurora",
    cliente_id: "cli-1",
    localizacao: "01310-100, Av. Paulista, 1000, Bela Vista, São Paulo, SP",
    parcelas: undefined,
    area_m2: undefined,
    data_inicio: undefined,
    data_previsao: undefined,
    data_final: undefined,
    valor_contrato: undefined,
    observacao: undefined,
    status: "Em andamento",
    prioridade: undefined,
    disciplinas: undefined,
    ...p,
  }) as unknown as Projeto;

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  rpc.mockResolvedValue({ data: "novo-id", error: null });
  bulkSave.mockResolvedValue(undefined);
  invoke.mockResolvedValue({ data: { found: false }, error: null });
  updateEq.mockReturnValue(Promise.resolve({ error: null }));
});

describe("useProjetoForm: endereço na edição", () => {
  it("separa CEP e as cinco partes do endereço", () => {
    const { result } = montar({ editProjeto: projeto() });
    expect(result.current.formData).toEqual(
      expect.objectContaining({
        loc_cep: "01310-100",
        loc_logradouro: "Av. Paulista",
        loc_numero: "1000",
        loc_bairro: "Bela Vista",
        loc_cidade: "São Paulo",
        loc_estado: "SP",
        area_m2: "",
        valor_contrato: "",
        prioridade: "Media",
      })
    );
  });

  it("quatro partes sem número; menos que isso vira só logradouro", () => {
    const quatro = montar({ editProjeto: projeto({ localizacao: "Rua A, Centro, Curitiba, PR" }) }).result;
    expect(quatro.current.formData).toEqual(
      expect.objectContaining({ loc_numero: "", loc_bairro: "Centro", loc_cidade: "Curitiba", loc_estado: "PR" })
    );
    const curta = montar({ editProjeto: projeto({ localizacao: "Sítio, Zona rural" }) }).result;
    expect(curta.current.formData).toEqual(
      expect.objectContaining({ loc_cep: "", loc_logradouro: "Sítio, Zona rural", loc_cidade: "" })
    );
    const vazia = montar({ editProjeto: projeto({ localizacao: undefined }) }).result;
    expect(vazia.current.formData.localizacao).toBe("");
  });

  it("hidrata as disciplinas relacionais com os responsáveis", () => {
    const db = [
      {
        id: "d1",
        projeto_id: "proj-1",
        nome: "Civil",
        status: "Em Andamento",
        data_inicio: "2026-01-01",
        data_fim: "2026-02-01",
        data_fim_real: null,
        responsaveis: [{ id: "p1", nome: "Ana" }],
        horas_estimadas: 0,
      },
    ] as unknown as ProjetoDisciplinaDB[];
    const { result } = montar({ editProjeto: projeto(), existingDisciplinas: db });
    expect(result.current.projetosDisciplinas[0]).toEqual(
      expect.objectContaining({ id: "d1", disciplina: "Civil", responsavel_id: "p1" })
    );
  });

  it("legado: sem disciplinas relacionais usa as do projeto (ou nenhuma)", () => {
    const { result } = montar({
      editProjeto: projeto({ disciplinas: [{ disciplina: "Antiga", responsavel_id: "", responsavel_nome: "" }] }),
    });
    expect(result.current.projetosDisciplinas.map((d) => d.disciplina)).toEqual(["Antiga"]);
  });

  it("salvar a edição com endereço grava as coordenadas no projeto editado e envia campos opcionais nulos", async () => {
    invoke.mockResolvedValueOnce({ data: { found: true, lat: -23.5, lng: -46.6 }, error: null });
    const db = [
      {
        id: "d1",
        projeto_id: "proj-1",
        nome: "Civil",
        status: "",
        data_inicio: null,
        data_fim: null,
        data_fim_real: null,
        prioridade: null,
        responsaveis: [],
        ordem_etapa: 2,
        horas_estimadas: 0,
      },
    ] as unknown as ProjetoDisciplinaDB[];
    const { result, onSaved, qc } = montar({ editProjeto: projeto({ cliente_id: "" }), existingDisciplinas: db });
    await act(() => result.current.handleSubmit());
    await act(async () => {});
    expect(rpc).toHaveBeenCalledWith(
      "update_projeto_completo",
      expect.objectContaining({
        p_codigo: null,
        p_cliente_id: null,
        p_valor_contrato: null,
        p_localizacao: "01310-100, Av. Paulista, 1000, Bela Vista, São Paulo, SP",
        p_area_m2: 0,
      })
    );
    expect(bulkSave).toHaveBeenCalledWith({
      projetoId: "proj-1",
      disciplinas: [
        expect.objectContaining({
          id: "d1",
          status: "Não Iniciado",
          data_inicio: null,
          prioridade: null,
          ordem_etapa: 2,
          responsavel_ids: [],
        }),
      ],
    });
    expect(invoke).toHaveBeenCalledWith(
      "geocode-address",
      expect.objectContaining({
        body: expect.objectContaining({ street: "Av. Paulista 1000", postalcode: "01310-100" }),
      })
    );
    expect(update).toHaveBeenCalledWith({ latitude: -23.5, longitude: -46.6 });
    expect(updateEq).toHaveBeenCalledWith("id", "proj-1");
    expect(onSaved).toHaveBeenCalledTimes(2);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["projetos-mapa"] });
  });
});

describe("useProjetoForm: geocodificação", () => {
  async function salvarComEndereco() {
    const r = montar();
    preencher(r.result, { nome: "P", loc_logradouro: "Rua X", loc_cidade: "Curitiba" });
    await act(() => r.result.current.handleSubmit());
    await act(async () => {});
    return r;
  }

  it("serviço de mapas fora do ar avisa para salvar de novo", async () => {
    invoke.mockResolvedValueOnce({ data: { indisponivel: true }, error: null });
    await salvarComEndereco();
    expect(toast.warning).toHaveBeenCalledWith("Mapa indisponível agora", expect.anything());
  });

  it("endereço não encontrado (ou coordenada inválida) avisa", async () => {
    invoke.mockResolvedValueOnce({ data: { found: true, lat: "x", lng: 1 }, error: null });
    await salvarComEndereco();
    expect(toast.warning).toHaveBeenCalledWith("Endereço não localizado", expect.anything());
    expect(update).not.toHaveBeenCalled();
  });

  it("exceção na chamada avisa geocodificação falhou", async () => {
    invoke.mockRejectedValueOnce(new Error("rede"));
    await salvarComEndereco();
    expect(toast.warning).toHaveBeenCalledWith("Geocodificação falhou", expect.anything());
  });

  it("projeto criado sem id não grava coordenadas", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    invoke.mockResolvedValueOnce({ data: { found: true, lat: 1, lng: 2 }, error: null });
    await salvarComEndereco();
    expect(update).not.toHaveBeenCalled();
  });

  it("um segundo salvar aborta a geocodificação anterior (resultado e erro dela são ignorados)", async () => {
    let resolverPrimeira: (v: unknown) => void = () => {};
    let rejeitarSegunda: (e: unknown) => void = () => {};
    invoke
      .mockReturnValueOnce(new Promise((r) => (resolverPrimeira = r)))
      .mockReturnValueOnce(new Promise((_, rej) => (rejeitarSegunda = rej)))
      .mockReturnValueOnce(new Promise(() => {}));
    const { result } = montar({ editProjeto: projeto() });
    await act(() => result.current.handleSubmit());
    await act(() => result.current.handleSubmit());
    await act(async () => resolverPrimeira({ data: { found: true, lat: 1, lng: 2 }, error: null }));
    expect(update).not.toHaveBeenCalled();
    await act(() => result.current.handleSubmit());
    await act(async () => rejeitarSegunda(new Error("tarde")));
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it("resultado positivo que chega depois do abort não grava", async () => {
    let resolver: (v: unknown) => void = () => {};
    invoke.mockReturnValueOnce(new Promise((r) => (resolver = r))).mockReturnValueOnce(new Promise(() => {}));
    const { result } = montar({ editProjeto: projeto() });
    await act(() => result.current.handleSubmit());
    await act(() => result.current.handleSubmit());
    await act(async () => resolver({ data: null, error: new Error("x") }));
    expect(toast.warning).not.toHaveBeenCalled();
  });
});

describe("useProjetoForm: template, fluxo e detalhe da disciplina", () => {
  it("template inexistente não faz nada; existente troca as disciplinas", () => {
    const { result } = montar();
    act(() => result.current.applyTemplate("nao-existe"));
    expect(toast.success).not.toHaveBeenCalled();
    act(() => result.current.applyTemplate("tp1"));
    expect(result.current.projetosDisciplinas.map((d) => d.disciplina)).toEqual(["Civil", "Elétrica"]);
    expect(toast.success).toHaveBeenCalledWith("Template aplicado", {
      description: '2 disciplina(s) adicionadas de "Casa"',
    });
  });

  it("fluxo aplica com datas a partir do início, responsáveis e coluna; null limpa; inexistente ignora", () => {
    const { result } = montar();
    preencher(result, { data_inicio: "2026-03-02" });
    act(() => result.current.applyFluxo("f1"));
    const [arq, est] = result.current.projetosDisciplinas;
    expect(arq).toEqual(
      expect.objectContaining({ disciplina: "Arquitetura", etapa: 1, responsavel_id: "p1", data_inicio: "2026-03-02" })
    );
    expect(arq.responsaveis).toEqual([expect.objectContaining({ responsavel_id: "p1", responsavel_nome: "Ana" })]);
    expect(est).toEqual(expect.objectContaining({ etapa: 2, responsavel_id: "", responsaveis: [] }));
    expect(toast.success).toHaveBeenCalledWith("Fluxo aplicado", {
      description: '2 disciplina(s) em 2 coluna(s) de "Residencial"',
    });

    act(() => result.current.applyFluxo("nao-existe"));
    expect(result.current.projetosDisciplinas).toHaveLength(2);
    act(() => result.current.applyFluxo(null));
    expect(result.current.projetosDisciplinas).toHaveLength(0);
  });

  it("detalhe: muda campo e responsáveis; sem disciplina selecionada não faz nada", () => {
    const { result } = montar({ currentUser: null });
    act(() => result.current.setTempDisciplina({ disciplina: "Civil" }));
    act(() => result.current.addProjetoDisciplina());
    const antes = result.current.projetosDisciplinas;
    act(() => result.current.updateDisciplinaField("status", "Em Andamento"));
    act(() => result.current.updateDisciplinaResponsaveis(["p1"]));
    act(() => result.current.handleAddObservation());
    expect(result.current.projetosDisciplinas).toBe(antes);

    act(() => result.current.handleOpenDisciplinaDetail(0));
    expect(result.current.isDisciplinaDetailOpen).toBe(true);
    act(() => result.current.updateDisciplinaField("status", "Em Andamento"));
    expect(result.current.projetosDisciplinas[0].status).toBe("Em Andamento");
    act(() => result.current.updateDisciplinaResponsaveis(["p2", "x"]));
    expect(result.current.projetosDisciplinas[0]).toEqual(
      expect.objectContaining({
        responsavel_id: "p2",
        responsavel_nome: "Bruno",
        responsaveis: [
          { responsavel_id: "p2", responsavel_nome: "Bruno" },
          { responsavel_id: "x", responsavel_nome: "" },
        ],
      })
    );
    act(() => result.current.updateDisciplinaResponsaveis([]));
    expect(result.current.projetosDisciplinas[0].responsavel_id).toBe("");

    // Sem usuário logado, a observação sai como "Usuário".
    act(() => result.current.setNewObservation("Nota"));
    act(() => result.current.handleAddObservation());
    expect(result.current.projetosDisciplinas[0].observacoes).toEqual([
      expect.objectContaining({ texto: "Nota", usuario: "Usuário" }),
    ]);
  });

  it("datas sem responsável vão para a disciplina; depois o responsável substitui o marcador", () => {
    const { result } = montar();
    act(() => result.current.setTempDisciplina({ disciplina: "Civil", data_inicio: "2026-01-01" }));
    act(() => result.current.addProjetoDisciplina());
    act(() =>
      result.current.setNewFormResp({
        responsavel_id: "",
        data_inicio: "",
        data_previsao: "2026-02-01",
        data_final: "",
      })
    );
    act(() => result.current.addResponsavelToDisc(0));
    expect(result.current.projetosDisciplinas[0]).toEqual(
      expect.objectContaining({ data_inicio: "2026-01-01", data_previsao: "2026-02-01" })
    );

    act(() =>
      result.current.setNewFormResp({
        responsavel_id: "p1",
        data_inicio: "2026-01-05",
        data_previsao: "",
        data_final: "2026-03-01",
      })
    );
    act(() => result.current.addResponsavelToDisc(0));
    expect(result.current.projetosDisciplinas[0].responsaveis).toEqual([
      expect.objectContaining({ responsavel_id: "p1", data_inicio: "2026-01-05", data_previsao: undefined }),
    ]);

    // Data por responsável: só o primeiro espelha no topo da disciplina.
    act(() => result.current.updateRespDatasInForm(0, 0, "data_final", "2026-04-01"));
    expect(result.current.projetosDisciplinas[0].data_final).toBe("2026-04-01");
    act(() => result.current.updateRespDatasInForm(0, 0, "status", "Concluído"));
    expect(result.current.projetosDisciplinas[0].responsaveis?.[0].status).toBe("Concluído");
  });

  it("disciplina pendente com responsável entra sozinha no salvar com o nome da pessoa", async () => {
    const { result } = montar();
    preencher(result, { nome: "P" });
    act(() =>
      result.current.setTempDisciplina({ disciplina: "Civil", responsavel_id: "p1", status: "", prioridade: undefined })
    );
    await act(() => result.current.handleSubmit());
    expect(bulkSave).toHaveBeenCalledWith({
      projetoId: "novo-id",
      disciplinas: [expect.objectContaining({ nome: "Civil", status: "Não Iniciado", responsavel_ids: ["p1"] })],
    });
  });

  it("valida datas de disciplina sem responsável pelas datas da própria disciplina", async () => {
    const { result } = montar();
    preencher(result, { nome: "P", data_inicio: "2026-03-01" });
    act(() => result.current.setTempDisciplina({ disciplina: "Civil", data_inicio: "" }));
    act(() => result.current.addProjetoDisciplina());
    await act(() => result.current.handleSubmit());
    expect(rpc).toHaveBeenCalled();
  });
});
