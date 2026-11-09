import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// O formulário em três passos: nome é o único obrigatório, validado no passo 1
// antes de avançar e de novo no salvar. Capacidade do trial abre o desbloqueio.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...a),
    from: () => ({
      select: () => ({ is: () => ({ order: () => Promise.resolve({ data: [] }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
  },
}));
vi.mock("@/hooks/useProjetoDisciplinas", () => ({
  useProjetoDisciplinas: () => ({ data: undefined }),
  useBulkSaveDisciplinas: () => ({ mutateAsync: vi.fn().mockResolvedValue(undefined) }),
}));
let podeFinanceiro = true;
vi.mock("@/hooks/usePermissions", () => ({
  usePermissions: () => ({ can: (m: string) => (m === "financeiro" ? podeFinanceiro : true) }),
}));
let isAdmin = true;
vi.mock("@/hooks/useNivelConfianca", () => ({ useNivelConfianca: () => ({ isAdmin }) }));
let assinaturaStatus: string | null = null;
const openSettings = vi.fn();
vi.mock("@/pages/billing/hooks/useMySubscription", () => ({
  useMySubscription: () => ({ data: assinaturaStatus ? { status: assinaturaStatus } : null }),
}));
vi.mock("@/contexts/SettingsModalContext", () => ({ useSettingsModal: () => ({ openSettings }) }));
vi.mock("./DisciplinaDetailDialog", () => ({ DisciplinaDetailDialog: () => null }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { ProjetoFormDialog } from "./ProjetoFormDialog";

function montar() {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  render(
    <ProjetoFormDialog
      open
      onOpenChange={onOpenChange}
      editProjeto={null}
      clientes={[{ id: "c1", nome: "Construtora Seed" }]}
      pessoas={[{ id: "p1", nome: "Ana" }]}
      disciplinas={[{ id: "d1", nome: "Estrutural" }]}
      templatesData={[]}
      currentUser={{ name: "Dev", email: "dev@local.test" }}
      onSaved={onSaved}
      existingDisciplinas={[]}
    />,
    { wrapper: Wrapper }
  );
  return { onOpenChange, onSaved };
}

const proximo = () => fireEvent.click(screen.getByRole("button", { name: /Próximo/ }));

describe("ProjetoFormDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    podeFinanceiro = true;
    isAdmin = true;
    assinaturaStatus = null;
    rpc.mockResolvedValue({ data: "novo-id", error: null });
  });

  it("não avança do passo 1 sem nome e mostra o erro no campo", () => {
    montar();
    proximo();
    expect(screen.getByText("Informe o nome do projeto")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do Projeto *")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Cliente e localização")).toBeInTheDocument();
  });

  it("nome só com espaços também é recusado", () => {
    montar();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "   " } });
    proximo();
    expect(screen.getByText("Informe o nome do projeto")).toBeInTheDocument();
  });

  it("o erro some quando o usuário começa a digitar", () => {
    montar();
    proximo();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "C" } });
    expect(screen.queryByText("Informe o nome do projeto")).not.toBeInTheDocument();
  });

  it("caminho feliz: nome, avança dois passos e salva", async () => {
    const { onOpenChange, onSaved } = montar();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "Residência Seed" } });
    proximo();
    expect(screen.getByText("Valor, parcelas e datas")).toBeInTheDocument();
    proximo();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(rpc).toHaveBeenCalledWith("create_projeto_completo", expect.objectContaining({ p_nome: "Residência Seed" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("erro do servidor mantém o diálogo com os dados e mostra toast", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "falha" } });
    const { onOpenChange } = montar();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "Residência Seed" } });
    proximo();
    proximo();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Erro ao salvar", expect.anything()));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("button", { name: "Salvar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /Identificação/ }));
    expect(screen.getByLabelText("Nome do Projeto *")).toHaveValue("Residência Seed");
  });

  it("capacidade:projetos abre o desbloqueio por documento para admin", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "capacidade:projetos", hint: "5" } });
    montar();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "Sexto" } });
    proximo();
    proximo();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Você atingiu um limite do período de teste")).toBeInTheDocument();
    expect(screen.getByText(/o limite de 5 projetos ativos do período de teste/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar documento" })).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("capacidade para quem não é admin: só avisa o administrador", async () => {
    isAdmin = false;
    rpc.mockResolvedValueOnce({ data: null, error: { message: "capacidade:projetos", hint: "5" } });
    montar();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "Sexto" } });
    proximo();
    proximo();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(/Só um administrador pode liberar mais capacidade/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar documento" })).not.toBeInTheDocument();
  });

  it("com plano ativo, o limite é do plano: admin vai para os planos", async () => {
    assinaturaStatus = "active";
    rpc.mockResolvedValueOnce({ data: null, error: { message: "capacidade:projetos", hint: "20" } });
    montar();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "Vigésimo primeiro" } });
    proximo();
    proximo();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText("Você atingiu um limite do plano")).toBeInTheDocument();
    expect(screen.getByText(/o limite de 20 projetos ativos do seu plano/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirmar documento" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver planos" }));
    expect(openSettings).toHaveBeenCalledWith("pagamento");
  });

  it("com plano ativo, quem não é admin só avisa o administrador", async () => {
    assinaturaStatus = "active";
    isAdmin = false;
    rpc.mockResolvedValueOnce({ data: null, error: { message: "capacidade:projetos", hint: "20" } });
    montar();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "X" } });
    proximo();
    proximo();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

    expect(await screen.findByText(/Só um administrador pode trocar de plano/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver planos" })).not.toBeInTheDocument();
  });

  it("cancelar com alteração pede confirmação antes de descartar", () => {
    const { onOpenChange } = montar();
    fireEvent.change(screen.getByLabelText("Nome do Projeto *"), { target: { value: "Rascunho" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.getByText("Descartar alterações?")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Descartar alterações" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("cancelar sem alteração fecha direto", () => {
    const { onOpenChange } = montar();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByText("Descartar alterações?")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("passos à frente ficam travados antes de validar o passo 1", () => {
    montar();
    expect(screen.getByRole("button", { name: /Disciplinas/ })).toBeDisabled();
  });
});
