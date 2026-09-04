import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckoutForm } from "./CheckoutForm";
import { lookupCEP } from "@/lib/brasilApi";

// Bug real (relato do Matheus, 02/09): digitar o CEP deixava o campo "subindo e
// descendo" — cada correção de dígito que ainda somava 8 disparava uma nova busca
// em paralelo à anterior, e a resposta mais lenta podia sobrescrever a mais rápida
// e recente. O guard em fetchCep (cepLookupRef) precisa ignorar respostas de buscas
// que já foram substituídas por uma busca mais nova.
vi.mock("@/lib/brasilApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/brasilApi")>("@/lib/brasilApi");
  return { ...actual, lookupCEP: vi.fn() };
});

function renderForm() {
  return render(
    <CheckoutForm
      planSlug="starter"
      planNome="Essencial"
      planValue={490}
      cycle="monthly"
      onSubmit={() => {}}
      isSubmitting={false}
      errorMessage={null}
    />
  );
}

describe("CheckoutForm — busca de CEP", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ignora resposta de uma busca antiga que resolve depois de uma busca mais nova", async () => {
    const user = userEvent.setup();
    let resolveFirst!: (v: Awaited<ReturnType<typeof lookupCEP>>) => void;
    let resolveSecond!: (v: Awaited<ReturnType<typeof lookupCEP>>) => void;

    vi.mocked(lookupCEP).mockImplementation((cep: string) => {
      const digits = cep.replace(/\D/g, "");
      if (digits === "11111111") return new Promise((res) => (resolveFirst = res));
      if (digits === "22222222") return new Promise((res) => (resolveSecond = res));
      return Promise.resolve(null);
    });

    renderForm();
    const cepInput = screen.getByLabelText("CEP");

    await user.type(cepInput, "11111111");
    await user.clear(cepInput);
    await user.type(cepInput, "22222222");

    // Resolve a busca mais nova primeiro, depois a antiga chega atrasada.
    resolveSecond({
      cep: "22222-222",
      street: "Rua Nova",
      neighborhood: "Bairro Novo",
      city: "Cidade Nova",
      state: "SP",
    });
    await waitFor(() => expect(screen.getByText(/Rua Nova/)).toBeInTheDocument());

    resolveFirst({
      cep: "11111-111",
      street: "Rua Velha",
      neighborhood: "Bairro Velho",
      city: "Cidade Velha",
      state: "RJ",
    });
    await waitFor(() => expect(vi.mocked(lookupCEP)).toHaveBeenCalledTimes(2));

    // A resposta atrasada da busca antiga não pode sobrescrever o endereço já exibido.
    expect(screen.getByText(/Rua Nova/)).toBeInTheDocument();
    expect(screen.queryByText(/Rua Velha/)).not.toBeInTheDocument();
  });

  it("não repete a busca se o CEP digitado não mudou", async () => {
    const user = userEvent.setup();
    vi.mocked(lookupCEP).mockResolvedValue({
      cep: "11111-111",
      street: "Rua Única",
      neighborhood: "Bairro",
      city: "Cidade",
      state: "SP",
    });

    renderForm();
    const cepInput = screen.getByLabelText("CEP");

    await user.type(cepInput, "11111111");
    await waitFor(() => expect(screen.getByText(/Rua Única/)).toBeInTheDocument());

    // Continuar editando um campo qualquer sem trocar o CEP não deve refazer a busca.
    await user.click(cepInput);
    await user.keyboard("{End}");

    expect(lookupCEP).toHaveBeenCalledTimes(1);
  });
});
