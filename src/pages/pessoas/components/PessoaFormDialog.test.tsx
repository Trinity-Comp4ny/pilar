import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChainQuery, ChainResult } from "@/test/supabaseChain";
import { PessoaFormDialog } from "./PessoaFormDialog";
import type { Pessoa } from "../types";

const h = vi.hoisted(() => ({
  resolve: vi.fn<(q: ChainQuery) => ChainResult>(),
  calls: [] as ChainQuery[],
  rpc: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", async () => {
  const { createSupabaseFrom } = await import("@/test/supabaseChain");
  const chain = createSupabaseFrom((q) => h.resolve(q));
  h.calls = chain.calls;
  return { supabase: { from: chain.from, rpc: h.rpc } };
});
vi.mock("sonner", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Formulário grande digitado tecla a tecla: passa de 5s com a suíte inteira em paralelo.
vi.setConfig({ testTimeout: 15000 });

const PESSOA: Pessoa = {
  id: "p1",
  nome: "Rita Alves",
  primeiro_nome: "Rita",
  sobrenome: "Alves",
  cpf: "***.***.***-12",
  tipo_contrato: "clt",
  status: "ativo",
  cargo: "Arquiteta",
  telefone: "",
  email: "rita@seed.test",
  salario_fixo: undefined,
  contas_bancarias: [],
  chaves_pix: [],
  pode_ver_sensivel: false,
};

function renderDialog(editPessoa: Pessoa | null = null) {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  render(<PessoaFormDialog open onOpenChange={onOpenChange} editPessoa={editPessoa} onSaved={onSaved} />);
  return { onOpenChange, onSaved, user: userEvent.setup() };
}

async function preencherMinimo(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText("Nome"), "Rita");
  await user.type(screen.getByPlaceholderText("Sobrenome"), "Alves");
  await user.type(screen.getByPlaceholderText("Ex: Arquiteto, Projetista"), "Arquiteta");
  await user.type(screen.getByPlaceholderText("email@exemplo.com"), "rita@seed.test");
}

beforeEach(() => {
  vi.clearAllMocks();
  h.calls.length = 0;
  h.rpc.mockResolvedValue({ data: "e1", error: null });
  h.resolve.mockReturnValue({ error: null });
});

describe("Equipe › PessoaFormDialog", () => {
  it("campos obrigatórios vazios mostram erros e nada é gravado", async () => {
    const { user } = renderDialog();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Nome é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Sobrenome é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Cargo é obrigatório")).toBeInTheDocument();
    expect(screen.getByText("Email é obrigatório")).toBeInTheDocument();
    expect(h.calls).toHaveLength(0);
  });

  it("email e CPF inválidos são recusados", async () => {
    const { user } = renderDialog();
    await preencherMinimo(user);
    await user.clear(screen.getByPlaceholderText("email@exemplo.com"));
    await user.type(screen.getByPlaceholderText("email@exemplo.com"), "rita@");
    await user.type(screen.getByPlaceholderText("000.000.000-00"), "11111111111");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Email inválido")).toBeInTheDocument();
    expect(screen.getByText("CPF inválido")).toBeInTheDocument();
    expect(h.calls).toHaveLength(0);
  });

  it("cadastro mínimo grava na empresa do usuário e fecha", async () => {
    const { user, onOpenChange, onSaved } = renderDialog();
    await preencherMinimo(user);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const ins = h.calls.find((c) => c.op === "insert");
    expect(ins?.table).toBe("pessoas");
    expect(ins?.payload).toMatchObject({
      nome: "Rita Alves",
      cargo: "Arquiteta",
      email: "rita@seed.test",
      empresa_id: "e1",
      cpf: null,
      salario_fixo: null,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sem empresa identificada não grava e avisa", async () => {
    h.rpc.mockResolvedValue({ data: null, error: null });
    const { user, onSaved } = renderDialog();
    await preencherMinimo(user);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith(
        "Não foi possível identificar sua empresa. Recarregue a página e tente de novo."
      )
    );
    expect(h.calls.some((c) => c.op === "insert")).toBe(false);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("CPF duplicado vira mensagem de negócio e o diálogo continua aberto", async () => {
    h.resolve.mockReturnValue({
      error: { code: "23505", message: 'duplicate key value violates unique constraint "pessoas_empresa_cpf_key"' },
    });
    const { user, onOpenChange } = renderDialog();
    await preencherMinimo(user);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("CPF já cadastrado na empresa"));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByPlaceholderText("Nome")).toHaveValue("Rita");
  });

  it("email duplicado vira mensagem de negócio", async () => {
    h.resolve.mockReturnValue({ error: { code: "23505", message: "pessoas_empresa_email_key" } });
    const { user } = renderDialog();
    await preencherMinimo(user);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Email já cadastrado na empresa"));
  });

  it("PJ exige CNPJ", async () => {
    const { user } = renderDialog({ ...PESSOA, tipo_contrato: "pj", pode_ver_sensivel: true });
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText("CNPJ é obrigatório para PJ")).toBeInTheDocument();
    expect(h.calls).toHaveLength(0);
  });

  it("conta bancária digitada pela metade bloqueia o salvamento", async () => {
    const { user } = renderDialog();
    await preencherMinimo(user);
    await user.click(screen.getByRole("button", { name: /Dados bancários/ }));
    await user.type(screen.getByPlaceholderText("Nome do banco"), "Banco Seed");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("Conta bancária incompleta", expect.anything()));
    expect(h.calls).toHaveLength(0);
  });

  it("chave PIX inválida bloqueia o salvamento", async () => {
    const { user } = renderDialog();
    await preencherMinimo(user);
    await user.click(screen.getByRole("button", { name: /Dados bancários/ }));
    await user.type(screen.getByPlaceholderText("CPF, CNPJ, e-mail, celular ou chave aleatória"), "xx");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith("Chave PIX inválida", {
        description: "Corrija ou limpe o campo antes de salvar",
      })
    );
    expect(h.calls).toHaveLength(0);
  });

  it("quem não vê folha edita sem ver nem sobrescrever dados sensíveis", async () => {
    const { user, onSaved } = renderDialog(PESSOA);
    expect(screen.queryByText(/Salário Fixo/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Dados bancários/ })).not.toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText("Ex: Arquiteto, Projetista"));
    await user.type(screen.getByPlaceholderText("Ex: Arquiteto, Projetista"), "Coordenadora");
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const up = h.calls.find((c) => c.op === "update");
    expect(up?.payload).toMatchObject({ cargo: "Coordenadora" });
    for (const campo of ["cpf", "salario_fixo", "valor_m2", "contas_bancarias", "chaves_pix"]) {
      expect(up?.payload).not.toHaveProperty(campo);
    }
    expect(up?.filters).toContainEqual(["eq", "id", "p1"]);
  });

  // Regressão: o CPF mascarado da view pessoas_safe reprovava a validação de
  // CPF num campo desabilitado e o coordenador com acesso de equipe não salvava.
  it("CPF mascarado aparece desabilitado e não bloqueia o salvamento", async () => {
    const { user, onSaved } = renderDialog(PESSOA);
    const cpf = screen.getByPlaceholderText("000.000.000-00");
    expect(cpf).toHaveValue("***.***.***-12");
    expect(cpf).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(screen.queryByText("CPF inválido")).not.toBeInTheDocument();
  });

  it("quem vê folha grava os campos sensíveis na edição", async () => {
    const { user, onSaved } = renderDialog({ ...PESSOA, cpf: "", pode_ver_sensivel: true });
    expect(screen.getByText(/Salário Fixo/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(h.calls.find((c) => c.op === "update")?.payload).toHaveProperty("salario_fixo");
  });
});
