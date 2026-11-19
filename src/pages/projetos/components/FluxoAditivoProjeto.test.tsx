import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AprovarAditivoProjeto, NovoAditivoProjeto } from "@/components/AditivoProjetoDialogs";
import { useResumoAditivos } from "@/hooks/useAditivosProjeto";
import { ProjetoHistoricoTab } from "./ProjetoHistoricoTab";
import { RegistrosProjeto } from "./RegistrosProjeto";
import { ProjetoRevisoesTab } from "./ProjetoRevisoesTab";

const { rpc, from, toast } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc, from } }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));
vi.mock("@/hooks/useFornecedorDetalhe", () => ({
  useFornecedoresLite: () => ({ data: [{ id: "f1", nome: "Fornecedor A" }] }),
}));
vi.mock("@/components/portal/EntregaFormDialog", () => ({
  EntregaFormDialog: ({
    onCreated,
    onOpenChange,
  }: {
    onCreated: () => void;
    onOpenChange: (open: boolean) => void;
  }) => (
    <button
      onClick={() => {
        onCreated();
        onOpenChange(false);
      }}
    >
      Confirmar entrega
    </button>
  ),
}));
vi.mock("@/components/portal/PortalEntregas", () => ({
  EntregasContent: ({
    acoesEntrega,
    onPublicarRevisao,
  }: {
    acoesEntrega?: (entrega: object) => ReactNode;
    onPublicarRevisao?: (entrega: object) => void;
  }) => {
    const entrega = {
      id: "entrega-1",
      titulo: "Planta revisada",
      descricao: "Descrição",
      resposta_cliente: "Pedido de ampliação",
      projeto_disciplina_id: "d1",
    };
    return (
      <>
        {acoesEntrega?.(entrega)}
        <button onClick={() => onPublicarRevisao?.(entrega)}>Revisar planta</button>
      </>
    );
  },
}));

const disciplinas = [{ id: "d1", nome: "Estruturas" }];
const pessoas = [{ id: "p1", nome: "Ana" }];
const grupos = [
  { id: "g1", nome: "Original", quantidade: 2 },
  { id: "g2", nome: "Extra", quantidade: 1 },
];
const previa = { grupos, cliente: true, contrato: 5000, aditivo: 150, saldo: 3000, linhas: [] };
let erroConsulta = false;
let erroConfirmacao = false;
let erroAtividade = false;
let erroCriacao = false;
let podeCobrar = true;
let queryClient: QueryClient;
let chain: Record<string, ReturnType<typeof vi.fn>>;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
function preencher(label: string | RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}
function clicar(name: string | RegExp) {
  fireEvent.click(screen.getByRole("button", { name }));
}
const ok = (data: unknown) => ({ data, error: null });
const fail = () => ({ data: null, error: new Error("falhou") });

beforeEach(() => {
  vi.clearAllMocks();
  erroConsulta = erroConfirmacao = erroAtividade = erroCriacao = false;
  podeCobrar = true;
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rpc.mockImplementation(async (nome, args) => {
    if (nome === "rpc_prever_cobranca_aditivo") {
      if (erroConsulta) return fail();
      return ok({
        ...previa,
        cliente: podeCobrar,
        grupos: podeCobrar ? grupos : [],
        linhas:
          args.p_grupo || args.p_vencimento
            ? [{ ...(args.p_grupo ? { id: "parcela-1" } : {}), vencimento: "2027-02-02", anterior: 1000, novo: 1150 }]
            : [],
      });
    }
    if (nome === "rpc_confirmar_cobranca_aditivo") return erroConfirmacao ? fail() : ok(null);
    if (nome === "rpc_criar_aditivo_projeto") return erroCriacao ? fail() : ok("aditivo-novo");
    if (nome === "rpc_registrar_atividade_projeto") return erroAtividade ? fail() : ok("visita-nova");
    return erroConsulta ? fail() : ok({ original: 5000, total: 5150, aprovados: 150 });
  });
  from.mockImplementation((table: string) => {
    const filtros: Record<string, unknown> = {};
    const consulta = Object.fromEntries(
      ["select", "eq", "not", "in", "order", "gte", "lte", "range", "limit"].map((op) => [
        op,
        vi.fn((key: string, value: unknown) => {
          if (op === "eq" || op === "range") filtros[key] = value;
          return consulta;
        }),
      ])
    );
    consulta.then = vi.fn((resolve: (v: unknown) => unknown) => Promise.resolve(resolve(retorno())));
    chain = consulta;
    return consulta;
    function retorno() {
      if (erroConsulta) return fail();
      if (table === "v_projeto_historico") {
        const linha = {
          chave: "c1",
          origem_id: "ad1",
          tipo: "aditivo_cobranca",
          disciplina_id: "d1",
          disciplina_nome: "Estruturas",
          ocorrido_em: "2026-11-18T14:00:00Z",
          detalhe: "Ampliação",
          autor_nome: "Ana",
          dados: {
            versao: 1,
            resposta: "Aceito",
            resultado: "Executado",
            responsavel: "Ana",
            fornecedor: "Fornecedor A",
            local_canal: "Loja A",
            duracao: 30,
            proximo_passo: "Medir",
            anexo: "https://example.com/arquivo",
            avaliar_cobranca: true,
            comprovante: "Registro comercial",
            contrato: 5000,
            aditivo: 150,
            linhas: [{ id: "pc1", vencimento: "2027-02-02", anterior: 1000, novo: 1150 }],
          },
        };
        return ok(filtros[30] ? [] : Array.from({ length: 30 }, (_, i) => ({ ...linha, chave: `c${i}` })));
      }
      if (filtros.tipo === "aditivo_criado")
        return ok([
          { origem_id: "ad1", detalhe: "Já registrado", dados: { entrega_id: "entrega-1", atividade_id: "v1" } },
          { origem_id: null, detalhe: "Sem vínculo", dados: {} },
        ]);
      return ok([
        {
          id: "v1",
          tipo: "visita",
          ocorrido_em: "2026-11-18T14:00:00Z",
          disciplina_id: "d1",
          detalhe: "Vistoria",
          dados: { resultado: "Feita", avaliar_cobranca: true },
        },
        {
          id: "s1",
          tipo: "suporte",
          ocorrido_em: "2026-11-18T15:00:00Z",
          disciplina_id: null,
          detalhe: "Atendimento",
          dados: {},
        },
      ]);
    }
  });
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

describe("Fluxo de aditivos e histórico", () => {
  it("cria rascunho com origem, tolera falha e invalida a lista ao salvar", async () => {
    const fechar = vi.fn();
    const criado = vi.fn();
    const invalidar = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <NovoAditivoProjeto
        projetoId="projeto"
        origem={{ entregaId: "entrega-1" }}
        disciplinas={disciplinas}
        fechar={fechar}
        criado={criado}
      />,
      { wrapper }
    );
    expect(screen.getByRole("button", { name: "Salvar rascunho" })).toBeDisabled();
    preencher("Descrição", "Ampliação");
    preencher("Motivo", "Pedido do cliente");
    preencher("Disciplina", "d1");
    preencher("Valor adicional", "15000");
    erroCriacao = true;
    clicar("Salvar rascunho");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    erroCriacao = false;
    clicar("Salvar rascunho");
    await waitFor(() => expect(criado).toHaveBeenCalledWith("aditivo-novo"));
    expect(rpc).toHaveBeenLastCalledWith(
      "rpc_criar_aditivo_projeto",
      expect.objectContaining({
        p_projeto_id: "projeto",
        p_entrega_id: "entrega-1",
        p_disciplina_id: "d1",
        p_valor: 150,
      })
    );
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["escopos"] });
    clicar("Cancelar");
    expect(fechar).toHaveBeenCalledTimes(2);
  });

  it("distribui só no grupo escolhido e pede nova prévia se a cobrança mudar", async () => {
    const fechar = vi.fn();
    render(<AprovarAditivoProjeto projetoId="p1" aditivoId="ad1" descricao="Ampliação" fechar={fechar} />, { wrapper });
    await screen.findByText("Contrato atualizado");
    fireEvent.click(screen.getByLabelText("Distribuir nas próximas parcelas"));
    preencher("Grupo de parcelas do contrato", "g2");
    await screen.findByRole("list", { name: "Prévia das parcelas" });
    preencher(/Aceite do cliente/, " registro ");
    erroConfirmacao = true;
    clicar("Aprovar e registrar cobrança");
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(fechar).not.toHaveBeenCalled();
    erroConfirmacao = false;
    await waitFor(() => expect(screen.getByRole("button", { name: "Aprovar e registrar cobrança" })).toBeEnabled());
    clicar("Aprovar e registrar cobrança");
    await waitFor(() => expect(fechar).toHaveBeenCalled());
    expect(rpc).toHaveBeenLastCalledWith(
      "rpc_confirmar_cobranca_aditivo",
      expect.objectContaining({
        p_aditivo: "ad1",
        p_grupo: "g2",
        p_aceite: "registro",
      })
    );
    fireEvent.click(screen.getByLabelText("Cobrar o aditivo à parte"));
    preencher("Primeiro vencimento", "2027-02-02");
    preencher("Parcelas mensais", "2");
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("rpc_prever_cobranca_aditivo", {
        p_aditivo: "ad1",
        p_vencimento: "2027-02-02",
        p_parcelas: 2,
      })
    );
    clicar("Cancelar");
  });

  it("explica quando a cobrança está indisponível e consulta o resumo", async () => {
    podeCobrar = false;
    const a = render(<AprovarAditivoProjeto projetoId="p1" aditivoId="ad1" descricao="Ampliação" fechar={vi.fn()} />, {
      wrapper,
    });
    await screen.findByText(/Vincule um cliente/);
    expect(screen.getByLabelText("Distribuir nas próximas parcelas")).toBeDisabled();
    a.unmount();
    const { result } = renderHook(() => useResumoAditivos("p1"), { wrapper });
    await waitFor(() => expect(result.current.data?.total).toBe(5150));
    erroConsulta = true;
    const b = renderHook(() => useResumoAditivos("p2"), { wrapper });
    await waitFor(() => expect(b.result.current.isError).toBe(true));
    render(<AprovarAditivoProjeto projetoId="p2" aditivoId="ad2" descricao="Ampliação" fechar={vi.fn()} />, {
      wrapper,
    });
    await screen.findByText("Não foi possível carregar as opções de cobrança.");
    preencher("Primeiro vencimento", "2027-02-02");
    await screen.findByText("Confira os dados para calcular a prévia.");
  });

  it("registra visita com dados comerciais, abre aditivo vinculado e mantém suporte com falha aberto", async () => {
    render(<RegistrosProjeto projetoId="p1" pessoas={pessoas} disciplinas={disciplinas} canEdit podeCriarAditivo />, {
      wrapper,
    });
    await screen.findByText("Aditivo · Já registrado");
    clicar("Avaliar e criar aditivo");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Vistoria");
    clicar("Cancelar");
    clicar("Registrar visita");
    const registro = screen.getByRole("dialog", { name: "Registrar visita" });
    expect(within(registro).getByRole("button", { name: "Salvar" })).toBeDisabled();
    for (const [label, value] of Object.entries({
      "Data e hora": "2026-11-18T14:00",
      "Local ou loja": "Loja A",
      Responsável: "p1",
      Disciplina: "d1",
      Fornecedor: "f1",
      "Duração em minutos": "25",
      Resumo: "Visita ao cliente",
      Resultado: "Feita",
      "Próximo passo": "Medir",
      "Link do anexo": "https://example.com/ata",
    }))
      preencher(label, value);
    fireEvent.click(screen.getByLabelText("Avaliar cobrança"));
    clicar("Salvar");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Visita registrada"));
    expect(rpc).toHaveBeenCalledWith(
      "rpc_registrar_atividade_projeto",
      expect.objectContaining({
        p_tipo: "visita",
        p_responsavel: "p1",
        p_fornecedor: "f1",
        p_duracao: 25,
        p_avaliar_cobranca: true,
      })
    );
    clicar("Registrar suporte");
    preencher("Data e hora", "2026-11-18T14:00");
    preencher("Canal", "Telefone");
    preencher("Resumo", "Contato");
    preencher("Resultado", "Respondido");
    erroAtividade = true;
    clicar("Salvar");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível registrar a atividade."));
    clicar("Cancelar");
  });

  it("vincula revisão, abre aditivo existente e invalida a revisão publicada", async () => {
    const abrir = vi.fn();
    const invalidar = vi.spyOn(queryClient, "invalidateQueries");
    render(
      <ProjetoRevisoesTab
        projetoId="p1"
        revisoesInternas={2}
        abrirDisciplinas={vi.fn()}
        podeCriarAditivo
        abrirAditivos={abrir}
      />,
      { wrapper }
    );
    fireEvent.click(await screen.findByRole("button", { name: "Aditivo · Já registrado" }));
    expect(abrir).toHaveBeenCalledWith("ad1");
    clicar("Criar aditivo");
    expect(screen.getByLabelText("Descrição")).toHaveValue("Planta revisada");
    expect(screen.getByLabelText("Motivo")).toHaveValue("Pedido de ampliação");
    clicar("Cancelar");
    clicar("Publicar revisão");
    clicar("Confirmar entrega");
    clicar("Revisar planta");
    clicar("Confirmar entrega");
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ["projeto-timeline", "p1"] });
  });

  it("filtra o histórico e carrega a próxima página", async () => {
    const abrir = vi.fn();
    render(<ProjetoHistoricoTab projetoId="p1" disciplinas={disciplinas} abrirAditivos={abrir} />, { wrapper });
    await screen.findByRole("button", { name: "Carregar eventos anteriores" });
    expect(screen.getAllByText("Ampliação")).toHaveLength(30);
    const botoes = screen.getAllByRole("button", { name: /aditivo/i });
    fireEvent.click(botoes[0]);
    expect(abrir).toHaveBeenCalledWith("ad1");
    clicar("Carregar eventos anteriores");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Carregar eventos anteriores" })).toBeNull());
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "aditivo_cobranca" } });
    fireEvent.change(await screen.findByLabelText("De"), { target: { value: "2026-11-01" } });
    fireEvent.change(await screen.findByLabelText("Até"), { target: { value: "2026-11-30" } });
    await waitFor(() => expect(chain.lte).toHaveBeenCalledWith("ocorrido_em", "2026-11-30T23:59:59.999999-03:00"));
  });

  it("mostra as falhas de leitura do histórico e da atividade", async () => {
    erroConsulta = true;
    render(
      <>
        <ProjetoHistoricoTab projetoId="p1" disciplinas={[]} />
        <RegistrosProjeto projetoId="p1" pessoas={[]} disciplinas={[]} canEdit={false} podeCriarAditivo={false} />
      </>,
      { wrapper }
    );
    await screen.findByText("Não foi possível carregar o histórico.");
    await screen.findByText("Não foi possível carregar visitas e suporte.");
  });
});
