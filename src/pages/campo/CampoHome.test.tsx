import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake } from "@/pages/obras/testing/supabaseFake";
import type { FilaRegistroItem } from "./campoRegistroFila";
import type { RegistroDoServidor } from "./registrosView";
import type { CampoAccount } from "./useCampoAuth";

// Home do Pilar Campo: fila pendente com reenvio manual, timeline de registros (servidor +
// aparelho), escrever/foto rápidos e a lista de dias do formulário. Sair limpa a sessão.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const sync = vi.hoisted(() => ({
  pendentes: 0,
  locais: [] as FilaRegistroItem[],
  sincronizando: false,
  sincronizar: vi.fn(),
  registrar: vi.fn(),
  descartarRegistro: vi.fn(),
}));
vi.mock("./useCampoSync", () => ({ useCampoSync: () => ({ ...sync }) }));

const comprimir = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@/lib/comprimirFoto", () => ({ comprimirFoto: (f: File) => comprimir.fn(f) }));

import CampoHome from "./CampoHome";
import { getCampoToken, setCampoToken } from "./useCampoAuth";

const conta: CampoAccount = {
  account_id: "acc-1",
  obra_id: "obra-1",
  empresa_id: "emp-1",
  nome: "Zé da Obra",
  must_change_senha: false,
};

function registroServidor(over: Partial<RegistroDoServidor> = {}): RegistroDoServidor {
  return {
    id: "reg-1",
    client_id: "cli-1",
    data_registro: "2026-11-05",
    tipo: "texto",
    status: "pronto",
    autor_nome: "Zé da Obra",
    criado_em: "2026-11-05T12:00:00Z",
    erro: null,
    texto: "Levantamos a alvenaria do bloco B",
    extraido: null,
    audio_duracao_s: null,
    tem_audio: false,
    fotos: 0,
    meu: true,
    ...over,
  };
}

function rpcs(over: { rdos?: unknown; registros?: unknown; rdosErro?: boolean } = {}) {
  fake.rpc.mockImplementation(async (nome: string) => {
    if (nome === "campo_listar_rdos") {
      if (over.rdosErro) return { data: null, error: { message: "boom" } };
      return { data: { ok: true, rdos: over.rdos ?? [] }, error: null };
    }
    if (nome === "campo_listar_registros") {
      return { data: { ok: true, registros: over.registros ?? [], aceitou_audio: true }, error: null };
    }
    if (nome === "campo_responder_efetivo") return { data: { ok: true }, error: null };
    return { data: null, error: null };
  });
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/campo"]}>
        <Routes>
          <Route element={<Outlet context={{ account: conta }} />}>
            <Route path="/campo" element={<CampoHome />} />
            <Route path="/campo/gravar" element={<p>Tela de gravar</p>} />
            <Route path="/campo/dia" element={<p>Formulário do dia</p>} />
            <Route path="/campo/login" element={<p>Tela de login</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  sessionStorage.clear();
  setCampoToken("tok-1");
  sync.pendentes = 0;
  sync.locais = [];
  sync.sincronizando = false;
  sync.registrar.mockResolvedValue(undefined);
  comprimir.fn.mockImplementation(async () => new Blob(["jpg"], { type: "image/jpeg" }));
  rpcs();
});

describe("CampoHome", () => {
  it("cumprimenta a conta e mostra os vazios quando não há registro nem dia", async () => {
    montar();
    expect(screen.getByRole("heading", { name: "Zé da Obra" })).toBeInTheDocument();
    expect(await screen.findByText(/Nenhum registro ainda/)).toBeInTheDocument();
    expect(await screen.findByText("Nenhum dia registrado ainda.")).toBeInTheDocument();
    expect(screen.queryByText(/aguardando/)).not.toBeInTheDocument();
  });

  it("sem token não consulta o servidor", async () => {
    sessionStorage.clear();
    montar();
    expect(await screen.findByText("Nenhum dia registrado ainda.")).toBeInTheDocument();
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("fila pendente: singular/plural e reenvio manual", async () => {
    sync.pendentes = 1;
    montar();
    expect(screen.getByText(/1 item aguardando/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar enviar agora" }));
    expect(sync.sincronizar).toHaveBeenCalled();
  });

  it("enquanto sincroniza o botão de reenvio trava", () => {
    sync.pendentes = 3;
    sync.sincronizando = true;
    montar();
    expect(screen.getByText(/3 itens aguardando/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar enviar agora" })).toBeDisabled();
  });

  it("lista os dias do formulário com os contadores que existem", async () => {
    rpcs({
      rdos: [
        {
          id: "r1",
          data: "2026-11-04",
          clima: "sol",
          efetivo: 7,
          atividades: "Forma da laje",
          fotos: 3,
          medicoes: 2,
          tarefas: 1,
        },
        { id: "r2", data: "2026-11-03", clima: null, efetivo: null, atividades: null, fotos: 0 },
      ],
    });
    montar();
    expect(await screen.findByText("Forma da laje")).toBeInTheDocument();
    const itens = screen.getAllByRole("listitem");
    expect(itens).toHaveLength(2);
    expect(within(itens[0]).getByText("7")).toBeInTheDocument();
    expect(within(itens[0]).getByText("3")).toBeInTheDocument();
    expect(within(itens[0]).getByText("2")).toBeInTheDocument();
    expect(within(itens[1]).queryByText("0")).not.toBeInTheDocument();
  });

  it("resposta não ok da listagem de dias vira lista vazia", async () => {
    fake.rpc.mockImplementation(async (nome: string) =>
      nome === "campo_listar_rdos"
        ? { data: { ok: false }, error: null }
        : { data: { ok: true, registros: [] }, error: null }
    );
    montar();
    expect(await screen.findByText("Nenhum dia registrado ainda.")).toBeInTheDocument();
  });

  it("junta registros do servidor e do aparelho, sem duplicar o que já subiu", async () => {
    rpcs({ registros: [registroServidor()] });
    sync.locais = [
      {
        id: "cli-1",
        criadoEm: 1,
        data: "2026-11-05",
        texto: "duplicado",
        fotos: [],
        aceiteAudio: false,
        tentativas: 0,
      },
      {
        id: "cli-2",
        criadoEm: Date.now(),
        data: "2026-11-06",
        texto: "Ainda no aparelho",
        fotos: [],
        aceiteAudio: false,
        tentativas: 1,
      },
    ];
    montar();
    expect(await screen.findByText("Levantamos a alvenaria do bloco B")).toBeInTheDocument();
    expect(screen.getByText("Ainda no aparelho")).toBeInTheDocument();
    expect(screen.queryByText("duplicado")).not.toBeInTheDocument();
  });

  it("navega para gravar e para o formulário do dia", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Gravar o que foi feito/ }));
    expect(await screen.findByText("Tela de gravar")).toBeInTheDocument();
  });

  it("abre o formulário do dia", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Registrar o dia/ }));
    expect(await screen.findByText("Formulário do dia")).toBeInTheDocument();
  });

  it("sair limpa a sessão e vai para o login", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Sair/ }));
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(getCampoToken()).toBeNull();
  });

  it("escrever: texto em branco não envia; texto válido vira registro sem áudio", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Escrever/ }));
    const campo = await screen.findByLabelText("O que foi feito");
    fireEvent.change(campo, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();

    fireEvent.change(campo, { target: { value: "  Chegou o cimento  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(sync.registrar).toHaveBeenCalledTimes(1));
    const item = sync.registrar.mock.calls[0][0] as FilaRegistroItem;
    expect(item.texto).toBe("Chegou o cimento");
    expect(item.audio).toBeUndefined();
    expect(item.aceiteAudio).toBe(false);
    await waitFor(() => expect(screen.queryByLabelText("O que foi feito")).not.toBeInTheDocument());
  });

  it("foto rápida vira registro só com a foto", async () => {
    montar();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "f.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(sync.registrar).toHaveBeenCalledTimes(1));
    const item = sync.registrar.mock.calls[0][0] as FilaRegistroItem;
    expect(item.fotos).toHaveLength(1);
    expect(item.texto).toBeUndefined();
  });

  it("foto que falha ao comprimir avisa e não registra", async () => {
    comprimir.fn.mockRejectedValueOnce(new Error("formato"));
    montar();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(["x"], "f.heic")] } });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para usar essa foto", expect.anything()));
    expect(sync.registrar).not.toHaveBeenCalled();
  });

  it("input de foto sem arquivo não faz nada", () => {
    montar();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(comprimir.fn).not.toHaveBeenCalled();
  });

  it("registro com erro pode ser reprocessado pela edge function", async () => {
    rpcs({ registros: [registroServidor({ status: "falhou", erro: "falha_ia" })] });
    montar();
    const botao = await screen.findByRole("button", { name: /Tentar de novo/ });
    fireEvent.click(botao);
    await waitFor(() =>
      expect(fake.invoke).toHaveBeenCalledWith("registro-reprocessar", {
        body: { registro_id: "reg-1", token: "tok-1" },
      })
    );
  });

  it("responder a pergunta de efetivo grava a quantidade", async () => {
    rpcs({ registros: [registroServidor({ extraido: { pergunta: "Quantas pessoas trabalharam hoje?" } })] });
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "4" }));
    await waitFor(() =>
      expect(fake.rpc).toHaveBeenCalledWith("campo_responder_efetivo", {
        p_token: "tok-1",
        p_registro_id: "reg-1",
        p_quantidade: 4,
      })
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("falha ao responder o efetivo avisa a pessoa", async () => {
    rpcs({ registros: [registroServidor({ extraido: { pergunta: "Quantas pessoas trabalharam hoje?" } })] });
    const base = fake.rpc.getMockImplementation()!;
    fake.rpc.mockImplementation(async (nome: string, args?: unknown) =>
      nome === "campo_responder_efetivo" ? { data: { ok: false }, error: null } : base(nome, args)
    );
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "2" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não deu para salvar", expect.anything()));
  });

  it("registro bloqueado no aparelho pode ser descartado", async () => {
    sync.locais = [
      {
        id: "cli-9",
        criadoEm: Date.now(),
        data: "2026-11-06",
        texto: "Áudio grande demais",
        fotos: [],
        aceiteAudio: true,
        tentativas: 3,
        erroDefinitivo: "Áudio acima do limite",
      },
    ];
    montar();
    fireEvent.click(await screen.findByRole("button", { name: /Descartar/ }));
    expect(sync.descartarRegistro).toHaveBeenCalledWith("cli-9");
  });
});
