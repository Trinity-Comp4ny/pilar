import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { RdoRow } from "@/pages/obras/hooks/useObraRdo";

// Seções do RDO com dado: tarefas do cronograma (marcar, resultado, criar na hora),
// equipes, impedimentos, visitas e fotos já gravadas; edição de um dia existente
// reidrata tudo e salva pelo update.

const m = vi.hoisted(() => ({
  criar: vi.fn(),
  atualizar: vi.fn(),
  salvarTarefas: vi.fn(),
  salvarEfetivo: vi.fn(),
  salvarImpedimentos: vi.fn(),
  salvarVisitas: vi.fn(),
  criarTarefa: vi.fn(),
  uploadFoto: vi.fn(),
  deleteFoto: vi.fn(),
  vincular: vi.fn(),
  buscarClima: vi.fn(),
  track: vi.fn(),
  obra: { latitude: null as number | null, longitude: null as number | null },
}));
const d = vi.hoisted(() => ({
  tarefas: [] as unknown[],
  frentes: [] as unknown[],
  vinculos: [] as unknown[],
  fornecedores: [] as unknown[],
  efetivo: [] as unknown[],
  impedimentos: [] as unknown[],
  visitas: [] as unknown[],
  fotos: {} as Record<string, unknown[]>,
}));
const mut = (fn: ReturnType<typeof vi.fn>) => ({ mutateAsync: fn, isPending: false });

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { empresa_id: "emp-1" } }) }));
vi.mock("@/pages/obras/hooks/useObraRdo", () => ({
  useCreateRdo: () => mut(m.criar),
  useUpdateRdo: () => mut(m.atualizar),
}));
vi.mock("@/pages/obras/hooks/useObraTarefas", () => ({
  useObraTarefas: () => ({ data: d.tarefas }),
  useCreateObraTarefa: () => mut(m.criarTarefa),
}));
vi.mock("@/pages/obras/hooks/useObraFrentes", () => ({ useObraFrentes: () => ({ data: d.frentes }) }));
vi.mock("@/pages/obras/hooks/useObraRdoTarefas", () => ({
  useObraRdoTarefas: () => ({ data: d.vinculos }),
  useSaveRdoTarefas: () => mut(m.salvarTarefas),
}));
vi.mock("@/hooks/useFornecedorDetalhe", () => ({ useFornecedoresLite: () => ({ data: d.fornecedores }) }));
vi.mock("@/pages/obras/hooks/useObraRdoEfetivo", () => ({
  useObraRdoEfetivo: () => ({ data: d.efetivo }),
  useSaveRdoEfetivo: () => mut(m.salvarEfetivo),
}));
vi.mock("@/pages/obras/hooks/useObraRdoImpedimentos", () => ({
  useObraRdoImpedimentos: () => ({ data: d.impedimentos }),
  useSaveRdoImpedimentos: () => mut(m.salvarImpedimentos),
}));
vi.mock("@/pages/obras/hooks/useObraRdoVisitas", () => ({
  useObraRdoVisitas: () => ({ data: d.visitas }),
  useSaveRdoVisitas: () => mut(m.salvarVisitas),
}));
vi.mock("@/pages/obras/hooks/useObraFotos", () => ({
  MAX_FOTO_RDO_BYTES: 8 * 1024 * 1024,
  MIME_FOTO_RDO: ["image/jpeg", "image/png", "image/webp"],
  useDeleteRdoFoto: () => mut(m.deleteFoto),
  useObraFotos: () => ({ data: d.fotos }),
  useUploadRdoFoto: () => mut(m.uploadFoto),
}));
vi.mock("@/pages/obras/hooks/useObras", () => ({ useObra: () => ({ data: m.obra }) }));
vi.mock("@/pages/obras/hooks/useObraRegistros", () => ({ useVincularRegistrosRdo: () => mut(m.vincular) }));
vi.mock("@/pages/obras/lib/clima", () => ({ buscarClimaDoDia: (...a: unknown[]) => m.buscarClima(...a) }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: (...a: unknown[]) => m.track(...a) } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { RdoFormDialog } from "./RdoFormDialog";

// O Checkbox (Radix) mede o próprio tamanho com ResizeObserver; o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

let previews = 0;
globalThis.URL.createObjectURL = () => `blob:preview-${++previews}`;
globalThis.URL.revokeObjectURL = () => {};

const rdo = {
  id: "rdo-1",
  obra_id: "obra-1",
  data: "2026-11-02",
  clima: "nublado",
  condicao_trabalho: "parcial",
  efetivo: null,
  atividades: null,
  ocorrencias: null,
  pendencias: null,
} as unknown as RdoRow;

function montar(props: Partial<React.ComponentProps<typeof RdoFormDialog>> = {}) {
  const onOpenChange = vi.fn();
  render(<RdoFormDialog open onOpenChange={onOpenChange} obraId="obra-1" rdos={[]} {...props} />);
  return { onOpenChange };
}
const secao = (titulo: string) => screen.getByText(titulo).closest(".rounded-xl") as HTMLElement;
function escolher(gatilho: HTMLElement, opcao: string | RegExp) {
  fireEvent.keyDown(gatilho, { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
}
const salvar = () => fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

beforeEach(() => {
  vi.clearAllMocks();
  m.obra = { latitude: null, longitude: null };
  m.criar.mockResolvedValue({ id: "rdo-novo" });
  m.atualizar.mockResolvedValue({ id: "rdo-1" });
  for (const f of [m.salvarTarefas, m.salvarEfetivo, m.salvarImpedimentos, m.salvarVisitas, m.uploadFoto, m.vincular]) {
    f.mockResolvedValue(undefined);
  }
  m.deleteFoto.mockResolvedValue(undefined);
  m.buscarClima.mockResolvedValue(null);
  d.tarefas = [
    { id: "t1", titulo: "Alvenaria bloco 2", obra_frente_id: "s1" },
    { id: "t2", titulo: "Limpeza", obra_frente_id: null },
    { id: "t3", titulo: "Órfã", obra_frente_id: "sumiu" },
  ];
  d.frentes = [
    { id: "e1", parent_id: null, nome: "Estrutura", nivel: "etapa" },
    { id: "s1", parent_id: "e1", nome: "Alvenaria", nivel: "servico" },
    { id: "s2", parent_id: null, nome: "Solto", nivel: "servico" },
  ];
  d.vinculos = [];
  d.fornecedores = [
    { id: "f1", nome: "Gesso Forte", cnpj: "12.345" },
    { id: "f2", nome: "Elétrica Luz", cnpj: null },
  ];
  d.efetivo = [];
  d.impedimentos = [];
  d.visitas = [];
  d.fotos = {};
});

describe("RdoFormDialog: tarefas do cronograma", () => {
  it("mostra o caminho do serviço, marca tarefa, troca resultado e observação, desmarca outra", async () => {
    montar();
    expect(screen.getAllByText("Estrutura › Alvenaria").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("checkbox", { name: /Alvenaria bloco 2/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Limpeza/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Limpeza/ }));

    const tarefaSec = secao("Tarefas do cronograma");
    const [resultado] = within(tarefaSec).getAllByRole("combobox");
    escolher(resultado, "Concluiu");
    fireEvent.change(within(tarefaSec).getByPlaceholderText("O que foi feito (opcional)"), {
      target: { value: "Fechou o pano" },
    });

    salvar();
    await waitFor(() =>
      expect(m.salvarTarefas).toHaveBeenCalledWith({
        rdoId: "rdo-novo",
        obraId: "obra-1",
        entradas: [{ tarefa_id: "t1", resultado: "concluiu", observacao: "Fechou o pano" }],
      })
    );
  });

  it("cria tarefa na hora com serviço (Enter) e já marca; título vazio não cria", async () => {
    m.criarTarefa.mockResolvedValue({ id: "t-nova" });
    montar();
    const campo = screen.getByPlaceholderText("Nova tarefa (ex: concretar laje)");
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(m.criarTarefa).not.toHaveBeenCalled();

    const tarefaSec = secao("Tarefas do cronograma");
    const servico = within(tarefaSec).getAllByRole("combobox").at(-1)!;
    escolher(servico, "Estrutura › Alvenaria");
    fireEvent.change(campo, { target: { value: "  Concretar laje " } });
    await act(async () => {
      fireEvent.keyDown(campo, { key: "Enter" });
    });
    expect(m.criarTarefa).toHaveBeenCalledWith({ titulo: "Concretar laje", obra_frente_id: "s1" });
    expect(campo).toHaveValue("");

    salvar();
    await waitFor(() =>
      expect(m.salvarTarefas).toHaveBeenCalledWith(
        expect.objectContaining({ entradas: [{ tarefa_id: "t-nova", resultado: "avancou", observacao: "" }] })
      )
    );
  });

  it("criar tarefa pelo botão, sem serviço; falha avisa com a mensagem ou texto genérico", async () => {
    m.criarTarefa.mockRejectedValueOnce(new Error("sem permissão")).mockRejectedValueOnce("x");
    d.tarefas = [];
    montar();
    expect(screen.getByText(/Nenhuma tarefa no cronograma ainda/)).toBeInTheDocument();
    const tarefaSec = secao("Tarefas do cronograma");
    const servico = within(tarefaSec).getByRole("combobox");
    escolher(servico, "Solto");
    escolher(servico, "Sem serviço");
    fireEvent.change(screen.getByPlaceholderText("Nova tarefa (ex: concretar laje)"), { target: { value: "Pintar" } });
    const botao = within(tarefaSec).getAllByRole("button").at(-1)!;
    await act(async () => fireEvent.click(botao));
    expect(m.criarTarefa).toHaveBeenCalledWith({ titulo: "Pintar", obra_frente_id: null });
    expect(toast.error).toHaveBeenCalledWith("Não foi possível criar a tarefa", { description: "sem permissão" });
    await act(async () => fireEvent.click(botao));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível criar a tarefa", { description: "Tente novamente" });
  });
});

describe("RdoFormDialog: equipes, impedimentos e visitas", () => {
  it("equipe só entra completa; soma trava o total; remove linha", async () => {
    montar();
    const sec = secao("Equipes no canteiro");
    const [fornecedor] = within(sec).getAllByRole("combobox");
    const qtd = within(sec).getByPlaceholderText("Qtd");
    const add = within(sec).getAllByRole("button").at(-1)!;

    // Quantidade inválida não entra.
    escolher(fornecedor, "Gesso Forte · 12.345");
    fireEvent.change(qtd, { target: { value: "0" } });
    fireEvent.click(add);
    expect(within(sec).queryByText(/Gesso Forte: /)).not.toBeInTheDocument();

    fireEvent.change(qtd, { target: { value: "3" } });
    fireEvent.click(add);
    expect(within(sec).getByText("Gesso Forte: 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Total de pessoas na obra")).toBeDisabled();
    expect(screen.getByText("Somado a partir das equipes abaixo.")).toBeInTheDocument();

    // "Outro" exige nome.
    escolher(fornecedor, "Outro (digitar nome)");
    fireEvent.change(qtd, { target: { value: "2" } });
    fireEvent.click(add);
    expect(within(sec).queryByText(/: 2$/)).not.toBeInTheDocument();
    fireEvent.change(within(sec).getByPlaceholderText("Nome do prestador"), { target: { value: " Zé Pedreiro " } });
    fireEvent.click(add);
    expect(within(sec).getByText("Zé Pedreiro: 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Total de pessoas na obra")).toHaveValue(5);

    // Voltar ao "Selecione" bloqueia o botão.
    escolher(fornecedor, "Selecione");
    expect(add).toBeDisabled();

    // Remove a primeira linha.
    fireEvent.click(within(within(sec).getByText("Gesso Forte: 3").closest("div")!).getByRole("button"));
    expect(within(sec).queryByText("Gesso Forte: 3")).not.toBeInTheDocument();

    salvar();
    await waitFor(() =>
      expect(m.salvarEfetivo).toHaveBeenCalledWith({
        rdoId: "rdo-novo",
        obraId: "obra-1",
        entradas: [{ fornecedor_id: null, fornecedor_nome: "Zé Pedreiro", quantidade: 2 }],
      })
    );
    expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({ efetivo: 2 }));
  });

  it("impedimento com tipo escolhido entra pelo botão e sai pela lixeira", () => {
    montar();
    const sec = secao("Impedimentos");
    escolher(within(sec).getByRole("combobox"), "Clima");
    fireEvent.change(within(sec).getByPlaceholderText("O que travou (ex: falta de cimento)"), {
      target: { value: "Chuva" },
    });
    fireEvent.click(within(sec).getAllByRole("button").at(-1)!);
    expect(within(sec).getByText("Clima:")).toBeInTheDocument();
    fireEvent.click(within(within(sec).getByText("Clima:").closest("div")!).getByRole("button"));
    expect(within(sec).queryByText("Clima:")).not.toBeInTheDocument();
  });

  it("visita por fornecedor (com motivo) e por nome livre; Outro sem nome não entra", async () => {
    montar();
    const sec = secao("Visitas");
    const visitante = within(sec).getByRole("combobox");
    const add = within(sec).getAllByRole("button").at(-1)!;
    expect(add).toBeDisabled();

    escolher(visitante, "Elétrica Luz");
    fireEvent.change(within(sec).getByPlaceholderText("Motivo (opcional)"), { target: { value: " Vistoria " } });
    fireEvent.click(add);
    expect(within(sec).getByText(/— Vistoria/)).toBeInTheDocument();

    escolher(visitante, "Outro (digitar nome)");
    fireEvent.click(add);
    expect(within(sec).getAllByRole("button")).toHaveLength(2);
    fireEvent.change(within(sec).getByPlaceholderText("Nome do visitante"), { target: { value: "Fiscal" } });
    fireEvent.click(add);
    expect(within(sec).getByText("Fiscal")).toBeInTheDocument();

    fireEvent.click(within(within(sec).getByText("Fiscal").closest("div")!).getByRole("button"));
    expect(within(sec).queryByText("Fiscal")).not.toBeInTheDocument();

    salvar();
    await waitFor(() =>
      expect(m.salvarVisitas).toHaveBeenCalledWith({
        rdoId: "rdo-novo",
        obraId: "obra-1",
        entradas: [{ fornecedor_id: "f2", fornecedor_nome: null, observacao: "Vistoria" }],
      })
    );
  });
});

describe("RdoFormDialog: editar dia existente", () => {
  beforeEach(() => {
    d.vinculos = [
      { rdo_id: "rdo-1", tarefa_id: "t1", resultado: "parou", observacao: null },
      { rdo_id: "outro", tarefa_id: "t2", resultado: "avancou", observacao: "x" },
    ];
    d.efetivo = [
      { rdo_id: "rdo-1", fornecedor_id: "f1", fornecedor_nome: null, quantidade: 4 },
      { rdo_id: "rdo-1", fornecedor_id: "fx", fornecedor_nome: "Antiga", quantidade: 1 },
      { rdo_id: "rdo-1", fornecedor_id: null, fornecedor_nome: null, quantidade: 2 },
      { rdo_id: "outro", fornecedor_id: "f2", fornecedor_nome: null, quantidade: 9 },
    ];
    d.impedimentos = [{ rdo_id: "rdo-1", descricao: "Sem projeto", tipo: "pendencia_projeto" }];
    d.visitas = [{ rdo_id: "rdo-1", fornecedor_id: null, fornecedor_nome: "Cliente", observacao: null }];
    d.fotos = { "rdo-1": [{ id: "foto-1", url: "https://x/1.jpg", path: "p/1.jpg" }] };
  });

  it("reidrata tarefas, equipes, impedimentos, visitas e fotos, e salva pelo update", async () => {
    const { onOpenChange } = montar({ rdoInicial: rdo, rdos: [rdo] });
    expect(screen.getByText("Editar dia")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Alvenaria bloco 2/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /Limpeza/ })).not.toBeChecked();
    expect(screen.getByText("Gesso Forte: 4")).toBeInTheDocument();
    expect(screen.getByText("Antiga: 1")).toBeInTheDocument();
    expect(screen.getByText("Sem nome: 2")).toBeInTheDocument();
    expect(screen.getByText("Pendência de projeto:")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Foto da obra" })).toBeInTheDocument();

    salvar();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(m.atualizar).toHaveBeenCalledWith(
      expect.objectContaining({ id: "rdo-1", clima: "nublado", condicao_trabalho: "parcial", efetivo: 7 })
    );
    expect(m.salvarTarefas).toHaveBeenCalledWith(
      expect.objectContaining({ entradas: [{ tarefa_id: "t1", resultado: "parou", observacao: "" }] })
    );
    expect(m.track).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Registro atualizado");
  });

  it("remover foto já gravada chama a exclusão; falha avisa", async () => {
    m.deleteFoto.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("rls"));
    montar({ rdoInicial: rdo, rdos: [rdo] });
    const remover = () =>
      within(screen.getByRole("img", { name: "Foto da obra" }).parentElement!).getByRole("button", {
        name: "Remover foto",
      });
    await act(async () => fireEvent.click(remover()));
    expect(m.deleteFoto).toHaveBeenCalledWith({ id: "foto-1", path: "p/1.jpg" });
    expect(toast.error).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(remover()));
    expect(toast.error).toHaveBeenCalledWith("Não foi possível remover a foto");
  });
});

describe("RdoFormDialog: clima, condição, fotos novas e cancelar", () => {
  it("clima e condição escolhidos à mão vão no payload e apagam a dica automática", async () => {
    m.obra = { latitude: -22, longitude: -47 };
    m.buscarClima.mockResolvedValue("chuvoso");
    montar();
    expect(await screen.findByText("Sugerido pela previsão do tempo.")).toBeInTheDocument();
    escolher(screen.getByRole("combobox", { name: "Clima" }), "Chuva forte");
    expect(screen.queryByText("Sugerido pela previsão do tempo.")).not.toBeInTheDocument();
    escolher(screen.getByRole("combobox", { name: "Condição de trabalho" }), "Obra paralisada");
    salvar();
    await waitFor(() =>
      expect(m.criar).toHaveBeenCalledWith(
        expect.objectContaining({ clima: "chuva_forte", condicao_trabalho: "paralisada" })
      )
    );
  });

  it("clima já escolhido no registro não é sobrescrito pela previsão", async () => {
    m.obra = { latitude: -22, longitude: -47 };
    m.buscarClima.mockResolvedValue("chuvoso");
    montar({ rdoInicial: rdo, rdos: [rdo] });
    await act(async () => {});
    expect(m.buscarClima).not.toHaveBeenCalled();
  });

  it("previsão resolvida depois de o usuário escolher o clima não sobrescreve", async () => {
    m.obra = { latitude: -22, longitude: -47 };
    let resolver: (v: string) => void = () => {};
    m.buscarClima.mockReturnValue(new Promise((r) => (resolver = r)));
    montar();
    escolher(screen.getByRole("combobox", { name: "Clima" }), "Ensolarado");
    await act(async () => resolver("chuvoso"));
    expect(screen.queryByText("Sugerido pela previsão do tempo.")).not.toBeInTheDocument();
  });

  it("foto nova pode ser removida antes de salvar", () => {
    montar();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [new File(["x"], "a.png", { type: "image/png" })],
      configurable: true,
    });
    fireEvent.change(input);
    fireEvent.click(screen.getByRole("button", { name: "Remover foto" }));
    expect(screen.queryByRole("button", { name: "Remover foto" })).not.toBeInTheDocument();
    // Clique no atalho de foto abre o seletor (não quebra sem arquivo).
    fireEvent.click(screen.getByText("Foto").closest("button")!);
  });

  it("trocar para uma data sem registro sai do modo edição", async () => {
    const outro = { ...rdo, id: "rdo-2", data: "2026-11-01" } as RdoRow;
    montar({ rdos: [outro] });
    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-11-01" } });
    expect(await screen.findByText("Editar dia")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Data *"), { target: { value: "2026-10-30" } });
    expect(await screen.findByText("Registrar dia")).toBeInTheDocument();
  });

  it("erro não-Error ao salvar usa o texto genérico", async () => {
    m.criar.mockRejectedValueOnce("falhou");
    montar();
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "Tente novamente" })
    );
  });

  it("Cancelar fecha o diálogo", () => {
    const { onOpenChange } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
