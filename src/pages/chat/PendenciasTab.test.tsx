import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PendenciasTab } from "./PendenciasTab";
import type { Pendencia } from "./hooks/useAgentePendencias";

const toastMock = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast: toastMock }));
const usePendencias = vi.fn();
const useAditivos = vi.fn();
const useHeartbeat = vi.fn();
const useCobranca = vi.fn();
const adiarMutate = vi.fn();
const dispensarMutate = vi.fn();
const enviarMutate = vi.fn();
const decidirMutate = vi.fn();
const salvarOrcamentoMutate = vi.fn();
const aplicarPlanoMutate = vi.fn();
let podeEditarFinanceiro = true;
let orcamento: { nome: string; contrato: number | null; podeVerValor: boolean; disciplinas: string[] } = {
  nome: "Casa Jardim",
  contrato: 50000,
  podeVerValor: true,
  disciplinas: ["Arquitetônico", "Estrutural"],
};
let planoPrazo: {
  nome: string;
  entrega: string | null;
  cliente: { id: string; nome: string; email: string | null } | null;
  disciplinas: { nome: string; status: string | null; data_fim: string | null }[];
} = {
  nome: "Aurora",
  entrega: "2026-11-07",
  cliente: { id: "cl1", nome: "Cliente Exemplo", email: "cliente@exemplo.test" },
  disciplinas: [
    { nome: "Hidráulica", status: "Em Andamento", data_fim: "2026-11-05" },
    { nome: "Estrutural", status: "Concluído", data_fim: "2026-10-30" },
  ],
};

vi.mock("@/hooks/useEscopos", () => ({
  usePendenciasAgentes: () => useAditivos(),
  useAprovarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRejeitarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useAdiarEscopo: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
const useFeatureAccessMock = { canEditProjetos: true };
vi.mock("@/hooks/useFeatureAccess", () => ({
  useFeatureAccess: (feature: string) => ({
    canEdit: feature === "financeiro" ? podeEditarFinanceiro : useFeatureAccessMock.canEditProjetos,
  }),
}));
vi.mock("@/pages/chat/hooks/useAgentHeartbeat", () => ({ useAgentHeartbeat: (tipo: string) => useHeartbeat(tipo) }));
vi.mock("@/pages/chat/hooks/useAgentePendencias", () => ({
  useAgentePendencias: () => usePendencias(),
  useAdiarPendencia: () => ({ mutateAsync: adiarMutate }),
  useDispensarPendencia: () => ({ mutateAsync: dispensarMutate }),
  useCobranca: () => useCobranca(),
  useEnviarCobranca: () => ({ mutateAsync: enviarMutate, isPending: false }),
  useDecidirCobranca: () => ({ mutateAsync: decidirMutate, isPending: false }),
  useOrcamentoGuiado: () => ({ isLoading: false, isError: false, data: orcamento }),
  useSalvarOrcamentoGuiado: () => ({ mutateAsync: salvarOrcamentoMutate, isPending: false }),
  usePlanoPrazo: () => ({ isLoading: false, isError: false, data: planoPrazo }),
  useAplicarPlanoPrazo: () => ({ mutateAsync: aplicarPlanoMutate, isPending: false }),
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
    orcamento = {
      nome: "Casa Jardim",
      contrato: 50000,
      podeVerValor: true,
      disciplinas: ["Arquitetônico", "Estrutural"],
    };
    planoPrazo = {
      nome: "Aurora",
      entrega: "2026-11-07",
      cliente: { id: "cl1", nome: "Cliente Exemplo", email: "cliente@exemplo.test" },
      disciplinas: [
        { nome: "Hidráulica", status: "Em Andamento", data_fim: "2026-11-05" },
        { nome: "Estrutural", status: "Concluído", data_fim: "2026-10-30" },
      ],
    };
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

  describe("orçamento guiado", () => {
    const orcamentoAusente = p({
      id: "o1",
      tipo: "orcamento_ausente",
      area: "orcamento",
      severidade: "low",
      titulo: "Sem orçamento por disciplina: Casa Jardim",
      projeto_id: "proj1",
      link: "/projetos/proj1#escopo",
    });

    const abrir = async () => {
      usePendencias.mockReturnValue({ isLoading: false, isError: false, data: [orcamentoAusente] });
      montar();
      await userEvent.click(screen.getByRole("button", { name: "Ver" }));
      await userEvent.click(screen.getByRole("button", { name: "Definir orçamento" }));
      return await screen.findByRole("dialog");
    };

    it("lista as disciplinas e calcula custo e margem na hora", async () => {
      const painel = await abrir();
      await userEvent.type(within(painel).getByLabelText("Horas de Arquitetônico"), "80");
      await userEvent.type(within(painel).getByLabelText("Custo por hora de Arquitetônico"), "12000");
      const resumo = within(painel).getByRole("group", { name: "Resumo do orçamento" });
      expect(within(resumo).getByText("Custo orçado").previousSibling).toHaveTextContent("R$ 9.600,00");
      expect(within(resumo).getByText("Margem prevista").previousSibling).toHaveTextContent("80,8%");
    });

    it("só salva disciplina com horas e custo e leva os números do usuário", async () => {
      salvarOrcamentoMutate.mockResolvedValue(undefined);
      const painel = await abrir();
      const salvar = within(painel).getByRole("button", { name: "Salvar orçamento" });
      expect(salvar).toBeDisabled();
      await userEvent.type(within(painel).getByLabelText("Horas de Estrutural"), "100");
      await userEvent.type(within(painel).getByLabelText("Custo por hora de Estrutural"), "15000");
      await userEvent.type(within(painel).getByLabelText("Horas de Arquitetônico"), "40");
      expect(salvar).toBeEnabled();
      await userEvent.click(salvar);
      expect(salvarOrcamentoMutate).toHaveBeenCalledWith({
        projetoId: "proj1",
        linhas: [{ disciplina: "Estrutural", horasEstimadas: 100, custoHora: 150 }],
      });
    });

    it("avisa quando o custo orçado passa do contrato", async () => {
      const painel = await abrir();
      await userEvent.type(within(painel).getByLabelText("Horas de Estrutural"), "1000");
      await userEvent.type(within(painel).getByLabelText("Custo por hora de Estrutural"), "10000");
      expect(within(painel).getByText(/passa do valor do contrato/)).toBeInTheDocument();
    });

    it("projeto sem disciplinas orienta a cadastrar", async () => {
      orcamento = { ...orcamento, disciplinas: [] };
      const painel = await abrir();
      expect(within(painel).getByText(/ainda não tem disciplinas/)).toBeInTheDocument();
      expect(within(painel).getByRole("button", { name: "Salvar orçamento" })).toBeDisabled();
    });
  });

  describe("prazo em risco", () => {
    const prazo = p({
      id: "z1",
      tipo: "projeto_prazo_proximo",
      area: "prazos",
      severidade: "high",
      titulo: "Prazo próximo: Aurora",
      projeto_id: "proj2",
      dados: { dias_para_vencer: 5 },
    });

    const abrir = async () => {
      usePendencias.mockReturnValue({ isLoading: false, isError: false, data: [prazo] });
      montar();
      await userEvent.click(screen.getByRole("button", { name: "Revisar plano" }));
      return await screen.findByRole("dialog");
    };

    it("mostra só as disciplinas abertas e explica que não prevê data", async () => {
      const painel = await abrir();
      expect(within(painel).getByText("Hidráulica")).toBeInTheDocument();
      expect(within(painel).queryByText("Estrutural")).toBeNull();
      expect(within(painel).getByText(/não prevê a nova data/)).toBeInTheDocument();
    });

    it("aplica aviso e comunicado, sem aditivo, e não exige dias", async () => {
      aplicarPlanoMutate.mockResolvedValue([
        { acao: "avisar", ok: true },
        { acao: "comunicado", ok: true },
      ]);
      const painel = await abrir();
      await userEvent.click(within(painel).getByRole("button", { name: "Aplicar selecionadas" }));
      const chamada = aplicarPlanoMutate.mock.calls[0][0];
      expect(chamada.avisar).toBe(true);
      expect(chamada.aditivo).toBeNull();
      expect(chamada.comunicado).toMatchObject({
        clienteId: "cl1",
        assunto: "Projeto Aurora: acompanhamento da entrega",
      });
      expect(chamada.comunicado.mensagem).toContain("1 disciplina(s) em andamento");
    });

    it("aditivo exige os dias antes de liberar o botão", async () => {
      const painel = await abrir();
      await userEvent.click(within(painel).getByLabelText("Criar rascunho de aditivo de prazo"));
      const aplicar = within(painel).getByRole("button", { name: "Aplicar selecionadas" });
      expect(aplicar).toBeDisabled();
      await userEvent.type(within(painel).getByLabelText("Dias a mais"), "11");
      expect(aplicar).toBeEnabled();
    });

    it("cliente sem e-mail não permite comunicar", async () => {
      planoPrazo = { ...planoPrazo, cliente: { id: "cl1", nome: "Cliente Exemplo", email: null } };
      const painel = await abrir();
      expect(within(painel).getByLabelText("Comunicar o cliente por e-mail")).toBeDisabled();
      expect(within(painel).getByText(/sem e-mail cadastrado/)).toBeInTheDocument();
    });

    it("falha parcial trava o que já foi aplicado e reenvia só o que falhou", async () => {
      aplicarPlanoMutate
        .mockResolvedValueOnce([
          { acao: "avisar", ok: true },
          { acao: "comunicado", ok: false, erro: "503" },
        ])
        .mockResolvedValueOnce([{ acao: "comunicado", ok: true }]);
      const painel = await abrir();
      await userEvent.click(within(painel).getByRole("button", { name: "Aplicar selecionadas" }));
      expect(await within(painel).findByText("já aplicado")).toBeInTheDocument();
      expect(within(painel).getByLabelText(/Avisar os responsáveis/)).toBeDisabled();

      await userEvent.click(within(painel).getByRole("button", { name: "Aplicar selecionadas" }));
      const segunda = aplicarPlanoMutate.mock.calls[1][0];
      expect(segunda.avisar).toBe(false);
      expect(segunda.aditivo).toBeNull();
      expect(segunda.comunicado).not.toBeNull();
    });

    it("quem só visualiza não aplica", async () => {
      useFeatureAccessMock.canEditProjetos = false;
      const painel = await abrir();
      expect(within(painel).getByRole("button", { name: "Aplicar selecionadas" })).toBeDisabled();
      useFeatureAccessMock.canEditProjetos = true;
    });
  });
  describe("adiar e dispensar", () => {
    // O primeiro card da fila é a cobrança (c1).
    async function abrirMenu(user: ReturnType<typeof userEvent.setup>) {
      await user.click(screen.getAllByRole("button", { name: /Adiar/ })[0]);
    }

    it("adiar avisa por quantos dias; falha avisa para atualizar", async () => {
      const user = userEvent.setup();
      adiarMutate.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("x"));
      montar();
      await abrirMenu(user);
      await user.click((await screen.findAllByRole("menuitem", { name: /^Por / }))[0]);
      expect(adiarMutate).toHaveBeenCalledWith({ id: "c1", dias: expect.any(Number) });
      expect(toastMock.success).toHaveBeenCalledWith(expect.stringMatching(/^Adiado por/), expect.anything());

      await abrirMenu(user);
      await user.click((await screen.findAllByRole("menuitem", { name: /^Por / }))[0]);
      expect(toastMock.error).toHaveBeenCalledWith("Não foi possível adiar", expect.anything());
    });

    it("dispensar avisa; falha avisa para atualizar", async () => {
      const user = userEvent.setup();
      dispensarMutate.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("x"));
      montar();
      await abrirMenu(user);
      await user.click(await screen.findByRole("menuitem", { name: "Dispensar" }));
      expect(dispensarMutate).toHaveBeenCalledWith("c1");
      expect(toastMock.success).toHaveBeenCalledWith("Pendência dispensada", expect.anything());

      await abrirMenu(user);
      await user.click(await screen.findByRole("menuitem", { name: "Dispensar" }));
      expect(toastMock.error).toHaveBeenCalledWith("Não foi possível dispensar", expect.anything());
    });
  });
});
