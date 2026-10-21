import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ObraRegistrosTimeline } from "./ObraRegistrosTimeline";
import type { ObraRegistro } from "@/pages/obras/hooks/useObraRegistros";

const estado = vi.hoisted(() => ({
  registros: [] as ObraRegistro[],
  carregando: false,
  atualizar: vi.fn(),
  excluir: vi.fn(),
  reprocessar: vi.fn(),
  assinar: vi.fn(),
}));

vi.mock("@/pages/obras/hooks/useObraRegistros", () => ({
  BUCKET_AUDIO_REGISTRO: "obra-registro-audio",
  BUCKET_FOTO_REGISTRO: "obra-campo",
  useObraRegistros: () => ({ data: estado.registros, isLoading: estado.carregando, error: null }),
  useAtualizarRegistro: () => ({ mutate: estado.atualizar, mutateAsync: estado.atualizar, isPending: false }),
  useExcluirRegistro: () => ({ mutateAsync: estado.excluir, isPending: false }),
  useReprocessarRegistro: () => ({ mutate: estado.reprocessar, isPending: false }),
  assinarArquivos: (...a: unknown[]) => estado.assinar(...a),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const reg = (extra: Partial<ObraRegistro> = {}): ObraRegistro => ({
  id: "r1",
  obra_id: "o1",
  rdo_id: null,
  autor_nome: "Zé Pedreiro",
  data_registro: "2026-10-19",
  tipo: "audio",
  texto_bruto: "bruto",
  texto_organizado: "Elétrica (5) e equipe própria (3) na obra.",
  extraido: { efetivo_total: 8 },
  audio_path: "e/o/c1.webm",
  audio_duracao_s: 48,
  fotos: [],
  status: "pronto",
  erro: null,
  visivel_cliente: false,
  criado_em: "2026-10-19T14:00:00.000Z",
  ...extra,
});

beforeEach(() => {
  estado.registros = [];
  estado.carregando = false;
  estado.atualizar.mockReset().mockResolvedValue(undefined);
  estado.excluir.mockReset().mockResolvedValue(undefined);
  estado.reprocessar.mockReset();
  estado.assinar.mockReset().mockResolvedValue(["https://exemplo.test/audio.webm?token=x"]);
});

describe("ObraRegistrosTimeline", () => {
  it("sem registros orienta a primeira ação", () => {
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(screen.getByText("Nenhum registro ainda")).toBeTruthy();
  });

  it("agrupa por dia e mostra autor, texto organizado e chips", () => {
    estado.registros = [reg(), reg({ id: "r2", data_registro: "2026-10-18", texto_organizado: "Chuva à tarde." })];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(screen.getAllByText("Zé Pedreiro")).toHaveLength(2);
    expect(screen.getByText("Elétrica (5) e equipe própria (3) na obra.")).toBeTruthy();
    expect(screen.getAllByText("8 pessoas")).toHaveLength(2);
    expect(screen.getAllByRole("region")).toHaveLength(2);
  });

  it("registro nasce interno e o gestor libera ao cliente", () => {
    estado.registros = [reg()];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(screen.getByText("Interno")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /mostrar ao cliente/i }));
    expect(estado.atualizar).toHaveBeenCalledWith({ id: "r1", visivel_cliente: true }, expect.anything());
  });

  it("ouvir áudio pede a URL assinada e mostra o player", async () => {
    estado.registros = [reg()];
    const { container } = render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /ouvir áudio/i }));
    await waitFor(() => expect(container.querySelector("audio")).not.toBeNull());
    expect(estado.assinar).toHaveBeenCalledWith("obra-registro-audio", ["e/o/c1.webm"]);
  });

  it("sem permissão de edição não oferece corrigir, liberar nem apagar", () => {
    estado.registros = [reg()];
    render(<ObraRegistrosTimeline obraId="o1" canEdit={false} />);
    expect(screen.queryByRole("button", { name: /corrigir texto/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /mostrar ao cliente/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /apagar registro/i })).toBeNull();
    expect(screen.getByRole("button", { name: /ouvir áudio/i })).toBeTruthy();
  });

  it("falhou: explica sem erro técnico e reprocessa", () => {
    estado.registros = [reg({ status: "falhou", erro: "sem_tokens", texto_organizado: null, extraido: null })];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(screen.getByText(/créditos de IA da empresa acabaram/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    expect(estado.reprocessar).toHaveBeenCalledWith("r1");
  });

  it("apagar pede confirmação e remove o registro", async () => {
    estado.registros = [reg({ fotos: [] })];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /apagar registro/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^apagar$/i }));
    await waitFor(() => expect(estado.excluir).toHaveBeenCalled());
    expect(estado.excluir.mock.calls[0][0]).toMatchObject({ id: "r1", audio_path: "e/o/c1.webm" });
  });
});
