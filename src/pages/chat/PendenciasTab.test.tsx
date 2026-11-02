import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PendenciasTab } from "./PendenciasTab";
import type { Pendencia } from "./hooks/useAgentePendencias";

const usePendencias = vi.fn();
const useAditivos = vi.fn();
const useHeartbeat = vi.fn();
const useCobranca = vi.fn();
const adiarMutate = vi.fn();
const dispensarMutate = vi.fn();
const enviarMutate = vi.fn();
const decidirMutate = vi.fn();
let podeEditarFinanceiro = true;

vi.mock("@/hooks/useEscopos", () => ({
  usePendenciasAgentes: () => useAditivos(),
  useAprovarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRejeitarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdiarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/hooks/useFeatureAccess", () => ({
  useFeatureAccess: (feature: string) => ({ canEdit: feature === "financeiro" ? podeEditarFinanceiro : true }),
}));
vi.mock("@/pages/chat/hooks/useAgentHeartbeat", () => ({ useAgentHeartbeat: (tipo: string) => useHeartbeat(tipo) }));
vi.mock("@/pages/chat/hooks/useAgentePendencias", () => ({
  useAgentePendencias: () => usePendencias(),
  useAdiarPendencia: () => ({ mutateAsync: adiarMutate }),
  useDispensarPendencia: () => ({ mutateAsync: dispensarMutate }),
  useCobranca: () => useCobranca(),
  useEnviarCobranca: () => ({ mutateAsync: enviarMutate, isPending: false }),
  useDecidirCobranca: () => ({ mutateAsync: decidirMutate, isPending: false }),
}));

const base: Pendencia = {
  id: "1",
  empresa_id: "e",
  tipo: "projeto_atrasado",
  area: "prazos",
  severidade: "medium",
  chave: "k",
  referencia_tipo: null,
  referencia_id: null,
  projeto_id: null,
  titulo: "Projeto atrasado: Aurora",
  detalhe: "Previsão era 20/10/2026",
  dados: {},
  link: "/projetos/p1",
  acao_sugerida: null,
  vence_em: null,
  status: "aberta",
  adiada_ate: null,
  primeira_deteccao: new Date(Date.now() - 5 * 86_400_000).toISOString(),
  ultima_deteccao: new Date().toISOString(),
  resolvida_em: null,
  resolvida_motivo: null,
};
const p = (o: Partial<Pendencia>): Pendencia => ({ ...base, ...o });

const cobranca = p({
  id: "c1",
  tipo: "cobranca_pronta",
  area: "financeiro",
  severidade: "high",
  titulo: "Cobrança pronta: Parcela 2",
  detalhe: "Venceu em 26/10/2026, há 7 dia(s) · etapa 3 de 4",
  acao_sugerida: "enviar_cobranca",
  dados: {
    cobranca_id: "cob1",
    etapa: 3,
    etapa_total: 4,
    destinatario: "financeiro@cliente.test",
    valor: 18500,
    vencimento: "2026-10-26",
    dias: 7,
    parcela_numero: 2,
    parcela_total: 3,
    projeto_nome: "Horizonte",
    cliente_nome: "Cliente Exemplo",
  },
});

const montar = () =>
  render(
    <MemoryRouter>
      <PendenciasTab />
    </MemoryRouter>
  );

describe("PendenciasTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    podeEditarFinanceiro = true;
    useAditivos.mockReturnValue({ isLoading: false, data: [] });
    useHeartbeat.mockImplementation(() => ({
      isLoading: false,
      data: { last_run_at: new Date().toISOString(), last_status: "ok", detail: { encontrados: 0, criados: 0 } },
    }));
    useCobranca.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        id: "cob1",
        etapa: 3,
        status: "rascunho",
        destinatario_email: "financeiro@cliente.test",
        assunto: "Parcela 2 de 3, Horizonte, vencida em 26/10",
        abertura: "Olá, Cliente Exemplo. A parcela 2 de 3 do projeto Horizonte venceu em 26/10 e segue em aberto.",
        fatos: { media_atraso_historico: 6 },
      },
    });
    usePendencias.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        cobranca,
        p({
          id: "u1",
          severidade: "critical",
          titulo: "Pagamento atrasado: Licença",
          area: "financeiro",
          tipo: "pagamento_atrasado",
        }),
        p({ id: "m1", severidade: "medium", titulo: "Prazo da disciplina: Hidráulica" }),
        p({
          id: "l1",
          severidade: "low",
          titulo: "Projeto sem prazo de entrega: Casa",
          tipo: "projeto_sem_prazo",
          area: "planejamento",
        }),
      ],
    });
  });

  it("agrupa em prontas para aprovar, urgentes, da semana e para planejar", () => {
    montar();
    expect(screen.getByRole("heading", { name: /Prontos para você aprovar/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Urgente/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Esta semana/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Para planejar/ })).toBeInTheDocument();
    const resumo = screen.getByRole("group", { name: "Resumo das pendências" });
    expect(within(resumo).getByText("Prontos para aprovar").previousSibling).toHaveTextContent("1");
    expect(within(resumo).getByText("Em aberto").previousSibling).toHaveTextContent("4");
  });

  it("a baixa urgência fica recolhida até pedir para ver", async () => {
    montar();
    expect(screen.queryByText(/Projeto sem prazo de entrega: Casa/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Ver" }));
    expect(screen.getByText(/Projeto sem prazo de entrega: Casa/)).toBeInTheDocument();
  });

  it("filtra por área", async () => {
    montar();
    await userEvent.click(screen.getByRole("button", { name: /^Prazos/ }));
    expect(screen.getByText("Prazo da disciplina: Hidráulica")).toBeInTheDocument();
    expect(screen.queryByText(/Pagamento atrasado: Licença/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Cobrança pronta/)).not.toBeInTheDocument();
  });

  it("mostra os fatos da cobrança e abre o painel com o e-mail preparado", async () => {
    montar();
    expect(screen.getByText("R$ 18.500,00")).toBeInTheDocument();
    expect(screen.getByText("Etapa 3 de 4")).toBeInTheDocument();
    expect(screen.getByText(/Preparei:/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    const painel = await screen.findByRole("dialog");
    expect(within(painel).getByText("financeiro@cliente.test")).toBeInTheDocument();
    expect(within(painel).getByText("Parcela 2 de 3, Horizonte, vencida em 26/10")).toBeInTheDocument();
    expect(within(painel).getByRole("button", { name: "Aprovar e enviar" })).toBeEnabled();
  });

  it("aprovar envia sem texto quando o usuário não editou", async () => {
    enviarMutate.mockResolvedValue({ email: "financeiro@cliente.test", etapa: 3 });
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Aprovar e enviar" }));
    expect(enviarMutate).toHaveBeenCalledWith({ cobrancaId: "cob1", abertura: undefined });
  });

  it("aprovar leva o texto editado", async () => {
    enviarMutate.mockResolvedValue({ email: "financeiro@cliente.test", etapa: 3 });
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Editar" }));
    const campo = screen.getByLabelText(/Abertura preparada pelo agente/);
    await userEvent.clear(campo);
    await userEvent.type(campo, "Texto novo com mais de vinte caracteres.");
    await userEvent.click(screen.getByRole("button", { name: "Aprovar e enviar" }));
    expect(enviarMutate).toHaveBeenCalledWith({
      cobrancaId: "cob1",
      abertura: "Texto novo com mais de vinte caracteres.",
    });
  });

  it("recusar e já cobrei por fora usam a decisão do banco", async () => {
    decidirMutate.mockResolvedValue(undefined);
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    await userEvent.click(await screen.findByRole("button", { name: "Já cobrei por fora" }));
    expect(decidirMutate).toHaveBeenCalledWith({ cobrancaId: "cob1", status: "externa" });
  });

  it("quem só visualiza o financeiro não envia nem decide", async () => {
    podeEditarFinanceiro = false;
    montar();
    await userEvent.click(screen.getByRole("button", { name: "Revisar e enviar" }));
    expect(await screen.findByRole("button", { name: "Aprovar e enviar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Recusar" })).toBeDisabled();
    expect(screen.getByText(/Seu perfil só visualiza o financeiro/)).toBeInTheDocument();
  });

  it("explica o guardião sem projeto para vigiar e leva ao projeto", () => {
    usePendencias.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [
        p({ id: "o1", tipo: "orcamento_ausente", area: "orcamento", severidade: "low", link: "/projetos/p1#escopo" }),
        p({ id: "o2", tipo: "orcamento_ausente", area: "orcamento", severidade: "low", link: "/projetos/p2#escopo" }),
      ],
    });
    montar();
    expect(screen.getByText(/2 projetos em andamento estão sem orçamento por disciplina/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Definir orçamento/ })).toHaveAttribute("href", "/projetos/p1#escopo");
  });

  it("sem nada em aberto orienta a primeira ação", () => {
    usePendencias.mockReturnValue({ isLoading: false, isError: false, data: [] });
    montar();
    expect(screen.getByText("Nada esperando você agora")).toBeInTheDocument();
  });

  it("falha ao atualizar mantém a lista e oferece tentar de novo", () => {
    usePendencias.mockReturnValue({ isLoading: false, isError: true, data: [cobranca], refetch: vi.fn() });
    montar();
    expect(screen.getByText(/Não foi possível atualizar as pendências/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
    expect(screen.getByText(/Cobrança pronta: Parcela 2/)).toBeInTheDocument();
  });

  it("alerta quando o guardião de margem não roda há mais de 30 horas", () => {
    useHeartbeat.mockImplementation(() => ({
      isLoading: false,
      data: {
        last_run_at: new Date(Date.now() - 40 * 3_600_000).toISOString(),
        last_status: "ok",
        detail: { encontrados: 0 },
      },
    }));
    montar();
    expect(screen.getByText(/Guardião de margem sem sinal de execução recente/)).toBeInTheDocument();
  });
});
