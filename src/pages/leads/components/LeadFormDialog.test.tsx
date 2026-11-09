import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LeadFormDialog, EMPTY_LEAD_FORM, type LeadFormData } from "./LeadFormDialog";

const toastError = vi.fn();
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

/**
 * Formulário de lead (criar/editar): o Salvar só chega no onSubmit com nome
 * preenchido e e-mail/CNPJ válidos. Os erros aparecem no campo e num toast.
 */

const members = [{ id: "u1", first_name: "Carla", last_name: "Souza" }];

function Harness({
  onSubmit,
  initial = EMPTY_LEAD_FORM,
  mode = "create",
  onOpenChange = vi.fn(),
  isPending = false,
}: {
  onSubmit: (data: LeadFormData) => void;
  initial?: LeadFormData;
  mode?: "create" | "edit";
  onOpenChange?: (o: boolean) => void;
  isPending?: boolean;
}) {
  const [data, setData] = useState(initial);
  return (
    <LeadFormDialog
      open
      onOpenChange={onOpenChange}
      mode={mode}
      formData={data}
      onFormChange={setData}
      onSubmit={() => onSubmit(data)}
      isPending={isPending}
      members={members}
    />
  );
}

const salvar = () => screen.getByRole("button", { name: "Salvar" });

beforeEach(() => toastError.mockClear());

describe("LeadFormDialog: caminho feliz", () => {
  it("preenche os campos e envia com máscaras aplicadas", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    expect(screen.getByRole("heading", { name: "Novo lead" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.type(screen.getByLabelText("Sobrenome"), "Lima");
    await user.type(screen.getByLabelText("Empresa"), "Alfa Engenharia");
    await user.type(screen.getByLabelText("CNPJ"), "11222333000181");
    await user.type(screen.getByLabelText(/Email/), "ana@alfa.com.br");
    await user.type(screen.getByLabelText("Telefone"), "14999998888");
    await user.type(screen.getByLabelText("Valor Estimado"), "150000");
    await user.type(screen.getByLabelText("Notas"), "Indicação do João");
    await user.click(salvar());

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      nome: "Ana",
      sobrenome: "Lima",
      empresa_lead: "Alfa Engenharia",
      cnpj: "11.222.333/0001-81",
      email: "ana@alfa.com.br",
      contato: "(14) 99999-8888",
      valor_estimado: expect.stringMatching(/^R\$\s1\.500,00$/),
      notas: "Indicação do João",
    });
    expect(toastError).not.toHaveBeenCalled();
  });

  it("só o nome é obrigatório: os demais campos podem ficar vazios", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.click(salvar());

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("campo de dinheiro aceita só dígitos (não aceita valor negativo)", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    const valor = screen.getByLabelText("Valor Estimado");

    await user.type(valor, "-50abc");

    expect((valor as HTMLInputElement).value).toMatch(/^R\$\s0,50$/);
  });

  it("modo edição mostra o título e os dados atuais", () => {
    render(
      <Harness
        mode="edit"
        onSubmit={vi.fn()}
        initial={{ ...EMPTY_LEAD_FORM, nome: "Ana", email: "ana@alfa.com.br", valor_estimado: "R$ 10,00" }}
      />
    );
    expect(screen.getByRole("heading", { name: "Editar lead" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome *")).toHaveValue("Ana");
    expect(screen.getByLabelText("Valor Estimado")).toHaveValue("R$ 10,00");
  });
});

describe("LeadFormDialog: cenários negativos", () => {
  it("sem nome (só valor preenchido) não salva e mostra o erro no campo", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Valor Estimado"), "5000");
    // Contorna o `required` nativo para exercitar a validação do próprio formulário.
    screen.getByLabelText("Nome *").removeAttribute("required");
    await user.click(salvar());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Informe o nome do lead")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome *")).toHaveAttribute("aria-invalid", "true");
    expect(toastError).toHaveBeenCalledWith("Revise os campos destacados", expect.anything());
  });

  it("nome só com espaços conta como vazio", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nome *"), "   ");
    await user.click(salvar());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Informe o nome do lead")).toBeInTheDocument();
  });

  it("o erro do nome some quando o usuário digita", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText("Nome *"), " ");
    await user.click(salvar());
    expect(screen.getByText("Informe o nome do lead")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Nome *"), "A");

    expect(screen.queryByText("Informe o nome do lead")).not.toBeInTheDocument();
  });

  it("e-mail inválido bloqueia o envio", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} initial={{ ...EMPTY_LEAD_FORM, nome: "Ana", email: "ana@semdominio" }} />);

    await user.click(salvar());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("E-mail inválido")).toBeInTheDocument();
  });

  it("CNPJ com dígito verificador errado bloqueia o envio", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.type(screen.getByLabelText("CNPJ"), "11222333000100");
    await user.click(salvar());

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("CNPJ inválido")).toBeInTheDocument();
  });

  it("CNPJ incompleto acusa erro já ao sair do campo", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);

    await user.type(screen.getByLabelText("CNPJ"), "1122");
    await user.tab();

    expect(screen.getByText("CNPJ inválido")).toBeInTheDocument();
  });

  it("CNPJ com todos os dígitos iguais é inválido", async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(screen.getByLabelText("Nome *"), "Ana");
    await user.type(screen.getByLabelText("CNPJ"), "11111111111111");
    await user.click(salvar());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("telefone ignora letras e respeita a máscara", async () => {
    const user = userEvent.setup();
    render(<Harness onSubmit={vi.fn()} />);
    const tel = screen.getByLabelText("Telefone");

    await user.type(tel, "abc14988887777999");

    expect(tel).toHaveValue("(14) 98888-7777");
  });

  it("enquanto salva, os botões ficam travados (sem duplo envio)", () => {
    render(<Harness onSubmit={vi.fn()} isPending initial={{ ...EMPTY_LEAD_FORM, nome: "Ana" }} />);
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(salvar()).toBeDisabled();
  });

  it("Cancelar fecha sem enviar", async () => {
    const onSubmit = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
