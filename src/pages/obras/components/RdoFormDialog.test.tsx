import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RdoRow } from "@/pages/obras/hooks/useObraRdo";

// Diário de obra (RDO): data obrigatória e nunca no futuro, um registro por dia,
// impedimento/visita/efetivo só entram completos, fotos validadas por tipo e tamanho,
// e erro do servidor sem fechar o diálogo.

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
  empresaId: "emp-1" as string | null,
}));
// Listas estáveis: o diálogo reidrata efetivo/impedimentos/visitas quando a lista muda de identidade.
const VAZIO = vi.hoisted(() => ({ lista: [] as never[], mapa: {} }));
const mut = (fn: ReturnType<typeof vi.fn>) => ({ mutateAsync: fn, isPending: false });

vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ profile: { empresa_id: m.empresaId } }) }));
vi.mock("@/pages/obras/hooks/useObraRdo", () => ({
  useCreateRdo: () => mut(m.criar),
  useUpdateRdo: () => mut(m.atualizar),
}));
vi.mock("@/pages/obras/hooks/useObraTarefas", () => ({
  useObraTarefas: () => ({ data: VAZIO.lista }),
  useCreateObraTarefa: () => mut(m.criarTarefa),
}));
vi.mock("@/pages/obras/hooks/useObraFrentes", () => ({ useObraFrentes: () => ({ data: VAZIO.lista }) }));
vi.mock("@/pages/obras/hooks/useObraRdoTarefas", () => ({
  useObraRdoTarefas: () => ({ data: VAZIO.lista }),
  useSaveRdoTarefas: () => mut(m.salvarTarefas),
}));
vi.mock("@/hooks/useFornecedorDetalhe", () => ({ useFornecedoresLite: () => ({ data: VAZIO.lista }) }));
vi.mock("@/pages/obras/hooks/useObraRdoEfetivo", () => ({
  useObraRdoEfetivo: () => ({ data: VAZIO.lista }),
  useSaveRdoEfetivo: () => mut(m.salvarEfetivo),
}));
vi.mock("@/pages/obras/hooks/useObraRdoImpedimentos", () => ({
  useObraRdoImpedimentos: () => ({ data: VAZIO.lista }),
  useSaveRdoImpedimentos: () => mut(m.salvarImpedimentos),
}));
vi.mock("@/pages/obras/hooks/useObraRdoVisitas", () => ({
  useObraRdoVisitas: () => ({ data: VAZIO.lista }),
  useSaveRdoVisitas: () => mut(m.salvarVisitas),
}));
vi.mock("@/pages/obras/hooks/useObraFotos", () => ({
  MAX_FOTO_RDO_BYTES: 8 * 1024 * 1024,
  MIME_FOTO_RDO: ["image/jpeg", "image/png", "image/webp"],
  useDeleteRdoFoto: () => mut(m.deleteFoto),
  useObraFotos: () => ({ data: VAZIO.mapa }),
  useUploadRdoFoto: () => mut(m.uploadFoto),
}));
vi.mock("@/pages/obras/hooks/useObras", () => ({ useObra: () => ({ data: m.obra }) }));
vi.mock("@/pages/obras/hooks/useObraRegistros", () => ({ useVincularRegistrosRdo: () => mut(m.vincular) }));
vi.mock("@/pages/obras/lib/clima", () => ({ buscarClimaDoDia: (...a: unknown[]) => m.buscarClima(...a) }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: (...a: unknown[]) => m.track(...a) } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { RdoFormDialog } from "./RdoFormDialog";
import { hoje } from "@/pages/obras/lib/rdoForm";

// O createObjectURL do ambiente de teste não aceita o File do jsdom: o preview vira um id fixo.
let previews = 0;
globalThis.URL.createObjectURL = () => `blob:preview-${++previews}`;
globalThis.URL.revokeObjectURL = () => {};

const rdoExistente = {
  id: "rdo-ontem",
  obra_id: "obra-1",
  data: "2026-11-05",
  clima: "chuvoso",
  condicao_trabalho: null,
  efetivo: 7,
  atividades: "Forma da laje",
  ocorrencias: null,
  pendencias: null,
} as unknown as RdoRow;

function montar(props: Partial<React.ComponentProps<typeof RdoFormDialog>> = {}) {
  const onOpenChange = vi.fn();
  render(<RdoFormDialog open onOpenChange={onOpenChange} obraId="obra-1" rdos={[]} {...props} />);
  return { onOpenChange };
}
function anexar(arquivos: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, "files", { value: arquivos, configurable: true });
  fireEvent.change(input);
}
const salvar = () => fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
const digitar = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

describe("RdoFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.empresaId = "emp-1";
    m.obra = { latitude: null, longitude: null };
    m.criar.mockResolvedValue({ id: "rdo-novo" });
    m.atualizar.mockResolvedValue({ id: "rdo-ontem" });
    for (const f of [
      m.salvarTarefas,
      m.salvarEfetivo,
      m.salvarImpedimentos,
      m.salvarVisitas,
      m.uploadFoto,
      m.vincular,
    ]) {
      f.mockResolvedValue(undefined);
    }
    m.buscarClima.mockResolvedValue(null);
  });

  it("caminho feliz: só a data (hoje) registra o dia com campos vazios nulos", async () => {
    const { onOpenChange } = montar();
    salvar();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(m.criar).toHaveBeenCalledWith({
      obra_id: "obra-1",
      data: hoje(),
      clima: null,
      condicao_trabalho: null,
      efetivo: null,
      atividades: null,
      ocorrencias: null,
      pendencias: null,
    });
    expect(m.salvarEfetivo).toHaveBeenCalledWith({ rdoId: "rdo-novo", obraId: "obra-1", entradas: [] });
    expect(toast.success).toHaveBeenCalledWith("Dia registrado");
    expect(m.track).toHaveBeenCalledWith("rdo_registrado", { fotos: 0 });
  });

  it("sem data mostra o erro e não grava", async () => {
    montar();
    digitar("Data *", "");
    salvar();
    expect(await screen.findByText("Escolha a data")).toBeInTheDocument();
    expect(m.criar).not.toHaveBeenCalled();
  });

  it("data no futuro é barrada pelo campo", async () => {
    montar();
    digitar("Data *", "2999-12-31");
    salvar();
    await act(async () => {});
    expect(screen.getByLabelText("Data *")).toBeInvalid();
    expect(m.criar).not.toHaveBeenCalled();
  });

  it("efetivo negativo é barrado pelo campo", async () => {
    montar();
    digitar("Total de pessoas na obra", "-3");
    salvar();
    await act(async () => {});
    expect(screen.getByLabelText("Total de pessoas na obra")).toBeInvalid();
    expect(m.criar).not.toHaveBeenCalled();
  });

  it("efetivo e textos digitados chegam aparados", async () => {
    montar();
    digitar("Total de pessoas na obra", "12");
    digitar("Observações do dia", "  Concretagem do 2º pavimento  ");
    digitar("Pendências", "   ");
    salvar();
    await waitFor(() =>
      expect(m.criar).toHaveBeenCalledWith(
        expect.objectContaining({ efetivo: 12, atividades: "Concretagem do 2º pavimento", pendencias: null })
      )
    );
  });

  it("um registro por dia: escolher data que já tem RDO passa a editar aquele", async () => {
    montar({ rdos: [rdoExistente] });
    digitar("Data *", "2026-11-05");
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Já existe um registro nesse dia", expect.anything()));
    expect(screen.getByLabelText("Observações do dia")).toHaveValue("Forma da laje");
    salvar();
    await waitFor(() => expect(m.atualizar).toHaveBeenCalledWith(expect.objectContaining({ id: "rdo-ontem" })));
    expect(m.criar).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Registro atualizado");
  });

  it("impedimento vazio não entra; com texto entra e vai junto no salvar", async () => {
    montar();
    const campo = screen.getByPlaceholderText("O que travou (ex: falta de cimento)");
    fireEvent.keyDown(campo, { key: "Enter" });
    fireEvent.change(campo, { target: { value: "  Falta de cimento " } });
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(screen.getByText("Falta de cimento")).toBeInTheDocument();
    salvar();
    await waitFor(() =>
      expect(m.salvarImpedimentos).toHaveBeenCalledWith({
        rdoId: "rdo-novo",
        obraId: "obra-1",
        entradas: [{ descricao: "Falta de cimento", tipo: "falta_material" }],
      })
    );
  });

  it("foto em formato não suportado ou acima de 8MB é recusada; válida sobe no salvar", async () => {
    montar();
    const pdf = new File(["x"], "nota.pdf", { type: "application/pdf" });
    const grande = new File(["x"], "grande.jpg", { type: "image/jpeg" });
    Object.defineProperty(grande, "size", { value: 9 * 1024 * 1024 });
    const ok = new File(["x"], "laje.jpg", { type: "image/jpeg" });
    anexar([pdf, grande, ok]);

    expect(toast.error).toHaveBeenCalledWith("Formato não suportado", expect.anything());
    expect(toast.error).toHaveBeenCalledWith("Foto grande demais", { description: "grande.jpg: máx. 8MB." });
    expect(screen.getAllByRole("button", { name: "Remover foto" })).toHaveLength(1);

    salvar();
    await waitFor(() =>
      expect(m.uploadFoto).toHaveBeenCalledWith({ empresaId: "emp-1", obraId: "obra-1", rdoId: "rdo-novo", file: ok })
    );
    expect(m.uploadFoto).toHaveBeenCalledTimes(1);
  });

  it("foto com perfil não carregado: erro e diálogo aberto", async () => {
    m.empresaId = null;
    const { onOpenChange } = montar();
    anexar([new File(["x"], "a.png", { type: "image/png" })]);
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", {
        description: "Perfil não carregado. Tente novamente em instantes.",
      })
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(m.uploadFoto).not.toHaveBeenCalled();
  });

  it("erro do servidor mantém o diálogo aberto com o texto digitado", async () => {
    m.criar.mockRejectedValueOnce(new Error("RDO duplicado"));
    const { onOpenChange } = montar();
    digitar("Ocorrências", "Chuva forte à tarde");
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "RDO duplicado" })
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Ocorrências")).toHaveValue("Chuva forte à tarde");
  });

  it("falha num bloco satélite (efetivo) também avisa", async () => {
    m.salvarEfetivo.mockRejectedValueOnce(new Error("rls"));
    const { onOpenChange } = montar();
    salvar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "rls" }));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("rascunho dos registros (SPEC 135): pré-preenche e liga os registros ao RDO", async () => {
    montar({
      rascunho: {
        data: "2026-11-04",
        campos: { atividades: "Do áudio" },
        efetivoLinhas: [{ fornecedor_id: null, fornecedor_nome: "Equipe João", quantidade: 4 }],
        impedimentoLinhas: [],
        registroIds: ["reg-1", "reg-2"],
      } as never,
    });
    expect(screen.getByLabelText("Observações do dia")).toHaveValue("Do áudio");
    expect(screen.getByLabelText("Total de pessoas na obra")).toBeDisabled();
    expect(screen.getByLabelText("Total de pessoas na obra")).toHaveValue(4);
    salvar();
    await waitFor(() =>
      expect(m.vincular).toHaveBeenCalledWith({ rdoId: "rdo-novo", registroIds: ["reg-1", "reg-2"] })
    );
    expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({ data: "2026-11-04", efetivo: 4 }));
  });

  it("clima automático só preenche quando a obra tem coordenadas", async () => {
    m.obra = { latitude: -22.9, longitude: -47 };
    m.buscarClima.mockResolvedValue("ensolarado");
    montar();
    expect(await screen.findByText(/previsão/i)).toBeInTheDocument();
    salvar();
    await waitFor(() => expect(m.criar).toHaveBeenCalledWith(expect.objectContaining({ clima: "ensolarado" })));
  });
});
