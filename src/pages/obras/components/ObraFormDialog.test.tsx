import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ObraResumo } from "@/pages/obras/hooks/useObras";

// Nova obra / editar obra: nome obrigatório, taxa de administração entre 0 e 100,
// fim não antes do início, CEP preenche endereço, capacidade do trial abre o desbloqueio.

type Resultado = { data: unknown; error: unknown };
const escritas: Array<{ tabela: string; op: string; payload: unknown; eq?: unknown[] }> = [];
let respostaEscrita: Resultado = { data: { id: "obra-nova" }, error: null };
const rpc = vi.fn();

function builder(tabela: string) {
  let atual: { op: string; payload: unknown; eq?: unknown[] } | null = null;
  const alvo: Record<string, unknown> = {};
  const fim = () => {
    if (atual) escritas.push({ tabela, ...atual });
    return Promise.resolve(atual ? respostaEscrita : { data: [], error: null });
  };
  const proxy: unknown = new Proxy(alvo, {
    get(_t, prop) {
      if (prop === "then") {
        return (ok: (v: Resultado) => unknown, err?: (e: unknown) => unknown) => fim().then(ok, err);
      }
      if (prop === "insert" || prop === "update") {
        return (payload: unknown) => {
          atual = { op: prop, payload };
          return proxy;
        };
      }
      if (prop === "eq") {
        return (...a: unknown[]) => {
          if (atual) atual.eq = a;
          return proxy;
        };
      }
      if (prop === "single" || prop === "maybeSingle") return () => fim();
      return () => proxy;
    },
  });
  return proxy;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (t: string) => builder(t), rpc: (...a: unknown[]) => rpc(...a) },
}));
let podeVerProjetos = true;
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (m: string) => (m === "projetos" ? podeVerProjetos : true) }),
}));
vi.mock("@/pages/meu-trabalho/hooks", () => ({
  useProjetosLite: () => ({ data: [{ id: "proj-1", nome: "Projeto Seed" }] }),
  usePessoasEmpresa: () => ({ data: [{ id: "pes-1", nome: "Ana" }] }),
}));
let isAdmin = true;
vi.mock("@/hooks/useNivelConfianca", () => ({ useNivelConfianca: () => ({ isAdmin }) }));
const lookupCEP = vi.fn();
vi.mock("@/lib/brasilApi", () => ({ lookupCEP: (...a: unknown[]) => lookupCEP(...a) }));
const geocodarCidade = vi.fn();
vi.mock("@/pages/obras/lib/clima", () => ({ geocodarCidade: (...a: unknown[]) => geocodarCidade(...a) }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ObraFormDialog } from "./ObraFormDialog";

// O Switch do Radix mede o thumb com ResizeObserver; o jsdom não tem.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

function montar(obra: ObraResumo | null = null) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(<ObraFormDialog open onOpenChange={onOpenChange} obra={obra} onSaved={onSaved} />, { wrapper: Wrapper });
  return { onOpenChange, onSaved };
}

const digitar = (rotulo: string, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const criar = () => fireEvent.click(screen.getByRole("button", { name: "Criar obra" }));
const inserts = () => escritas.filter((e) => e.op === "insert");

describe("ObraFormDialog: nova obra", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    escritas.length = 0;
    respostaEscrita = { data: { id: "obra-nova" }, error: null };
    rpc.mockResolvedValue({ data: "emp-1", error: null });
    podeVerProjetos = true;
    isAdmin = true;
  });

  it("sem nome mostra o erro e não grava", async () => {
    const { onOpenChange } = montar();
    digitar("Taxa de administração (%)", "10");
    criar();
    expect(await screen.findByText("Dê um nome à obra")).toBeInTheDocument();
    expect(inserts()).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("nome só com espaços também é recusado", async () => {
    montar();
    digitar("Nome da obra *", "    ");
    criar();
    expect(await screen.findByText("Dê um nome à obra")).toBeInTheDocument();
    expect(inserts()).toHaveLength(0);
  });

  it("caminho feliz: grava com a empresa do usuário e os campos normalizados", async () => {
    const { onOpenChange, onSaved } = montar();
    digitar("Nome da obra *", "  Residência Seed  ");
    digitar("Taxa de administração (%)", "12.5");
    digitar("Início previsto", "2026-11-10");
    digitar("Fim previsto", "2027-03-10");
    digitar("Observações", "   ");
    criar();

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(inserts()[0]).toEqual(
      expect.objectContaining({
        tabela: "obras",
        payload: expect.objectContaining({
          empresa_id: "emp-1",
          nome: "Residência Seed",
          status: "planejada",
          modelo_cobranca: "administracao",
          taxa_administracao_pct: 12.5,
          projeto_id: null,
          responsavel_id: null,
          cliente_id: null,
          cep: null,
          data_inicio_prevista: "2026-11-10",
          data_fim_prevista: "2027-03-10",
          observacoes: null,
        }),
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Obra criada");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("taxa acima de 100% é recusada (min/max do campo barram o envio)", async () => {
    const { onSaved } = montar();
    digitar("Nome da obra *", "Obra X");
    digitar("Taxa de administração (%)", "150");
    criar();
    await act(async () => {});
    expect(screen.getByLabelText("Taxa de administração (%)")).toBeInvalid();
    expect(inserts()).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("taxa negativa é recusada (min/max do campo barram o envio)", async () => {
    const { onSaved } = montar();
    digitar("Nome da obra *", "Obra X");
    digitar("Taxa de administração (%)", "-5");
    criar();
    await act(async () => {});
    expect(screen.getByLabelText("Taxa de administração (%)")).toBeInvalid();
    expect(inserts()).toHaveLength(0);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("fim previsto antes do início é recusado", async () => {
    montar();
    digitar("Nome da obra *", "Obra X");
    digitar("Início previsto", "2026-12-01");
    digitar("Fim previsto", "2026-11-01");
    criar();
    expect(await screen.findByText("O fim não pode ser antes do início")).toBeInTheDocument();
    expect(inserts()).toHaveLength(0);
  });

  it("taxa vazia grava zero", async () => {
    const { onSaved } = montar();
    digitar("Nome da obra *", "Obra X");
    criar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(inserts()[0].payload).toEqual(expect.objectContaining({ taxa_administracao_pct: 0 }));
  });

  it("usuário sem empresa: erro amigável e diálogo aberto", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: null });
    const { onOpenChange } = montar();
    digitar("Nome da obra *", "Obra X");
    criar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", {
        description: "Usuário não vinculado a uma empresa",
      })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome da obra *")).toHaveValue("Obra X");
  });

  it("erro do servidor mantém aberto com os dados", async () => {
    respostaEscrita = { data: null, error: { message: "falhou", code: "500" } };
    const { onOpenChange } = montar();
    digitar("Nome da obra *", "Obra X");
    criar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", expect.anything()));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome da obra *")).toHaveValue("Obra X");
  });

  it("capacidade:obras abre o desbloqueio, sem toast de erro", async () => {
    respostaEscrita = { data: null, error: { message: "capacidade:obras", hint: "2" } };
    montar();
    digitar("Nome da obra *", "Terceira obra");
    criar();
    expect(await screen.findByText("Você atingiu um limite do período de teste")).toBeInTheDocument();
    expect(screen.getByText(/o limite de 2 obras do período de teste/)).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("capacidade para não-admin só avisa o administrador", async () => {
    isAdmin = false;
    respostaEscrita = { data: null, error: { message: "capacidade:obras", hint: "2" } };
    montar();
    digitar("Nome da obra *", "Terceira obra");
    criar();
    expect(await screen.findByText(/Só um administrador pode liberar mais capacidade/)).toBeInTheDocument();
  });

  it("sem acesso a projetos o vínculo de projeto some", () => {
    podeVerProjetos = false;
    montar();
    expect(screen.queryByLabelText("Projeto (opcional)")).not.toBeInTheDocument();
  });

  it("CEP válido preenche endereço e coordenadas", async () => {
    lookupCEP.mockResolvedValueOnce({ street: "Rua A", neighborhood: "Centro", city: "Campinas", state: "SP" });
    geocodarCidade.mockResolvedValueOnce([{ latitude: -22.9, longitude: -47.06 }]);
    const { onSaved } = montar();
    digitar("Nome da obra *", "Obra CEP");
    await act(async () => digitar("CEP da obra", "13010000"));
    await waitFor(() => expect(screen.getByLabelText(/Endereço/)).toHaveValue("Rua A, Centro, Campinas, SP"));

    criar();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(inserts()[0].payload).toEqual(
      expect.objectContaining({ cep: "13010000", cidade: "Campinas", latitude: -22.9, longitude: -47.06 })
    );
  });

  it("CEP inexistente avisa; geocode falho deixa endereço sem coordenadas", async () => {
    lookupCEP.mockResolvedValueOnce(null);
    montar();
    await act(async () => digitar("CEP da obra", "00000000"));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("CEP não encontrado"));

    lookupCEP.mockResolvedValueOnce({ street: "Rua B", city: "Xyz", state: "MG" });
    geocodarCidade.mockRejectedValueOnce(new Error("offline"));
    await act(async () => digitar("CEP da obra", "11111111"));
    expect(await screen.findByText(/Sem coordenadas pra este endereço/)).toBeInTheDocument();
  });
});

describe("ObraFormDialog: edição", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    escritas.length = 0;
    respostaEscrita = { data: { id: "obra-1" }, error: null };
  });

  const obra = {
    id: "obra-1",
    nome: "Obra Existente",
    status: "em_andamento",
    modelo_cobranca: "preco_fechado",
    taxa_administracao_pct: 0,
    projeto_id: "proj-1",
    responsavel_id: null,
    cliente_id: null,
    visivel_portal: false,
    cep: "13010000",
    cidade: "Campinas",
    localizacao: "Rua A, Campinas",
    latitude: -22.9,
    longitude: -47.06,
    data_inicio_prevista: "2026-01-01",
    data_fim_prevista: "2026-12-31",
    observacoes: null,
  } as unknown as ObraResumo;

  it("carrega os dados, esconde a taxa em preço fechado e atualiza pelo id", async () => {
    const { onSaved } = montar(obra);
    expect(screen.getByLabelText("Nome da obra *")).toHaveValue("Obra Existente");
    expect(screen.getByLabelText("CEP da obra")).toHaveValue("13010-000");
    expect(screen.queryByLabelText("Taxa de administração (%)")).not.toBeInTheDocument();

    digitar("Nome da obra *", "Obra Renomeada");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const update = escritas.find((e) => e.op === "update");
    expect(update?.eq).toEqual(["id", "obra-1"]);
    expect(update?.payload).toEqual(
      expect.objectContaining({ nome: "Obra Renomeada", taxa_administracao_pct: 0, projeto_id: "proj-1" })
    );
    expect(toast.success).toHaveBeenCalledWith("Obra atualizada");
  });

  it("apagar o nome na edição bloqueia", async () => {
    montar(obra);
    digitar("Nome da obra *", "");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Dê um nome à obra")).toBeInTheDocument();
    expect(escritas).toHaveLength(0);
  });
});
