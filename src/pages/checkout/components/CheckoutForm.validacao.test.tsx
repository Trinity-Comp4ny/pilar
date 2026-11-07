// Validação do formulário de checkout antes de chamar o servidor: CPF/CNPJ com dígito
// verificador, cartão (Luhn e validade), forma de pagamento e o payload que vai para
// a edge pilar-checkout-create.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CheckoutPayload } from "../hooks/useCheckoutCreate";

const { toast } = vi.hoisted(() => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/lib/brasilApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/brasilApi")>("@/lib/brasilApi");
  return { ...actual, lookupCEP: vi.fn().mockResolvedValue(null) };
});

import { CheckoutForm } from "./CheckoutForm";

const CPF_VALIDO = "529.982.247-25";
const CNPJ_VALIDO = "11.222.333/0001-81";
const anoFuturo = String((new Date().getFullYear() + 3) % 100).padStart(2, "0");

function renderForm(props: Partial<Parameters<typeof CheckoutForm>[0]> = {}) {
  const onSubmit = vi.fn<(p: CheckoutPayload) => void>();
  render(
    <CheckoutForm
      planSlug="pro"
      planNome="Pro"
      planValue={690}
      cycle="monthly"
      onSubmit={onSubmit}
      isSubmitting={false}
      errorMessage={null}
      {...props}
    />
  );
  return onSubmit;
}

async function preencherDados(cpfCnpj = CPF_VALIDO) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nome completo"), "Ana Souza");
  await user.type(screen.getByLabelText("Email"), "Ana@Escritorio.com ");
  await user.type(screen.getByLabelText("CPF ou CNPJ"), cpfCnpj);
  await user.type(screen.getByLabelText("Telefone"), "11987654321");
  await user.type(screen.getByLabelText("Nome do escritório"), "Escritório Souza");
  return user;
}

async function preencherCartao(
  user: ReturnType<typeof userEvent.setup>,
  numero = "4111111111111111",
  validade = `12${anoFuturo}`
) {
  await user.type(screen.getByLabelText("Nome impresso no cartão"), "ANA SOUZA");
  await user.type(screen.getByLabelText(/Número do cartão/), numero);
  await user.type(screen.getByLabelText("Validade"), validade);
  await user.type(screen.getByLabelText("CVV"), "123");
  await user.type(screen.getByLabelText("CEP"), "01310100");
  await user.type(screen.getByLabelText("Número"), "100");
}

const pagar = () => screen.getByRole("button", { name: /Pagar/ });

describe("CheckoutForm: validação antes do pagamento", () => {
  beforeEach(() => vi.clearAllMocks());

  it("PIX com dados válidos envia o payload sem cartão, e-mail normalizado e só dígitos", async () => {
    const onSubmit = renderForm();
    const user = await preencherDados();
    await user.click(screen.getByRole("button", { name: "PIX" }));
    await user.click(pagar());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
      nome: "Ana Souza",
      email: "ana@escritorio.com",
      company_name: "Escritório Souza",
      cpf_cnpj: "52998224725",
      telefone: "11987654321",
      plan_slug: "pro",
      billing_cycle: "monthly",
      billing_type: "PIX",
    });
  });

  it("boleto com CNPJ válido também passa", async () => {
    const onSubmit = renderForm({ cycle: "yearly" });
    const user = await preencherDados(CNPJ_VALIDO);
    await user.click(screen.getByRole("button", { name: "Boleto" }));
    await user.click(pagar());
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      cpf_cnpj: "11222333000181",
      billing_type: "BOLETO",
      billing_cycle: "yearly",
    });
  });

  it.each([
    ["dígito verificador errado", "529.982.247-26"],
    ["todos os dígitos iguais", "111.111.111-11"],
    ["tamanho que não é CPF nem CNPJ", "1234567890"],
    ["CNPJ com dígito errado", "11.222.333/0001-82"],
  ])("CPF/CNPJ inválido (%s) é barrado com aviso e não chama o servidor", async (_caso, doc) => {
    const onSubmit = renderForm();
    const user = await preencherDados(doc);
    await user.click(screen.getByRole("button", { name: "PIX" }));
    await user.click(pagar());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("CPF/CNPJ inválido", expect.anything());
  });

  it("formulário vazio não chama o servidor", async () => {
    const onSubmit = renderForm();
    await userEvent.click(pagar());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cartão válido envia número só com dígitos, validade separada e titular com os dados pessoais", async () => {
    const onSubmit = renderForm();
    const user = await preencherDados();
    await preencherCartao(user);
    await user.click(pagar());
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload.billing_type).toBe("CREDIT_CARD");
    expect(payload.credit_card).toEqual({
      holderName: "ANA SOUZA",
      number: "4111111111111111",
      expiryMonth: "12",
      expiryYear: `20${anoFuturo}`,
      ccv: "123",
    });
    expect(payload.credit_card_holder_info).toEqual({
      name: "Ana Souza",
      email: "ana@escritorio.com",
      cpfCnpj: "52998224725",
      postalCode: "01310100",
      addressNumber: "100",
      phone: "11987654321",
    });
  });

  it("número de cartão que não passa no Luhn é barrado antes do servidor", async () => {
    const onSubmit = renderForm();
    const user = await preencherDados();
    await preencherCartao(user, "4111111111111112");
    await user.click(pagar());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Número do cartão inválido");
  });

  it("cartão vencido é barrado antes do servidor", async () => {
    const onSubmit = renderForm();
    const user = await preencherDados();
    await preencherCartao(user, "4111111111111111", "0120");
    await user.click(pagar());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Cartão vencido");
  });

  it("validade com mês inexistente é barrada", async () => {
    const onSubmit = renderForm();
    const user = await preencherDados();
    await preencherCartao(user, "4111111111111111", `13${anoFuturo}`);
    await user.click(pagar());
    expect(onSubmit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("Validade inválida (use MM/AA)");
  });

  it("enquanto envia, o botão fica travado e mostra 'Processando'", () => {
    renderForm({ isSubmitting: true });
    const botao = screen.getByRole("button", { name: /Processando/ });
    expect(botao).toBeDisabled();
  });

  it("erro devolvido pelo servidor (ex.: cartão recusado) aparece no formulário", () => {
    renderForm({ errorMessage: "Falha ao criar assinatura: Asaas: Transação não autorizada." });
    expect(screen.getByText("Falha ao criar assinatura: Asaas: Transação não autorizada.")).toBeInTheDocument();
  });

  it("CEP não encontrado avisa o usuário", async () => {
    renderForm();
    await userEvent.type(screen.getByLabelText("CEP"), "99999999");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("CEP não encontrado"));
  });

  it("o valor do botão é o do plano no ciclo escolhido", () => {
    renderForm({ planValue: 6900, cycle: "yearly" });
    expect(pagar()).toHaveTextContent("R$ 6.900,00");
  });
});
