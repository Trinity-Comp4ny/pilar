import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { supabaseFake } from "@/hooks/testing/supabaseFake";
import type { Cliente } from "@/hooks/useClientes";
import { ClienteFormDialog } from "./ClienteFormDialog";

/**
 * Formulário de cliente com o hook real (useClientes) e o Supabase dublado na
 * fronteira: o que o usuário digita é o que chega no banco, e o que é inválido
 * não chega.
 */

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/hooks/testing/supabaseFake")).supabaseFake.client,
}));
const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("sonner", () => ({
  toast: { error: (...a: unknown[]) => toastError(...a), success: (...a: unknown[]) => toastSuccess(...a) },
}));
vi.mock("@/lib/analytics", () => ({ analytics: { track: vi.fn() } }));
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureException: vi.fn() } }));
const lookupCEP = vi.fn();
vi.mock("@/lib/brasilApi", async (orig) => ({
  ...(await orig<typeof import("@/lib/brasilApi")>()),
  lookupCEP: (...a: unknown[]) => lookupCEP(...a),
}));

beforeEach(() => {
  vi.clearAllMocks();
  supabaseFake.reset();
  supabaseFake.respondRpc("get_user_empresa_id", { data: "emp-1" });
});

const abrir = (cliente?: Cliente | null) => {
  const onOpenChange = vi.fn();
  const onSaved = vi.fn();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ClienteFormDialog open onOpenChange={onOpenChange} cliente={cliente} onSaved={onSaved} />
    </QueryClientProvider>
  );
  return { onOpenChange, onSaved };
};

const salvar = () => screen.getByRole("button", { name: /^(Salvar|Atualizar)$/ });
const inserts = () => supabaseFake.callsTo("clientes", "insert");

describe("ClienteFormDialog: criar", () => {
  it("pessoa física: grava só dígitos do CPF/telefone e fecha", async () => {
    const user = userEvent.setup();
    const { onOpenChange, onSaved } = abrir();

    expect(screen.getByRole("heading", { name: "Novo cliente" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome *"), "  Ana ");
    await user.type(screen.getByLabelText("Sobrenome"), "Lima");
    await user.type(screen.getByLabelText("CPF"), "52998224725");
    expect(screen.getByLabelText("CPF")).toHaveValue("529.982.247-25");
    await user.type(screen.getByLabelText("Email"), "ana@lima.com");
    await user.type(screen.getByLabelText("Telefone"), "14999998888");
    await user.click(salvar());

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onSaved).toHaveBeenCalled();
    expect(inserts()[0].payload).toMatchObject({
      tipo_pessoa: "PF",
      nome: "Ana",
      sobrenome: "Lima",
      cpf_cnpj: "52998224725",
      email: "ana@lima.com",
      contato: "(14) 99999-8888",
      endereco: null,
      empresa_id: "emp-1",
    });
    expect(toastSuccess).toHaveBeenCalledWith("Cliente cadastrado", expect.anything());
  });

  it("pessoa jurídica: pede razão social, valida CNPJ e não manda sobrenome", async () => {
    const user = userEvent.setup();
    abrir();

    await user.click(screen.getByRole("button", { name: /Pessoa jurídica/ }));
    expect(screen.queryByLabelText("Sobrenome")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Razão social *"), "Alfa Engenharia LTDA");
    await user.type(screen.getByLabelText("CNPJ"), "11222333000181");
    await user.click(salvar());

    await waitFor(() => expect(inserts()).toHaveLength(1));
    expect(inserts()[0].payload).toMatchObject({
      tipo_pessoa: "PJ",
      nome: "Alfa Engenharia LTDA",
      sobrenome: null,
      cpf_cnpj: "11222333000181",
    });
  });

  it("documento é opcional", async () => {
    const user = userEvent.setup();
    abrir();
    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.click(salvar());
    await waitFor(() => expect(inserts()).toHaveLength(1));
    expect(inserts()[0].payload).toMatchObject({ cpf_cnpj: null, email: null });
  });
});

describe("ClienteFormDialog: cenários negativos", () => {
  it("sem nome não grava e mostra o erro", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = abrir();

    await user.type(screen.getByLabelText("Email"), "ana@lima.com");
    await user.click(salvar());

    expect(screen.getByText("Informe o nome")).toBeInTheDocument();
    expect(inserts()).toHaveLength(0);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("PJ sem razão social mostra a mensagem própria", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /Pessoa jurídica/ }));
    await user.click(salvar());
    expect(screen.getByText("Informe a razão social")).toBeInTheDocument();
  });

  it("e-mail inválido não grava", async () => {
    const user = userEvent.setup();
    abrir();
    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.type(screen.getByLabelText("Email"), "ana@");
    await user.click(salvar());
    expect(screen.getByText("E-mail inválido")).toBeInTheDocument();
    expect(inserts()).toHaveLength(0);
  });

  it.each([
    ["CPF incompleto", "5299822", "CPF deve ter 11 dígitos"],
    ["CPF com dígito errado", "52998224700", "CPF inválido"],
    ["CPF repetido", "11111111111", "CPF inválido"],
  ])("%s não grava", async (_caso, doc, msg) => {
    const user = userEvent.setup();
    abrir();
    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.type(screen.getByLabelText("CPF"), doc);
    await user.click(salvar());
    expect(screen.getByText(msg)).toBeInTheDocument();
    expect(inserts()).toHaveLength(0);
  });

  it.each([
    ["CNPJ incompleto", "1122233300", "CNPJ deve ter 14 dígitos"],
    ["CNPJ com dígito errado", "11222333000100", "CNPJ inválido"],
  ])("%s não grava", async (_caso, doc, msg) => {
    const user = userEvent.setup();
    abrir();
    await user.click(screen.getByRole("button", { name: /Pessoa jurídica/ }));
    await user.type(screen.getByLabelText("Razão social *"), "Alfa");
    await user.type(screen.getByLabelText("CNPJ"), doc);
    await user.click(salvar());
    expect(screen.getByText(msg)).toBeInTheDocument();
    expect(inserts()).toHaveLength(0);
  });

  it("CPF/CNPJ já cadastrado: avisa e mantém o formulário aberto com os dados", async () => {
    supabaseFake.respond("clientes", "insert", {
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "clientes_empresa_cpf_cnpj_key"',
      },
    });
    const user = userEvent.setup();
    const { onOpenChange } = abrir();

    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.type(screen.getByLabelText("CPF"), "52998224725");
    await user.click(salvar());

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("CPF/CNPJ já cadastrado", {
        description: "Este documento já pertence a outro cliente.",
      })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Nome *")).toHaveValue("Ana");
  });

  it("erro genérico do servidor avisa e não fecha", async () => {
    supabaseFake.respond("clientes", "insert", { error: { message: "network down" } });
    const user = userEvent.setup();
    const { onOpenChange } = abrir();

    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.click(salvar());

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Erro ao salvar", { description: "Confira os dados e tente de novo." })
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

describe("ClienteFormDialog: editar", () => {
  const CLIENTE: Cliente = {
    id: "c1",
    nome: "Alfa Engenharia",
    tipo_pessoa: null,
    cpf_cnpj: "11222333000181",
    endereco: "Rua A",
    contato: "",
    email: "contato@alfa.com",
    contas_bancarias: [{ banco: "Itaú", agencia: "1234", conta: "5678-9", tipo: "corrente", is_primary: true }],
    chaves_pix: [],
  };

  it("deduz PJ pelo documento, preenche e atualiza pelo id", async () => {
    const user = userEvent.setup();
    abrir(CLIENTE);

    expect(screen.getByRole("heading", { name: "Editar cliente" })).toBeInTheDocument();
    expect(screen.getByLabelText("Razão social *")).toHaveValue("Alfa Engenharia");
    expect(screen.getByLabelText("CNPJ")).toHaveValue("11.222.333/0001-81");
    await user.clear(screen.getByLabelText("Email"));
    await user.click(salvar());

    await waitFor(() => expect(supabaseFake.callsTo("clientes", "update")).toHaveLength(1));
    const [upd] = supabaseFake.callsTo("clientes", "update");
    expect(upd.payload).toMatchObject({ tipo_pessoa: "PJ", email: null, cpf_cnpj: "11222333000181" });
    expect(upd.chain).toContainEqual(["eq", ["id", "c1"]]);
    expect(inserts()).toHaveLength(0);
    expect(toastSuccess).toHaveBeenCalledWith("Cliente atualizado", expect.anything());
  });
});

describe("ClienteFormDialog: dados bancários, PIX e CEP", () => {
  const abrirBanco = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole("button", { name: /Dados bancários/ }));
  };

  it("conta incompleta não entra na lista", async () => {
    const user = userEvent.setup();
    abrir();
    await abrirBanco(user);
    await user.type(screen.getByPlaceholderText("Nome do banco"), "Itaú");
    await user.click(screen.getByRole("button", { name: "Adicionar conta" }));
    expect(toastError).toHaveBeenCalledWith("Dados incompletos", expect.anything());
    expect(screen.queryByRole("button", { name: "Remover conta" })).not.toBeInTheDocument();
  });

  it("primeira conta vira principal e vai no payload", async () => {
    const user = userEvent.setup();
    abrir();
    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await abrirBanco(user);
    await user.type(screen.getByPlaceholderText("Nome do banco"), "Itaú");
    await user.type(screen.getByPlaceholderText("0000"), "1234");
    await user.type(screen.getByPlaceholderText("000000-0"), "567890");
    await user.click(screen.getByRole("button", { name: "Adicionar conta" }));
    await user.click(salvar());

    await waitFor(() => expect(inserts()).toHaveLength(1));
    const contas = (inserts()[0].payload as { contas_bancarias: { banco: string; is_primary: boolean }[] })
      .contas_bancarias;
    expect(contas).toHaveLength(1);
    expect(contas[0]).toMatchObject({ banco: "Itaú", is_primary: true });
  });

  it("chave PIX inválida ou repetida é recusada", async () => {
    const user = userEvent.setup();
    abrir();
    await abrirBanco(user);
    const pix = screen.getByPlaceholderText(/CPF, CNPJ, e-mail/);

    await user.type(pix, "xx");
    await user.click(screen.getByRole("button", { name: "Adicionar chave PIX" }));
    expect(toastError).toHaveBeenCalledWith("Chave inválida", expect.anything());

    await user.clear(pix);
    await user.type(pix, "ana@lima.com");
    await user.click(screen.getByRole("button", { name: "Adicionar chave PIX" }));
    await user.type(pix, "ana@lima.com");
    await user.click(screen.getByRole("button", { name: "Adicionar chave PIX" }));
    expect(toastError).toHaveBeenCalledWith("Chave duplicada", expect.anything());
    expect(screen.getAllByRole("button", { name: "Remover chave PIX" })).toHaveLength(1);
  });

  it("CEP válido preenche o endereço; CEP não encontrado avisa", async () => {
    lookupCEP.mockResolvedValueOnce({ street: "Rua das Flores", neighborhood: "Centro", city: "Bauru", state: "SP" });
    lookupCEP.mockResolvedValueOnce(null);
    const user = userEvent.setup();
    abrir();
    const cep = screen.getByLabelText("CEP");

    await user.type(cep, "17000000");
    await user.tab();
    await waitFor(() => expect(screen.getByLabelText("Endereço")).toHaveValue("Rua das Flores, Centro, Bauru/SP"));

    await user.clear(cep);
    await user.type(cep, "99999999");
    await user.tab();
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("CEP não encontrado"));
  });

  it("CEP incompleto não consulta", async () => {
    const user = userEvent.setup();
    abrir();
    await user.type(screen.getByLabelText("CEP"), "1700");
    await user.tab();
    expect(lookupCEP).not.toHaveBeenCalled();
  });
});
