import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake } from "@/pages/obras/testing/supabaseFake";
import type { FilaDiaItem } from "./campoOfflineQueue";

// Registrar o dia no Pilar Campo: sem sessão volta ao login; sem rede guarda no aparelho;
// com rede grava o RDO e os itens; item que falha fica na fila com o rdo já criado.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
const fila = vi.hoisted(() => ({ itens: [] as FilaDiaItem[] }));
vi.mock("./campoOfflineDb", () => ({
  filaOfflineDb: {
    listar: async () => fila.itens,
    salvar: async (i: FilaDiaItem) => void fila.itens.push(i),
    remover: async () => {},
  },
  filaRegistroDb: { listar: async () => [], salvar: async () => {}, remover: async () => {} },
}));

import CampoRegistrarDia from "./CampoRegistrarDia";
import { setCampoToken } from "./useCampoAuth";

function definirOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

function montar() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/campo/registrar"]}>
        <Routes>
          <Route path="/campo/registrar" element={<CampoRegistrarDia />} />
          <Route path="/campo" element={<p>Home do campo</p>} />
          <Route path="/campo/login" element={<p>Tela de login</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}
const salvar = () => fireEvent.click(screen.getByRole("button", { name: "Salvar o dia" }));
const digitar = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

/** RPCs do campo: listas vazias e o RDO salvo com sucesso, salvo override. */
function rpcCampo(over: Record<string, unknown> = {}) {
  fake.rpc.mockImplementation(async (nome: string) => {
    if (nome in over) return over[nome] as { data: unknown; error: unknown };
    if (nome === "campo_listar_tarefas") return { data: { ok: true, tarefas: [] }, error: null };
    if (nome === "campo_listar_fornecedores") return { data: { ok: true, fornecedores: [] }, error: null };
    if (nome === "campo_salvar_rdo") return { data: { ok: true, rdo_id: "rdo-1" }, error: null };
    return { data: { ok: true }, error: null };
  });
}

describe("CampoRegistrarDia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    sessionStorage.clear();
    fila.itens.length = 0;
    definirOnline(true);
    setCampoToken("tok-1");
    rpcCampo();
  });

  it("sessão perdida: salvar volta para o login sem gravar nada", async () => {
    sessionStorage.clear();
    montar();
    salvar();
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(fake.rpc).not.toHaveBeenCalledWith("campo_salvar_rdo", expect.anything());
    expect(fila.itens).toHaveLength(0);
  });

  it("online: grava o dia com o efetivo e o texto e volta para a home", async () => {
    montar();
    digitar("Quantas pessoas trabalharam", "8");
    digitar("O que foi feito hoje", "Alvenaria do 2º pavimento");
    salvar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    expect(fake.rpc).toHaveBeenCalledWith(
      "campo_salvar_rdo",
      expect.objectContaining({ p_token: "tok-1", p_efetivo: 8, p_atividades: "Alvenaria do 2º pavimento" })
    );
    expect(toast.success).toHaveBeenCalledWith("Dia registrado");
    expect(fila.itens).toHaveLength(0);
  });

  it("offline: guarda no aparelho e avisa que envia depois", async () => {
    definirOnline(false);
    montar();
    digitar("O que foi feito hoje", "Concretagem");
    salvar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    expect(fake.rpc).not.toHaveBeenCalledWith("campo_salvar_rdo", expect.anything());
    expect(fila.itens).toHaveLength(1);
    expect(fila.itens[0].dia).toEqual(expect.objectContaining({ p_atividades: "Concretagem" }));
    expect(fila.itens[0].rdoId).toBeUndefined();
    expect(toast.success).toHaveBeenCalledWith("Sem conexão agora", expect.anything());
  });

  it("rede cai no meio do envio: não perde o dia, vai para a fila", async () => {
    fake.rpc.mockImplementation(async (nome: string) => {
      if (nome === "campo_salvar_rdo") throw new TypeError("Failed to fetch");
      return { data: { ok: true, tarefas: [], fornecedores: [] }, error: null };
    });
    montar();
    digitar("O que foi feito hoje", "Reboco");
    salvar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    expect(fila.itens).toHaveLength(1);
  });

  it("servidor recusa o dia: avisa e fica na tela com o que foi digitado", async () => {
    rpcCampo({ campo_salvar_rdo: { data: { ok: false, erro: "Obra concluída" }, error: null } });
    montar();
    digitar("O que foi feito hoje", "Pintura");
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível registrar", { description: "Obra concluída" })
    );
    expect(screen.getByLabelText("O que foi feito hoje")).toHaveValue("Pintura");
    expect(fila.itens).toHaveLength(0);
  });

  it("sessão vencida no servidor: limpa o token e volta para o login", async () => {
    rpcCampo({ campo_salvar_rdo: { data: { ok: false, erro: "Sessão inválida" }, error: null } });
    montar();
    digitar("O que foi feito hoje", "Pintura");
    salvar();
    expect(await screen.findByText("Tela de login")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith("Sua sessão expirou", expect.anything());
    expect(sessionStorage.getItem("pilar_campo_token")).toBeNull();
    expect(fila.itens).toHaveLength(0);
  });

  it("data no futuro e efetivo negativo são barrados pelos campos", async () => {
    montar();
    digitar("Data", "2999-01-01");
    digitar("Quantas pessoas trabalharam", "-1");
    salvar();
    await act(async () => {});
    expect(screen.getByLabelText("Data")).toBeInvalid();
    expect(screen.getByLabelText("Quantas pessoas trabalharam")).toBeInvalid();
    expect(fake.rpc).not.toHaveBeenCalledWith("campo_salvar_rdo", expect.anything());
  });

  it("medição: linha incompleta é ignorada; completa sobe com vírgula convertida", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar medição/ }));
    fireEvent.click(screen.getByRole("button", { name: /Adicionar medição/ }));
    const itens = screen.getAllByPlaceholderText("Item");
    const qtds = screen.getAllByPlaceholderText("Qtd");
    const uns = screen.getAllByPlaceholderText("Un.");
    fireEvent.change(itens[0], { target: { value: "Concreto" } });
    fireEvent.change(qtds[0], { target: { value: "2,5" } });
    fireEvent.change(uns[0], { target: { value: "m³" } });
    fireEvent.change(itens[1], { target: { value: "Sem quantidade" } });
    salvar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    const medicoes = fake.rpc.mock.calls.filter(([n]) => n === "campo_registrar_medicao");
    expect(medicoes).toHaveLength(1);
    expect(medicoes[0][1]).toEqual(
      expect.objectContaining({ p_rdo_id: "rdo-1", p_item: "Concreto", p_quantidade: 2.5, p_unidade: "m³" })
    );
  });

  it("medição com quantidade inválida bloqueia o envio com aviso", async () => {
    montar();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar medição/ }));
    fireEvent.change(screen.getByPlaceholderText("Item"), { target: { value: "Tijolo" } });
    fireEvent.change(screen.getByPlaceholderText("Qtd"), { target: { value: "muitos" } });
    fireEvent.change(screen.getByPlaceholderText("Un."), { target: { value: "un" } });
    salvar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Quantidade inválida na medição", { description: "Tijolo" })
    );
    expect(fake.rpc).not.toHaveBeenCalledWith("campo_salvar_rdo", expect.anything());
    expect(fila.itens).toHaveLength(0);
  });

  it("item que falha ao subir fica na fila junto do rdo já criado", async () => {
    rpcCampo({ campo_registrar_impedimento: { data: { ok: false }, error: null } });
    montar();
    const campo = screen.getByPlaceholderText("O que travou (ex: falta de cimento)");
    fireEvent.change(campo, { target: { value: "Falta de cimento" } });
    const adicionar = screen.getAllByRole("button", { name: "Adicionar" });
    fireEvent.click(adicionar[1]);
    salvar();
    expect(await screen.findByText("Home do campo")).toBeInTheDocument();
    expect(toast.warning).toHaveBeenCalledWith("Dia salvo, mas 1 item não subiu", expect.anything());
    expect(fila.itens).toHaveLength(1);
    expect(fila.itens[0].rdoId).toBe("rdo-1");
    expect(fila.itens[0].impedimentos).toEqual([
      { descricao: "Falta de cimento", tipo: "falta_material", enviada: false },
    ]);
  });

  it("criar tarefa nova sem internet avisa e não chama o servidor", async () => {
    definirOnline(false);
    montar();
    fireEvent.change(screen.getByPlaceholderText("Nova tarefa (ex: concretar laje)"), {
      target: { value: "Concretar laje" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar tarefa" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Precisa de internet para criar uma tarefa nova", expect.anything())
    );
    expect(fake.rpc).not.toHaveBeenCalledWith("campo_criar_tarefa", expect.anything());
  });
});
