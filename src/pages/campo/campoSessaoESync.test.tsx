import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake } from "@/pages/obras/testing/supabaseFake";
import type { FilaDiaItem } from "./campoOfflineQueue";
import type { FilaRegistroItem } from "./campoRegistroFila";

// Pilar Campo: login, sessão (expirada → volta ao login; offline → segue com a conta em cache)
// e a fila offline (guardado no aparelho sem rede, enviado quando a rede volta).

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

// IndexedDB não roda no jsdom: as filas viram stores em memória com a mesma interface.
const filas = vi.hoisted(() => {
  function store<T extends { id: string }>() {
    const itens = new Map<string, T>();
    return {
      itens,
      listar: async () => [...itens.values()],
      salvar: async (i: T) => void itens.set(i.id, i),
      remover: async (id: string) => void itens.delete(id),
    };
  }
  return { dias: store<FilaDiaItem>(), registros: store<FilaRegistroItem>() };
});
vi.mock("./campoOfflineDb", () => ({ filaOfflineDb: filas.dias, filaRegistroDb: filas.registros }));

import CampoLogin from "./CampoLogin";
import { useCampoAuth, getCampoToken, setCampoToken, campoLogout } from "./useCampoAuth";
import { useCampoSync } from "./useCampoSync";
import { enviarRegistroRemoto } from "./enviarRegistro";

const conta = { account_id: "acc-1", obra_id: "obra-1", empresa_id: "emp-1", nome: "João", must_change_senha: false };

function definirOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

const registro = (id: string, extra: Partial<FilaRegistroItem> = {}): FilaRegistroItem => ({
  id,
  criadoEm: 1,
  data: "2026-11-07",
  texto: "Concretagem da laje",
  fotos: [],
  aceiteAudio: false,
  tentativas: 0,
  ...extra,
});

const dia = (id: string): FilaDiaItem =>
  ({
    id,
    criadoEm: 1,
    dia: {
      p_data: "2026-11-07",
      p_clima: null,
      p_condicao: null,
      p_efetivo: 5,
      p_atividades: "Alvenaria",
      p_ocorrencias: null,
      p_pendencias: null,
    },
    fotos: [],
    medicoes: [],
    tarefas: [],
    efetivos: [],
    impedimentos: [],
    visitas: [],
    tentativas: 0,
  }) as FilaDiaItem;

beforeEach(() => {
  vi.clearAllMocks();
  fake.reset();
  sessionStorage.clear();
  filas.dias.itens.clear();
  filas.registros.itens.clear();
  definirOnline(true);
});

describe("CampoLogin", () => {
  function montar() {
    render(
      <MemoryRouter initialEntries={["/campo/login"]}>
        <Routes>
          <Route path="/campo/login" element={<CampoLogin />} />
          <Route path="/campo" element={<p>Home do campo</p>} />
          <Route path="/campo/senha" element={<p>Trocar senha</p>} />
        </Routes>
      </MemoryRouter>
    );
  }
  const entrar = () => fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

  it("sem email ou sem senha avisa e não chama o servidor", async () => {
    montar();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "joao@obra.com" } });
    entrar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Informe email e senha"));

    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "   " } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "segredo" } });
    entrar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(2));
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("senha errada: mostra o erro do servidor e fica no login", async () => {
    fake.rpc.mockResolvedValueOnce({ data: { ok: false, erro: "Senha incorreta" }, error: null });
    montar();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "joao@obra.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "errada" } });
    entrar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível entrar", { description: "Senha incorreta" })
    );
    expect(getCampoToken()).toBeNull();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeEnabled();
  });

  it("sem rede: avisa falha de conexão", async () => {
    fake.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    montar();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "joao@obra.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "x" } });
    entrar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Falha na conexão", expect.anything()));
  });

  it("login certo guarda o token, apara o email e vai para a home", async () => {
    fake.rpc.mockResolvedValueOnce({ data: { ok: true, token: "tok-1", must_change_senha: false }, error: null });
    montar();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "  joao@obra.com " } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "certa" } });
    entrar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    expect(fake.rpc).toHaveBeenCalledWith("campo_login", { p_email: "joao@obra.com", p_senha: "certa" });
    expect(getCampoToken()).toBe("tok-1");
  });

  it("primeiro acesso manda trocar a senha", async () => {
    fake.rpc.mockResolvedValueOnce({ data: { ok: true, token: "tok-1", must_change_senha: true }, error: null });
    montar();
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "joao@obra.com" } });
    fireEvent.change(screen.getByLabelText("Senha"), { target: { value: "provisoria" } });
    entrar();
    expect(await screen.findByText("Trocar senha")).toBeInTheDocument();
  });

  it("já logado vai direto para a home", async () => {
    setCampoToken("tok-antigo");
    montar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
  });

  it("mostrar/ocultar senha alterna o tipo do campo", () => {
    montar();
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "password");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar senha" }));
    expect(screen.getByLabelText("Senha")).toHaveAttribute("type", "text");
  });
});

describe("useCampoAuth", () => {
  it("sem token: não autenticado, sem chamar o servidor", async () => {
    const { result } = renderHook(() => useCampoAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("not_authenticated");
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it("servidor diz que a sessão expirou: limpa o token e a conta em cache", async () => {
    setCampoToken("tok-velho");
    sessionStorage.setItem("pilar_campo_account", JSON.stringify(conta));
    fake.rpc.mockResolvedValueOnce({ data: { ok: false }, error: null });
    const { result } = renderHook(() => useCampoAuth());
    await waitFor(() => expect(result.current.error).toBe("session_expired"));
    expect(result.current.account).toBeNull();
    expect(getCampoToken()).toBeNull();
    expect(sessionStorage.getItem("pilar_campo_account")).toBeNull();
  });

  it("sessão válida devolve a conta e guarda em cache", async () => {
    setCampoToken("tok-1");
    fake.rpc.mockResolvedValueOnce({ data: { ok: true, ...conta, must_change_senha: null }, error: null });
    const { result } = renderHook(() => useCampoAuth());
    await waitFor(() => expect(result.current.account).toEqual(conta));
    expect(fake.rpc).toHaveBeenCalledWith("campo_verify_session", { p_token: "tok-1" });
    expect(JSON.parse(sessionStorage.getItem("pilar_campo_account")!)).toEqual(conta);
  });

  it("sem rede com conta em cache: segue logado (offline-first)", async () => {
    setCampoToken("tok-1");
    sessionStorage.setItem("pilar_campo_account", JSON.stringify(conta));
    fake.rpc.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useCampoAuth());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.account).toEqual(conta);
    expect(result.current.error).toBeNull();
    expect(getCampoToken()).toBe("tok-1");
  });

  it("sem rede e sem cache: erro, mas não apaga o token", async () => {
    setCampoToken("tok-1");
    fake.rpc.mockResolvedValueOnce({ data: null, error: { message: "fetch failed" } });
    const { result } = renderHook(() => useCampoAuth());
    await waitFor(() => expect(result.current.error).toBe("error"));
    expect(getCampoToken()).toBe("tok-1");
  });

  it("logout limpa token e cache", () => {
    setCampoToken("tok-1");
    sessionStorage.setItem("pilar_campo_account", JSON.stringify(conta));
    campoLogout();
    expect(getCampoToken()).toBeNull();
    expect(sessionStorage.getItem("pilar_campo_account")).toBeNull();
  });
});

describe("useCampoSync", () => {
  function montar() {
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return renderHook(() => useCampoSync(), { wrapper });
  }

  it("offline: o registro fica guardado no aparelho e conta como pendente", async () => {
    definirOnline(false);
    setCampoToken("tok-1");
    // supabase-js não rejeita em falha de rede: devolve o erro (FunctionsFetchError).
    fake.invoke.mockResolvedValue({ data: null, error: new TypeError("Failed to fetch") });
    const { result } = montar();
    await act(() => result.current.registrar(registro("r-1")));

    await waitFor(() => expect(result.current.sincronizando).toBe(false));
    await waitFor(() => expect(result.current.pendentes).toBe(1));
    expect(filas.registros.itens.get("r-1")?.ultimoErro).toBe("Sem conexão com o servidor");
    expect(result.current.locais.map((r) => r.id)).toEqual(["r-1"]);
  });

  it("quando a rede volta, envia a fila e zera os pendentes", async () => {
    definirOnline(false);
    setCampoToken("tok-1");
    await filas.registros.salvar(registro("r-1"));
    await filas.dias.salvar(dia("d-1"));
    const { result } = montar();
    await waitFor(() => expect(result.current.pendentes).toBe(2));
    expect(fake.invoke).not.toHaveBeenCalled();

    fake.invoke.mockResolvedValue({ data: { success: true }, error: null });
    fake.rpc.mockImplementation(async (nome: string) =>
      nome === "campo_salvar_rdo" ? { data: { ok: true, rdo_id: "rdo-1" }, error: null } : { data: null, error: null }
    );
    definirOnline(true);
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => expect(result.current.pendentes).toBe(0));
    expect(fake.rpc).toHaveBeenCalledWith(
      "campo_salvar_rdo",
      expect.objectContaining({ p_token: "tok-1", p_efetivo: 5 })
    );
    expect(fake.invoke).toHaveBeenCalledWith("campo-registro-criar", {
      body: expect.objectContaining({ token: "tok-1", client_id: "r-1", texto: "Concretagem da laje" }),
    });
    expect(filas.registros.itens.size).toBe(0);
    expect(filas.dias.itens.size).toBe(0);
  });

  it("sem sessão não envia nada (volta pelo login antes)", async () => {
    await filas.registros.salvar(registro("r-1"));
    const { result } = montar();
    await act(() => result.current.sincronizar());
    expect(fake.invoke).not.toHaveBeenCalled();
    expect(filas.registros.itens.size).toBe(1);
  });

  it("dia recusado pelo servidor continua na fila para tentar de novo", async () => {
    setCampoToken("tok-1");
    await filas.dias.salvar(dia("d-1"));
    fake.rpc.mockResolvedValue({ data: { ok: false, erro: "sessão expirada" }, error: null });
    const { result } = montar();
    await act(() => result.current.sincronizar());
    await waitFor(() => expect(result.current.pendentes).toBe(1));
    expect(filas.dias.itens.get("d-1")?.tentativas).toBeGreaterThan(0);
  });

  it("descartar remove o registro do aparelho", async () => {
    definirOnline(false);
    await filas.registros.salvar(registro("r-1"));
    const { result } = montar();
    await waitFor(() => expect(result.current.pendentes).toBe(1));
    await act(() => result.current.descartarRegistro("r-1"));
    expect(result.current.pendentes).toBe(0);
  });

  it("registro com erro definitivo não conta como pendente", async () => {
    definirOnline(false);
    await filas.registros.salvar(registro("r-1", { erroDefinitivo: "Áudio grande demais" }));
    const { result } = montar();
    await waitFor(() => expect(result.current.locais).toHaveLength(1));
    expect(result.current.pendentes).toBe(0);
  });
});

describe("enviarRegistroRemoto", () => {
  const resposta = (status: number, corpo: unknown) => ({
    context: new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } }),
  });

  it("sucesso", async () => {
    fake.invoke.mockResolvedValueOnce({ data: { success: true }, error: null });
    expect(await enviarRegistroRemoto("tok", registro("r-1"))).toEqual({ ok: true });
  });

  it("413 (arquivo grande) e 403 (aviso do áudio) são definitivos", async () => {
    fake.invoke.mockResolvedValueOnce({ data: null, error: resposta(413, { error: "Arquivo grande demais" }) });
    expect(await enviarRegistroRemoto("tok", registro("r-1"))).toEqual({
      ok: false,
      erro: "Arquivo grande demais",
      definitivo: true,
    });
    fake.invoke.mockResolvedValueOnce({ data: null, error: resposta(403, { error: "Aceite o aviso" }) });
    expect(await enviarRegistroRemoto("tok", registro("r-1"))).toEqual(expect.objectContaining({ definitivo: true }));
  });

  it("401 de sessão vencida e falha de rede tentam de novo", async () => {
    fake.invoke.mockResolvedValueOnce({ data: null, error: resposta(401, { error: "Sessão expirada" }) });
    expect(await enviarRegistroRemoto("tok", registro("r-1"))).toEqual({
      ok: false,
      erro: "Sessão expirada",
      definitivo: false,
    });
    fake.invoke.mockResolvedValueOnce({ data: null, error: new Error("offline") });
    expect(await enviarRegistroRemoto("tok", registro("r-1"))).toEqual({
      ok: false,
      erro: "Sem conexão com o servidor",
      definitivo: false,
    });
  });

  it("áudio aceito vai com o aceite e o mime sem parâmetros", async () => {
    fake.invoke.mockResolvedValueOnce({ data: { success: true }, error: null });
    await enviarRegistroRemoto(
      "tok",
      registro("r-1", {
        texto: undefined,
        aceiteAudio: true,
        audio: { blob: new Blob(["a"]), mimeType: "audio/webm;codecs=opus", duracaoS: 12 },
      })
    );
    const corpo = (fake.invoke.mock.calls[0][1] as { body: Record<string, unknown> }).body;
    expect(corpo.aceite_audio).toBe(true);
    expect(corpo.texto).toBeUndefined();
    expect(corpo.audio).toEqual(expect.objectContaining({ mime_type: "audio/webm", duracao_s: 12 }));
  });
});

describe("useCampoSync: dia completo", () => {
  function montar() {
    const qc = new QueryClient();
    const invalidate = vi.spyOn(qc, "invalidateQueries");
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    );
    return { ...renderHook(() => useCampoSync(), { wrapper }), invalidate };
  }

  const diaCompleto = (): FilaDiaItem => ({
    ...dia("d-1"),
    fotos: [{ contentType: "image/jpeg", imageBase64: "AAA", enviada: false }],
    medicoes: [{ item: "Alvenaria", quantidade: 12, unidade: "m²", enviada: false }],
    tarefas: [{ tarefaId: "t-1", resultado: "concluiu", observacao: "ok", enviada: false }],
    efetivos: [{ fornecedorId: "f-1", fornecedorNome: "Empreiteira", quantidade: 4, enviada: false }],
    impedimentos: [{ descricao: "Chuva", tipo: "clima", enviada: false }],
    visitas: [{ fornecedorId: null, fornecedorNome: "Fiscal", observacao: "Vistoria", enviada: false }],
  });

  it("envia o RDO, a foto e cada lançamento do dia com o token da sessão", async () => {
    definirOnline(false);
    setCampoToken("tok-1");
    await filas.dias.salvar(diaCompleto());
    fake.invoke.mockResolvedValue({ data: { success: true }, error: null });
    fake.rpc.mockImplementation(async (nome: string) =>
      nome === "campo_salvar_rdo"
        ? { data: { ok: true, rdo_id: "rdo-1" }, error: null }
        : { data: { ok: true }, error: null }
    );
    const { result, invalidate } = montar();
    await act(() => result.current.sincronizar());
    await waitFor(() => expect(result.current.pendentes).toBe(0));

    expect(fake.invoke).toHaveBeenCalledWith("campo-upload-foto", {
      body: { token: "tok-1", rdo_id: "rdo-1", image_base64: "AAA", content_type: "image/jpeg" },
    });
    expect(fake.rpc).toHaveBeenCalledWith("campo_registrar_medicao", {
      p_token: "tok-1",
      p_rdo_id: "rdo-1",
      p_item: "Alvenaria",
      p_quantidade: 12,
      p_unidade: "m²",
    });
    expect(fake.rpc).toHaveBeenCalledWith("campo_registrar_tarefa_rdo", {
      p_token: "tok-1",
      p_rdo_id: "rdo-1",
      p_tarefa_id: "t-1",
      p_resultado: "concluiu",
      p_observacao: "ok",
    });
    expect(fake.rpc).toHaveBeenCalledWith("campo_registrar_efetivo", {
      p_token: "tok-1",
      p_rdo_id: "rdo-1",
      p_fornecedor_id: "f-1",
      p_fornecedor_nome: "Empreiteira",
      p_quantidade: 4,
    });
    expect(fake.rpc).toHaveBeenCalledWith("campo_registrar_impedimento", {
      p_token: "tok-1",
      p_rdo_id: "rdo-1",
      p_descricao: "Chuva",
      p_tipo: "clima",
    });
    expect(fake.rpc).toHaveBeenCalledWith("campo_registrar_visita", {
      p_token: "tok-1",
      p_rdo_id: "rdo-1",
      p_fornecedor_id: null,
      p_fornecedor_nome: "Fiscal",
      p_observacao: "Vistoria",
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["campo_rdos"] });
    expect(filas.dias.itens.size).toBe(0);
  });

  it("falha em cada lançamento mantém o dia na fila com o RDO já criado", async () => {
    definirOnline(false);
    setCampoToken("tok-1");
    await filas.dias.salvar(diaCompleto());
    fake.invoke.mockResolvedValue({ data: { success: false }, error: null });
    fake.rpc.mockImplementation(async (nome: string) =>
      nome === "campo_salvar_rdo"
        ? { data: { ok: true, rdo_id: "rdo-1" }, error: null }
        : { data: null, error: { message: "rls" } }
    );
    const { result, invalidate } = montar();
    await act(() => result.current.sincronizar());
    await waitFor(() => expect(result.current.pendentes).toBe(1));
    const item = filas.dias.itens.get("d-1");
    expect(item?.rdoId).toBe("rdo-1");
    expect(item?.fotos[0].enviada).toBe(false);
    expect(item?.medicoes[0].enviada).toBe(false);
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: ["campo_rdos"] });
  });

  it("RDO sem id devolvido conta como falha", async () => {
    definirOnline(false);
    setCampoToken("tok-1");
    await filas.dias.salvar(dia("d-1"));
    fake.rpc.mockResolvedValue({ data: { ok: true }, error: null });
    const { result } = montar();
    await act(() => result.current.sincronizar());
    await waitFor(() => expect(result.current.pendentes).toBe(1));
    expect(filas.dias.itens.get("d-1")?.rdoId).toBeUndefined();
  });
});
