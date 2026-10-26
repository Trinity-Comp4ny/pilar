import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import type { AjustesEmpresa } from "@/schemas/estimativaObra";
import { parametrosDaMigration } from "@/test/estimativaFixtures";
import PrecosEmpresa from "./PrecosEmpresa";

/**
 * Tabela de preços da empresa (SPEC 137, BEZ-14): todos leem, só o admin escreve. O valor da empresa fica ao
 * lado da referência, com quando e quem mudou, e pode voltar à referência.
 */

let isAdmin = true;
let ajustes: AjustesEmpresa | null = null;
let falha: Error | null = null;

const { mutate } = vi.hoisted(() => ({
  mutate: vi.fn((_vars: unknown, callbacks?: { onSuccess?: () => void }) => callbacks?.onSuccess?.()),
}));

vi.mock("./hooks", () => ({
  useParametrosDoMotor: () => ({
    data: falha ? undefined : { parametros: parametrosDaMigration(), validado: false },
    isLoading: false,
    error: falha,
  }),
  useAjustesDaEmpresa: () => ({ data: falha ? undefined : ajustes, isLoading: false, error: null }),
  useSalvarAjusteEmpresa: () => ({ mutate, isPending: false }),
  useNomesDosUsuarios: () => ({ data: { "u-9": "Maria Silva" } }),
}));

vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ isAdmin }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u-1" } }) }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/PilarPage", () => ({
  PilarPage: ({ title, children }: { title: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

const abrir = () =>
  render(
    <MemoryRouter>
      <PrecosEmpresa />
    </MemoryRouter>
  );

const linhaDe = (rotulo: string) => {
  const tr = screen.getByText(rotulo).closest("tr");
  if (!tr) throw new Error(`Linha ${rotulo} não encontrada`);
  return within(tr);
};

beforeEach(() => {
  isAdmin = true;
  ajustes = null;
  falha = null;
  mutate.mockClear();
});

describe("PrecosEmpresa", () => {
  it("lista os itens com a referência e 'usa a referência' enquanto a empresa não definiu valor", () => {
    abrir();
    expect(screen.getByRole("heading", { level: 1, name: "Tabela de preços" })).toBeInTheDocument();
    const piscina = linhaDe("Piscina");
    expect(piscina.getByText("Provisória")).toBeInTheDocument();
    expect(piscina.getByText("R$ 2.500 por m²")).toBeInTheDocument();
    expect(piscina.getByText("usa a referência")).toBeInTheDocument();
    const split = linhaDe("Ar-condicionado split 12.000 BTU");
    expect(split.getByText("SINAPI")).toBeInTheDocument();
    expect(split.getByText(/insumo 42425/)).toBeInTheDocument();
    const fv = linhaDe("Energia solar fotovoltaica");
    expect(fv.getByText("A definir")).toBeInTheDocument();
  });

  it("mostra o valor da empresa com quando e quem mudou", () => {
    ajustes = {
      adicionais: {
        piscina: { valor: 3000, atualizado_em: "2026-10-21T13:00:00Z", atualizado_por: "u-9" },
        ac12: { valor_unitario: 2600 },
      },
    };
    abrir();
    const piscina = linhaDe("Piscina");
    expect(piscina.getByText("R$ 3.000 por m²")).toBeInTheDocument();
    expect(piscina.getByText("ajustado")).toBeInTheDocument();
    expect(piscina.getByText(/Maria Silva/)).toBeInTheDocument();
    expect(linhaDe("Ar-condicionado split 12.000 BTU").getByText("R$ 2.600 por unidade")).toBeInTheDocument();
  });

  it("ajuste só com registro não aparece como valor da empresa", () => {
    ajustes = { adicionais: { piscina: { observacao: "x", atualizado_em: "2026-10-21T13:00:00Z" } } };
    abrir();
    expect(linhaDe("Piscina").getByText("usa a referência")).toBeInTheDocument();
  });

  it("admin define o valor por m² e grava com o registro de quem mudou", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(linhaDe("Piscina").getByRole("button", { name: "Definir valor" }));
    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByText(/Referência do Pilar: R\$\s2\.500,00/)).toBeInTheDocument();
    await user.type(within(dialogo).getByLabelText("Valor por m²"), "300000");
    await user.type(within(dialogo).getByLabelText(/Observação/), "Tabela do fornecedor");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar valor" }));

    expect(mutate).toHaveBeenCalledTimes(1);
    const [vars] = mutate.mock.calls[0] as [{ id: string; ajuste: Record<string, unknown> }];
    expect(vars.id).toBe("piscina");
    expect(vars.ajuste).toMatchObject({ valor: 3000, observacao: "Tabela do fornecedor", atualizado_por: "u-1" });
    expect(typeof vars.ajuste.atualizado_em).toBe("string");
  });

  it("percentual acima de 100 mostra o motivo e não grava", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(linhaDe("Fundação").getByRole("button", { name: "Definir valor" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Percentual da base"), "120");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar valor" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent(/Confira os valores/);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("sem preencher nada, pede pelo menos um valor", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(linhaDe("Piscina").getByRole("button", { name: "Definir valor" }));
    const dialogo = await screen.findByRole("dialog");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar valor" }));
    expect(within(dialogo).getByRole("alert")).toHaveTextContent("Informe pelo menos um valor");
    expect(mutate).not.toHaveBeenCalled();
  });

  it("item a definir grava o valor por unidade", async () => {
    const user = userEvent.setup();
    abrir();
    await user.click(linhaDe("Energia solar fotovoltaica").getByRole("button", { name: "Definir valor" }));
    const dialogo = await screen.findByRole("dialog");
    await user.type(within(dialogo).getByLabelText("Valor por kWp"), "520000");
    await user.click(within(dialogo).getByRole("button", { name: "Salvar valor" }));
    const [vars] = mutate.mock.calls[0] as [{ id: string; ajuste: Record<string, unknown> }];
    expect(vars.id).toBe("fv");
    expect(vars.ajuste.valor_unitario).toBe(5200);
  });

  it("voltar à referência pede confirmação e tira o ajuste", async () => {
    ajustes = { adicionais: { piscina: { valor: 3000 } } };
    const user = userEvent.setup();
    abrir();
    await user.click(linhaDe("Piscina").getByRole("button", { name: "Voltar à referência" }));
    expect(mutate).not.toHaveBeenCalled();
    const dialogo = await screen.findByRole("alertdialog");
    await user.click(within(dialogo).getByRole("button", { name: "Voltar à referência" }));
    expect(mutate).toHaveBeenCalledWith({ id: "piscina", ajuste: null }, expect.anything());
  });

  it("quem não é admin lê a tabela, sem botões, e vê por que", () => {
    isAdmin = false;
    ajustes = { adicionais: { piscina: { valor: 3000 } } };
    abrir();
    expect(screen.getByText(/Só quem administra a empresa muda estes valores/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Definir valor" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar" })).not.toBeInTheDocument();
    expect(linhaDe("Piscina").getByText("R$ 3.000 por m²")).toBeInTheDocument();
  });

  it("falha ao carregar mostra o motivo", () => {
    falha = new Error("sem permissão");
    abrir();
    expect(screen.getByText("Não foi possível carregar a tabela de preços")).toBeInTheDocument();
    expect(screen.getByText("sem permissão")).toBeInTheDocument();
  });
});
