import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Lead } from "@/hooks/useLeads";
import type { LeadEtapa } from "@/pages/leads/hooks/useLeadEtapas";

/**
 * Tela de Leads: o que cada botão e formulário faz com os dados. Os hooks de
 * dados são substituídos por dublês controláveis; o formulário, o quadro, o
 * detalhe e os diálogos são os reais.
 */

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));

type MutateOpts = { onSuccess?: (data?: unknown) => void; onError?: (e: unknown) => void };
type Mut = { mutate: ReturnType<typeof vi.fn>; isPending: boolean };
/** Mutation dublê: por padrão o servidor responde OK (chama onSuccess com `data`). */
const mut = (data?: unknown): Mut => ({
  mutate: vi.fn((_vars: unknown, opts?: MutateOpts) => opts?.onSuccess?.(data)),
  isPending: false,
});
/** Faz a próxima chamada da mutation falhar no servidor (onSuccess nunca chega). */
const falharNoServidor = (m: Mut) =>
  m.mutate.mockImplementationOnce((_v: unknown, opts?: MutateOpts) => opts?.onError?.(new Error("boom")));

let leads: Lead[] = [];
let leadsState = { isLoading: false, isError: false };
const refetch = vi.fn();
let etapas: LeadEtapa[] = [];
let canEdit = true;
let mocks: Record<string, Mut> = {};

vi.mock("@/hooks/useLeads", () => ({
  useLeads: () => ({ data: leads, ...leadsState, refetch }),
  useCreateLead: () => mocks.createLead,
  useUpdateLeadStatus: () => mocks.updateStatus,
  useConvertLeadToClient: () => mocks.convert,
  useDeleteLead: () => mocks.deleteLead,
  useCreatePropostaFromLead: () => mocks.createProposta,
  useUpdateLead: () => mocks.updateLead,
  useLeadMembers: () => ({ data: [{ id: "u1", first_name: "Carla", last_name: "Souza" }] }),
}));
vi.mock("@/hooks/usePropostas", async (orig) => ({
  ...(await orig<typeof import("@/hooks/usePropostas")>()),
  usePropostas: () => ({ data: [] }),
  useConverterProposta: () => mocks.converterProposta,
}));
vi.mock("@/pages/leads/hooks/useLeadEtapas", () => ({
  useLeadEtapas: () => ({ data: etapas, isLoading: false, isError: false, refetch: vi.fn() }),
}));
vi.mock("@/pages/leads/hooks/useEtapasDoFunil", () => ({
  useEtapasDoFunil: () => ({
    criando: false,
    criarEtapa: vi.fn(),
    setEditandoEtapa: vi.fn(),
    reordenarEtapa: vi.fn(),
    pedirExcluirEtapa: vi.fn(),
    editandoEtapa: null,
    salvarEtapa: vi.fn(),
    salvando: false,
    aEtapaExcluir: null,
    setAEtapaExcluir: vi.fn(),
    confirmarExcluirEtapa: vi.fn(),
    excluindo: false,
  }),
}));
vi.mock("@/hooks/useFeatureAccess", () => ({ useFeatureAccess: () => ({ canEdit, canView: true }) }));
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({
    can: (_f: string, action = "view") => (action === "view" ? true : canEdit),
    getButtonProps: () => ({ disabled: !canEdit, title: "", "aria-disabled": !canEdit }),
    isAdmin: false,
  }),
}));
let isAdmin = true;
let planoAtivo = false;
const openSettings = vi.fn();
const track = vi.fn();
vi.mock("@/lib/analytics", () => ({ analytics: { track: (...a: unknown[]) => track(...a) } }));
vi.mock("@/hooks/useNivelConfianca", () => ({ useNivelConfianca: () => ({ isAdmin }) }));
vi.mock("@/pages/billing/hooks/useMySubscription", () => ({
  useMySubscription: () => ({ data: planoAtivo ? { status: "active" } : null }),
}));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings }) }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/useRecentes", () => ({ useRegistrarPagina: vi.fn() }));
vi.mock("@/components/ui/sidebar", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/sidebar")>()),
  useSidebar: () => ({ state: "expanded", isMobile: false, open: true, setOpenMobile: vi.fn() }),
}));
vi.mock("@/components/ModuleChipNav", () => ({ ModuleChipNav: () => null }));

import Leads from "./index";

const ETAPAS: LeadEtapa[] = [
  { id: "e-novo", nome: "Novo", ordem: 1, cor: null, bucket: "Novo" },
  { id: "e-contato", nome: "Em contato", ordem: 2, cor: null, bucket: "Em contato" },
  { id: "e-ganho", nome: "Ganho", ordem: 3, cor: null, bucket: "Ganho" },
  { id: "e-perdido", nome: "Perdido", ordem: 4, cor: null, bucket: "Perdido" },
];
const ANA: Lead = {
  id: "l1",
  nome: "Ana",
  sobrenome: "Lima",
  email: "ana@alfa.com.br",
  status: "Novo",
  etapa_id: "e-novo",
  empresa_lead: "Alfa Engenharia",
  origem: "Indicação",
};
const BETO: Lead = { id: "l2", nome: "Beto", status: "Em contato", etapa_id: "e-contato", origem: "Site" };

beforeEach(() => {
  vi.clearAllMocks();
  leads = [ANA, BETO];
  leadsState = { isLoading: false, isError: false };
  etapas = ETAPAS;
  canEdit = true;
  isAdmin = true;
  planoAtivo = false;
  mocks = {
    createLead: mut(),
    updateStatus: mut(),
    convert: mut(),
    deleteLead: mut(),
    createProposta: mut({ id: "p-nova" }),
    updateLead: mut(),
    converterProposta: mut("proj-1"),
  };
  try {
    localStorage.clear();
  } catch {
    // sem storage no ambiente: ok
  }
});

const abrir = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Leads />
      </MemoryRouter>
    </QueryClientProvider>
  );

const novoLead = () => screen.getAllByRole("button", { name: /Novo lead/ })[0];
const dialogo = (nome: string | RegExp) => screen.getByRole("dialog", { name: nome });

describe("Leads: criar lead", () => {
  it("salva com o valor convertido para número e fecha o formulário", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(novoLead());
    const form = dialogo("Novo lead");
    await user.type(within(form).getByLabelText("Nome *"), "Carlos");
    await user.type(within(form).getByLabelText(/Email/), "carlos@beta.com");
    await user.type(within(form).getByLabelText("Valor Estimado"), "250000");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(mocks.createLead.mutate).toHaveBeenCalledTimes(1);
    expect(mocks.createLead.mutate.mock.calls[0][0]).toMatchObject({
      nome: "Carlos",
      email: "carlos@beta.com",
      valor_estimado: 2500,
    });
    expect(screen.queryByRole("dialog", { name: "Novo lead" })).not.toBeInTheDocument();
  });

  it("só nome e valor vazio: salva sem valor (campo opcional)", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(novoLead());
    const form = dialogo("Novo lead");
    await user.type(within(form).getByLabelText("Nome *"), "Carlos");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(mocks.createLead.mutate.mock.calls[0][0]).toMatchObject({ nome: "Carlos", valor_estimado: undefined });
  });

  it("sem nome não chama o servidor", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(novoLead());
    const form = dialogo("Novo lead");
    await user.type(within(form).getByLabelText("Valor Estimado"), "100");
    within(form).getByLabelText("Nome *").removeAttribute("required");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(mocks.createLead.mutate).not.toHaveBeenCalled();
    expect(within(form).getByText("Informe o nome do lead")).toBeInTheDocument();
  });

  it("e-mail de lead já existente (qualquer caixa) bloqueia e mantém o formulário aberto", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(novoLead());
    const form = dialogo("Novo lead");
    await user.type(within(form).getByLabelText("Nome *"), "Outra Ana");
    await user.type(within(form).getByLabelText(/Email/), "ANA@alfa.com.br");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(mocks.createLead.mutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Email duplicado", expect.anything());
    expect(dialogo("Novo lead")).toBeInTheDocument();
  });

  it("erro do servidor mantém o formulário aberto com os dados digitados", async () => {
    falharNoServidor(mocks.createLead);
    const user = userEvent.setup();
    abrir();

    await user.click(novoLead());
    const form = dialogo("Novo lead");
    await user.type(within(form).getByLabelText("Nome *"), "Carlos");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(mocks.createLead.mutate).toHaveBeenCalledTimes(1);
    expect(within(dialogo("Novo lead")).getByLabelText("Nome *")).toHaveValue("Carlos");
  });
});

describe("Leads: limite de leads ativos (capacidade:leads)", () => {
  const criarBatendoNoLimite = async () => {
    mocks.createLead.mutate.mockImplementationOnce((_v: unknown, opts?: MutateOpts) =>
      opts?.onError?.({ message: "capacidade:leads", hint: "50", code: "P0001" })
    );
    const user = userEvent.setup();
    abrir();
    await user.click(novoLead());
    const form = dialogo("Novo lead");
    await user.type(within(form).getByLabelText("Nome *"), "Carlos");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));
    return user;
  };

  it("no teste, admin vê o desbloqueio por documento com o limite", async () => {
    await criarBatendoNoLimite();
    expect(screen.getByRole("dialog", { name: "Você atingiu um limite do período de teste" })).toBeInTheDocument();
    expect(screen.getByText(/limite de 50 leads ativos/)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith("trial_limite_atingido", { recurso: "leads", limite: 50 });
    // O formulário continua lá (atrás do diálogo de limite) com o que foi digitado.
    const form = screen
      .getAllByRole("dialog", { hidden: true })
      .find((d) => d.textContent?.startsWith("Novo lead")) as HTMLElement;
    expect(within(form).getByLabelText("Nome *")).toHaveValue("Carlos");
  });

  it("no teste, quem não é admin só pode avisar o administrador", async () => {
    isAdmin = false;
    await criarBatendoNoLimite();
    const aviso = screen.getByRole("alertdialog");
    expect(within(aviso).getByText("Você atingiu um limite do período de teste")).toBeInTheDocument();
    expect(within(aviso).getByRole("button", { name: "Avisar administrador" })).toBeInTheDocument();
  });

  it("com plano ativo, admin é levado aos planos", async () => {
    planoAtivo = true;
    const user = await criarBatendoNoLimite();
    const aviso = screen.getByRole("alertdialog");
    expect(within(aviso).getByText("Você atingiu um limite do plano")).toBeInTheDocument();
    expect(within(aviso).getByText(/limite de 50 leads ativos do seu plano/)).toBeInTheDocument();
    await user.click(within(aviso).getByRole("button", { name: "Ver planos" }));
    expect(openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("com plano ativo, quem não é admin avisa o administrador", async () => {
    planoAtivo = true;
    isAdmin = false;
    await criarBatendoNoLimite();
    const aviso = screen.getByRole("alertdialog");
    expect(within(aviso).getByText("Você atingiu um limite do plano")).toBeInTheDocument();
    expect(within(aviso).getByRole("button", { name: "Avisar administrador" })).toBeInTheDocument();
  });

  it("erro que não é de capacidade não abre o diálogo de limite", async () => {
    falharNoServidor(mocks.createLead);
    const user = userEvent.setup();
    abrir();
    await user.click(novoLead());
    await user.type(within(dialogo("Novo lead")).getByLabelText("Nome *"), "Carlos");
    await user.click(within(dialogo("Novo lead")).getByRole("button", { name: "Salvar" }));
    expect(screen.queryByText(/Você atingiu um limite/)).not.toBeInTheDocument();
  });
});

describe("Leads: editar e excluir", () => {
  const abrirDetalheDaAna = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getAllByText("Ana Lima")[0]);
    return dialogo(/Ana Lima/);
  };

  it("editar pelo detalhe preenche o formulário e envia null nos campos limpos", async () => {
    const user = userEvent.setup();
    abrir();

    const detalhe = await abrirDetalheDaAna(user);
    await user.click(within(detalhe).getByRole("button", { name: "Editar" }));
    const form = dialogo("Editar lead");
    expect(within(form).getByLabelText("Nome *")).toHaveValue("Ana");
    await user.clear(within(form).getByLabelText("Empresa"));
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(mocks.updateLead.mutate).toHaveBeenCalledTimes(1);
    const { id, data } = mocks.updateLead.mutate.mock.calls[0][0] as { id: string; data: Record<string, unknown> };
    expect(id).toBe("l1");
    expect(data).toMatchObject({ nome: "Ana", empresa_lead: null, email: "ana@alfa.com.br" });
    // Valor vazio fica de fora (não apaga o valor real de quem não pode vê-lo).
    expect(data.valor_estimado).toBeUndefined();
  });

  it("editar com o e-mail de outro lead bloqueia (mas o próprio e-mail é aceito)", async () => {
    leads = [ANA, { ...BETO, email: "beto@site.com" }];
    const user = userEvent.setup();
    abrir();

    const detalhe = await abrirDetalheDaAna(user);
    await user.click(within(detalhe).getByRole("button", { name: "Editar" }));
    const form = dialogo("Editar lead");
    const email = within(form).getByLabelText(/Email/);
    await user.clear(email);
    await user.type(email, "beto@site.com");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(mocks.updateLead.mutate).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Email duplicado", expect.anything());
  });

  it("editar com nome apagado não salva", async () => {
    const user = userEvent.setup();
    abrir();

    const detalhe = await abrirDetalheDaAna(user);
    await user.click(within(detalhe).getByRole("button", { name: "Editar" }));
    const form = dialogo("Editar lead");
    const nome = within(form).getByLabelText("Nome *");
    await user.clear(nome);
    nome.removeAttribute("required");
    await user.click(within(form).getByRole("button", { name: "Salvar" }));

    expect(mocks.updateLead.mutate).not.toHaveBeenCalled();
    expect(within(form).getByText("Informe o nome do lead")).toBeInTheDocument();
  });

  it("excluir pede confirmação e só exclui ao confirmar", async () => {
    const user = userEvent.setup();
    abrir();

    const detalhe = await abrirDetalheDaAna(user);
    await user.click(within(detalhe).getByRole("button", { name: "Excluir" }));
    const confirm = screen.getByRole("alertdialog");
    expect(within(confirm).getByText(/Ana Lima/)).toBeInTheDocument();
    expect(mocks.deleteLead.mutate).not.toHaveBeenCalled();

    await user.click(within(confirm).getByRole("button", { name: "Excluir" }));

    expect(mocks.deleteLead.mutate).toHaveBeenCalledWith("l1", expect.anything());
  });

  it("cancelar a exclusão não exclui", async () => {
    const user = userEvent.setup();
    abrir();

    const detalhe = await abrirDetalheDaAna(user);
    await user.click(within(detalhe).getByRole("button", { name: "Excluir" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancelar" }));

    expect(mocks.deleteLead.mutate).not.toHaveBeenCalled();
  });
});

describe("Leads: mover no funil e converter", () => {
  const moverPeloMenu = async (user: ReturnType<typeof userEvent.setup>, destino: string) => {
    // Só o card mobile tem "Mover para" (o quadro desktop move arrastando); ele é
    // renderizado depois do quadro, então é o último menu da página.
    const menus = screen.getAllByRole("button", { name: /Ações|Mais opções|Abrir menu/i });
    await user.click(menus[menus.length - 1]);
    // Submenu do Radix: abre pelo teclado (o hover não existe no jsdom).
    screen.getByRole("menuitem", { name: /Mover para/ }).focus();
    await user.keyboard("{ArrowRight}");
    const item = await screen.findByRole("menuitem", { name: destino });
    item.focus();
    await user.keyboard("{Enter}");
  };

  it("mover para coluna comum só troca a etapa", async () => {
    leads = [ANA];
    const user = userEvent.setup();
    abrir();

    await moverPeloMenu(user, "Em contato");

    expect(mocks.updateStatus.mutate).toHaveBeenCalledWith({ leadId: "l1", etapa: ETAPAS[1] });
  });

  it("mover para Perdido exige motivo antes de gravar", async () => {
    leads = [ANA];
    const user = userEvent.setup();
    abrir();

    await moverPeloMenu(user, "Perdido");
    const dlg = dialogo(/Motivo da Perda/);
    expect(mocks.updateStatus.mutate).not.toHaveBeenCalled();
    expect(within(dlg).getByRole("button", { name: "Confirmar Perda" })).toBeDisabled();

    await user.type(within(dlg).getByRole("textbox"), "  Preço alto  ");
    await user.click(within(dlg).getByRole("button", { name: "Confirmar Perda" }));

    expect(mocks.updateStatus.mutate).toHaveBeenCalledWith(
      { leadId: "l1", etapa: ETAPAS[3], extraFields: { motivo_perda: "Preço alto" } },
      expect.anything()
    );
  });

  it("mover para Ganho abre a conversão em cliente; Criar sem CNPJ converte na coluna escolhida", async () => {
    leads = [ANA];
    const user = userEvent.setup();
    abrir();

    await moverPeloMenu(user, "Ganho");
    const dlg = dialogo(/Lead Ganho/);
    await user.click(within(dlg).getByRole("button", { name: "Criar sem CNPJ" }));

    expect(mocks.convert.mutate).toHaveBeenCalledWith(
      { leadId: "l1", enrichment: null, etapaId: "e-ganho" },
      expect.anything()
    );
    expect(mocks.updateStatus.mutate).not.toHaveBeenCalled();
  });

  it("Ganho sem converter: Apenas marcar como Ganho só move", async () => {
    leads = [ANA];
    const user = userEvent.setup();
    abrir();

    await moverPeloMenu(user, "Ganho");
    await user.click(within(dialogo(/Lead Ganho/)).getByRole("button", { name: "Apenas marcar como Ganho" }));

    expect(mocks.convert.mutate).not.toHaveBeenCalled();
    expect(mocks.updateStatus.mutate).toHaveBeenCalledWith({ leadId: "l1", etapa: ETAPAS[2] }, expect.anything());
  });

  it("lead Ganho ainda sem cliente: Transformar em Cliente usa o mesmo fluxo de CNPJ", async () => {
    leads = [{ ...ANA, status: "Ganho", etapa_id: "e-ganho" }];
    const user = userEvent.setup();
    abrir();

    await user.click(screen.getAllByText("Ana Lima")[0]);
    await user.click(screen.getByRole("button", { name: "Transformar em Cliente" }));
    await user.click(within(dialogo(/Lead Ganho/)).getByRole("button", { name: "Criar sem CNPJ" }));

    expect(mocks.convert.mutate).toHaveBeenCalledWith(
      { leadId: "l1", enrichment: null, etapaId: "e-ganho" },
      expect.anything()
    );
  });

  it("criar proposta pelo detalhe confirma e cria a partir do lead", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(screen.getAllByText("Ana Lima")[0]);
    await user.click(screen.getByRole("button", { name: "Criar proposta" }));
    await user.click(within(dialogo(/Criar proposta/)).getByRole("button", { name: "Confirmar" }));

    expect(mocks.createProposta.mutate).toHaveBeenCalledWith(ANA, expect.anything());
  });
});

describe("Leads: estados da tela, busca e permissão", () => {
  it("sem leads mostra o vazio com o atalho de criar", async () => {
    leads = [];
    const user = userEvent.setup();
    abrir();

    expect(screen.getByText("Nenhum lead cadastrado")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Criar primeiro lead" }));
    expect(dialogo("Novo lead")).toBeInTheDocument();
  });

  it("erro ao carregar mostra o estado de erro com Tentar de novo", async () => {
    leadsState = { isLoading: false, isError: true };
    const user = userEvent.setup();
    abrir();

    expect(screen.getByText("Não foi possível carregar os leads")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("funil sem colunas também cai no estado de erro (nunca um quadro vazio mudo)", () => {
    etapas = [];
    abrir();
    expect(screen.getByText("Não foi possível carregar os leads")).toBeInTheDocument();
  });

  it("busca por empresa filtra e, sem resultado, oferece limpar", async () => {
    const user = userEvent.setup();
    abrir();
    const busca = screen.getAllByPlaceholderText("Buscar por nome, empresa ou email")[0];

    await user.type(busca, "alfa");
    expect(screen.getAllByText("Ana Lima").length).toBeGreaterThan(0);
    expect(screen.queryByText("Beto")).not.toBeInTheDocument();

    await user.clear(busca);
    await user.type(busca, "zzz");
    expect(screen.getByText("Nenhum resultado para esses filtros")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    expect(screen.getAllByText("Beto").length).toBeGreaterThan(0);
  });

  it("sem permissão de edição: Novo lead travado, sem atalho no vazio e sem ações no detalhe", async () => {
    canEdit = false;
    const user = userEvent.setup();
    abrir();

    expect(novoLead()).toBeDisabled();
    await user.click(screen.getAllByText("Ana Lima")[0]);
    const detalhe = dialogo(/Ana Lima/);
    expect(within(detalhe).queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(within(detalhe).queryByRole("button", { name: "Excluir" })).not.toBeInTheDocument();
  });

  it("sem permissão e sem leads, o vazio não oferece criar", () => {
    canEdit = false;
    leads = [];
    abrir();
    expect(screen.queryByRole("button", { name: "Criar primeiro lead" })).not.toBeInTheDocument();
  });
});

describe("Leads: filtros, busca e visão em lista", () => {
  const CARLA: Lead = {
    id: "l3",
    nome: "Carla",
    status: "Novo",
    etapa_id: "e-novo",
    origem: "Indicação",
    responsavel_id: "u1",
    previsao_fechamento: "2026-11-12",
    valor_estimado: 5000,
  };
  const DANI: Lead = {
    id: "l4",
    nome: "Dani",
    status: "Novo",
    etapa_id: "e-novo",
    origem: "Site",
    previsao_fechamento: "2026-10-01",
  };
  const ELIS: Lead = {
    id: "l5",
    nome: "Elis",
    status: "Novo",
    etapa_id: "e-novo",
    previsao_fechamento: "2026-11-28",
  };

  beforeEach(() => {
    leads = [ANA, BETO, CARLA, DANI, ELIS];
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
  });
  afterEach(() => vi.useRealTimers());

  const visiveis = () =>
    ["Ana Lima", "Beto", "Carla", "Dani", "Elis"].filter((n) => screen.queryAllByText(n).length > 0);
  const busca = () =>
    screen
      .getAllByLabelText("Buscar por nome, empresa ou email")
      .find((el) => el.tagName === "INPUT") as HTMLInputElement;

  async function escolher(user: ReturnType<typeof userEvent.setup>, filtro: string, opcao: string) {
    await user.click(screen.getByRole("button", { name: filtro }));
    await user.click(await screen.findByRole("option", { name: opcao }));
  }

  it("busca por nome, empresa ou email", async () => {
    const user = userEvent.setup();
    abrir();
    await user.type(busca(), "alfa");
    expect(visiveis()).toEqual(["Ana Lima"]);
    await user.clear(busca());
    await user.type(busca(), "zzz");
    expect(visiveis()).toEqual([]);
  });

  it("filtra por origem e por responsável (inclusive sem responsável)", async () => {
    const user = userEvent.setup();
    abrir();
    await escolher(user, "Origem", "Site");
    expect(visiveis()).toEqual(["Beto", "Dani"]);
    await user.click(screen.getByRole("button", { name: "Limpar filtro Origem" }));

    await escolher(user, "Responsável", "Carla Souza");
    expect(visiveis()).toEqual(["Carla"]);
    await escolher(user, "Responsável", "Sem responsável");
    expect(visiveis()).toEqual(["Ana Lima", "Beto", "Dani", "Elis"]);
  });

  it("filtra pela previsão de fechamento: 7 dias, vencida e este mês", async () => {
    const user = userEvent.setup();
    abrir();
    await escolher(user, "Previsão", "Fecham em 7 dias");
    expect(visiveis()).toEqual(["Carla"]);
    await escolher(user, "Previsão", "Previsão vencida");
    expect(visiveis()).toEqual(["Dani"]);
    await escolher(user, "Previsão", "Fecham este mês");
    expect(visiveis()).toEqual(["Carla", "Elis"]);
  });

  it("visão em lista mostra a tabela e o clique abre o detalhe", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /Lista/ }));
    const tabela = await screen.findByRole("table");
    const carla = within(tabela).getByText("Carla").closest("tr") as HTMLElement;
    expect(within(carla).getByText("Carla Souza")).toBeInTheDocument();
    expect(within(carla).getByText("12/11/2026")).toBeInTheDocument();
    expect(within(carla).getByText("Indicação")).toBeInTheDocument();
    const beto = within(tabela).getByText("Beto").closest("tr") as HTMLElement;
    expect(within(beto).getAllByText("—").length).toBeGreaterThan(0);

    await user.click(carla);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: /Quadro/ }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
