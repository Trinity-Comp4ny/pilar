import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ObraRegistro } from "@/pages/obras/hooks/useObraRegistros";

// Estados da timeline: carregando, erro, organizando, fotos assinadas, áudio que
// falha, corrigir texto (salva, limpa, erro), visibilidade que falha, apagar que
// falha, falha por falta de tokens e o resumo do dia que fecha o RDO.

const estado = vi.hoisted(() => ({
  registros: [] as ObraRegistro[],
  carregando: false,
  erro: null as unknown,
  atualizar: vi.fn(),
  atualizarMutate: vi.fn(),
  excluir: vi.fn(),
  reprocessar: vi.fn(),
  assinar: vi.fn(),
}));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));

vi.mock("@/pages/obras/hooks/useObraRegistros", () => ({
  BUCKET_AUDIO_REGISTRO: "obra-registro-audio",
  BUCKET_FOTO_REGISTRO: "obra-campo",
  useObraRegistros: () => ({ data: estado.registros, isLoading: estado.carregando, error: estado.erro }),
  useAtualizarRegistro: () => ({ mutate: estado.atualizarMutate, mutateAsync: estado.atualizar, isPending: false }),
  useExcluirRegistro: () => ({ mutateAsync: estado.excluir, isPending: false }),
  useReprocessarRegistro: () => ({ mutate: estado.reprocessar, isPending: false }),
  assinarArquivos: (...a: unknown[]) => estado.assinar(...a),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("./ResumoDoDia", () => ({
  ResumoDoDia: ({ onFechar }: { onFechar: () => void }) => <button onClick={onFechar}>fechar-dia</button>,
}));

import { ObraRegistrosTimeline } from "./ObraRegistrosTimeline";

const reg = (extra: Partial<ObraRegistro> = {}): ObraRegistro => ({
  id: "r1",
  obra_id: "o1",
  rdo_id: null,
  autor_nome: "Zé Pedreiro",
  data_registro: "2026-10-19",
  tipo: "texto",
  texto_bruto: "bruto",
  texto_organizado: "Texto organizado.",
  extraido: null,
  audio_path: null,
  audio_duracao_s: null,
  fotos: [],
  status: "pronto",
  erro: null,
  visivel_cliente: false,
  criado_em: "2026-10-19T14:00:00.000Z",
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  estado.registros = [];
  estado.carregando = false;
  estado.erro = null;
  estado.atualizar.mockResolvedValue(undefined);
  estado.excluir.mockResolvedValue(undefined);
  estado.assinar.mockResolvedValue([]);
});

describe("ObraRegistrosTimeline: carregamento", () => {
  it("carregando mostra esqueleto; erro mostra o estado de falha", () => {
    estado.carregando = true;
    const { container, rerender } = render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(container.querySelectorAll(".rounded-2xl").length).toBeGreaterThan(0);
    estado.carregando = false;
    estado.erro = new Error("rls");
    rerender(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(screen.getByText("Não deu para carregar os registros")).toBeInTheDocument();
  });
});

describe("ObraRegistrosTimeline: cartão", () => {
  it("organizando sem texto mostra placeholder e não deixa corrigir; um registro no dia no singular", () => {
    estado.registros = [reg({ status: "organizando", texto_organizado: null, texto_bruto: null })];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(screen.getByText("Organizando")).toBeInTheDocument();
    expect(screen.getByText(/1 registro$/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Corrigir texto/ })).not.toBeInTheDocument();
  });

  it("registro pronto sem texto não mostra parágrafo; texto bruto é o fallback", () => {
    estado.registros = [
      reg({ texto_organizado: null, texto_bruto: null }),
      reg({ id: "r2", texto_organizado: null, texto_bruto: "Só o bruto" }),
    ];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(screen.getByText("Só o bruto")).toBeInTheDocument();
    expect(screen.getByText(/2 registros$/)).toBeInTheDocument();
  });

  it("fotos são assinadas e aparecem; falha na assinatura não mostra nada", async () => {
    estado.assinar.mockResolvedValueOnce(["https://x/1.jpg", "https://x/2.jpg"]).mockRejectedValueOnce(new Error("x"));
    estado.registros = [
      reg({ fotos: ["a.jpg", "b.jpg"] }),
      reg({ id: "r2", fotos: ["c.jpg"], visivel_cliente: true, data_registro: "2026-10-18" }),
    ];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    expect(await screen.findByAltText("Foto 2 de Zé Pedreiro")).toBeInTheDocument();
    expect(screen.getByText(/· 2 fotos/)).toBeInTheDocument();
    expect(screen.getByText(/· 1 foto$/)).toBeInTheDocument();
    expect(estado.assinar).toHaveBeenCalledWith("obra-campo", ["a.jpg", "b.jpg"]);
    expect(screen.getAllByRole("img")).toHaveLength(2);
    expect(screen.getByText("Cliente vê")).toBeInTheDocument();
  });

  it("falha ao abrir o áudio avisa; URL vazia não mostra player", async () => {
    estado.assinar.mockRejectedValueOnce(new Error("expirou")).mockResolvedValueOnce([]);
    estado.registros = [reg({ audio_path: "a.webm", audio_duracao_s: 10 })];
    const { container } = render(<ObraRegistrosTimeline obraId="o1" canEdit={false} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Ouvir áudio/ })));
    expect(toast.error).toHaveBeenCalledWith("Não deu para abrir o áudio", expect.anything());
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Ouvir áudio/ })));
    expect(container.querySelector("audio")).toBeNull();
  });

  it("falha por falta de tokens orienta renovar; sem edição não reprocessa", () => {
    estado.registros = [reg({ status: "falhou", erro: "sem_tokens" })];
    render(<ObraRegistrosTimeline obraId="o1" canEdit={false} />);
    expect(screen.getByText(/Depois de renovar os créditos/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).not.toBeInTheDocument();
  });

  it("visível ao cliente oferece esconder; erro ao mudar avisa", () => {
    estado.registros = [reg({ visivel_cliente: true })];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /Esconder do cliente/ }));
    const [payload, opts] = estado.atualizarMutate.mock.calls[0];
    expect(payload).toEqual({ id: "r1", visivel_cliente: false });
    opts.onError();
    expect(toast.error).toHaveBeenCalledWith("Não deu para mudar a visibilidade", expect.anything());
  });
});

describe("ObraRegistrosTimeline: corrigir e apagar", () => {
  it("corrige o texto aparado; vazio grava null; erro mantém o diálogo", async () => {
    estado.registros = [reg()];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /Corrigir texto/ }));
    const dialogo = screen.getByRole("dialog");
    const campo = within(dialogo).getByLabelText("Texto do registro");
    expect(campo).toHaveValue("Texto organizado.");
    fireEvent.change(campo, { target: { value: "  Novo texto " } });
    await act(async () => fireEvent.click(within(dialogo).getByRole("button", { name: "Salvar" })));
    expect(estado.atualizar).toHaveBeenCalledWith({ id: "r1", texto_organizado: "Novo texto" });
    expect(toast.success).toHaveBeenCalledWith("Texto corrigido");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    estado.atualizar.mockRejectedValueOnce(new Error("rls"));
    fireEvent.click(screen.getByRole("button", { name: /Corrigir texto/ }));
    fireEvent.change(screen.getByLabelText("Texto do registro"), { target: { value: "   " } });
    await act(async () => fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Salvar" })));
    expect(estado.atualizar).toHaveBeenLastCalledWith({ id: "r1", texto_organizado: null });
    expect(toast.error).toHaveBeenCalledWith("Não deu para salvar o texto", expect.anything());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("corrigir registro sem texto começa vazio", () => {
    estado.registros = [reg({ texto_organizado: null, texto_bruto: null })];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: /Corrigir texto/ }));
    expect(screen.getByLabelText("Texto do registro")).toHaveValue("");
  });

  it("apagar que falha avisa e fecha a confirmação; cancelar não apaga", async () => {
    estado.excluir.mockRejectedValueOnce(new Error("rls"));
    estado.registros = [reg()];
    render(<ObraRegistrosTimeline obraId="o1" canEdit />);
    fireEvent.click(screen.getByRole("button", { name: "Apagar registro" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));
    expect(estado.excluir).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Apagar registro" }));
    await act(async () =>
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: /Apagar/ }))
    );
    expect(toast.error).toHaveBeenCalledWith("Não deu para apagar o registro", expect.anything());
  });
});

describe("ObraRegistrosTimeline: fechar o dia", () => {
  it("resumo do dia leva a data e os registros do dia", () => {
    const onFecharDia = vi.fn();
    estado.registros = [reg(), reg({ id: "r2" }), reg({ id: "r3", data_registro: "2026-10-18" })];
    render(<ObraRegistrosTimeline obraId="o1" canEdit onFecharDia={onFecharDia} />);
    fireEvent.click(screen.getAllByRole("button", { name: "fechar-dia" })[0]);
    expect(onFecharDia).toHaveBeenCalledWith("2026-10-19", [
      expect.objectContaining({ id: "r1" }),
      expect.objectContaining({ id: "r2" }),
    ]);
  });
});
