import { type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fake, rpcComEmpresa } from "@/pages/obras/testing/supabaseFake";
import type { MaterialComMovimentos, MovimentoRow } from "@/pages/obras/hooks/useObraEstoque";

// Estoque da obra (entrada/baixa de material) e criação de acesso ao Pilar Campo.

vi.mock("@/integrations/supabase/client", async () => ({
  supabase: (await import("@/pages/obras/testing/supabaseFake")).fake.supabase,
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

Element.prototype.scrollIntoView ??= () => {};

import { MaterialMovDialog } from "./MaterialMovDialog";
import { CriarAcessoCampoDialog } from "./CriarAcessoCampoDialog";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
const digitar = (rotulo: string | RegExp, valor: string) =>
  fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });

const materiais = [
  { id: "mat-1", nome: "Cimento", unidade: "sc", movimentos: [] },
] as unknown as MaterialComMovimentos[];

function escolher(rotulo: string, opcao: string | RegExp) {
  fireEvent.keyDown(screen.getByRole("combobox", { name: rotulo }), { key: "Enter" });
  fireEvent.click(within(screen.getByRole("listbox")).getByRole("option", { name: opcao }));
}

describe("MaterialMovDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
    rpcComEmpresa();
  });

  function montar(props: { movInicial?: MovimentoRow | null; materialIdInicial?: string | null } = {}) {
    const onOpenChange = vi.fn();
    render(
      <MaterialMovDialog
        open
        onOpenChange={onOpenChange}
        obraId="obra-1"
        materiais={materiais}
        frentes={[]}
        {...props}
      />,
      { wrapper: wrapper() }
    );
    return { onOpenChange };
  }
  const salvar = () => fireEvent.click(screen.getByRole("button", { name: "Salvar" }));

  it("sem material e sem quantidade mostra os dois erros e não grava", async () => {
    montar();
    salvar();
    expect(await screen.findByText("Escolha o material")).toBeInTheDocument();
    expect(screen.getByText("Informe uma quantidade maior que zero")).toBeInTheDocument();
    expect(fake.escritas()).toHaveLength(0);
  });

  it.each(["0", "-2", "abc"])("quantidade %s é recusada", async (q) => {
    montar({ materialIdInicial: "mat-1" });
    digitar("Quantidade *", q);
    salvar();
    expect(await screen.findByText("Informe uma quantidade maior que zero")).toBeInTheDocument();
    expect(fake.escritas()).toHaveLength(0);
  });

  it("valor unitário negativo é recusado antes do servidor", async () => {
    montar({ materialIdInicial: "mat-1" });
    digitar("Quantidade *", "10");
    digitar(/Valor unitário/, "-5");
    salvar();
    expect(await screen.findByText("Informe um valor unitário válido")).toBeInTheDocument();
    expect(fake.escritas()).toHaveLength(0);
  });

  it("entrada com vírgula decimal grava quantidade e valor como número", async () => {
    const { onOpenChange } = montar({ materialIdInicial: "mat-1" });
    digitar("Quantidade *", "12,5");
    digitar(/Valor unitário/, "38,90");
    digitar("Observações", "  NF 123 ");
    salvar();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fake.escritas("obra_material_mov")[0].payload).toEqual(
      expect.objectContaining({
        empresa_id: "emp-1",
        obra_id: "obra-1",
        obra_material_id: "mat-1",
        tipo: "entrada",
        quantidade: 12.5,
        valor_unitario: 38.9,
        obra_frente_id: null,
        observacoes: "NF 123",
      })
    );
    expect(toast.success).toHaveBeenCalledWith("Entrada registrada");
  });

  it("baixa não envia valor unitário", async () => {
    montar({ materialIdInicial: "mat-1" });
    escolher("Tipo *", /Baixa/);
    digitar("Quantidade *", "3");
    salvar();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Baixa registrada"));
    expect(fake.escritas("obra_material_mov")[0].payload).toEqual(
      expect.objectContaining({ tipo: "baixa", valor_unitario: null })
    );
  });

  it("novo material exige nome e unidade", async () => {
    montar();
    escolher("Material *", "+ Novo material");
    digitar("Quantidade *", "1");
    salvar();
    expect(await screen.findByText("Nome do material")).toBeInTheDocument();
    expect(screen.getByText("Unidade")).toBeInTheDocument();
    expect(fake.escritas()).toHaveLength(0);
  });

  it("novo material: cria o material e depois o movimento; se o movimento falha, não duplica o material", async () => {
    let falhaMov = true;
    fake.responder((c) => {
      if (c.tabela === "obra_material" && c.op === "insert") return { data: { id: "mat-novo" }, error: null };
      if (c.tabela === "obra_material_mov" && c.op === "insert" && falhaMov)
        return { data: null, error: new Error("falhou") };
      return undefined;
    });
    const { onOpenChange } = montar();
    escolher("Material *", "+ Novo material");
    digitar("Nome *", "Areia média");
    digitar("Unidade *", "m³");
    digitar("Quantidade *", "4");
    salvar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Não foi possível salvar", { description: "falhou" }));
    expect(onOpenChange).not.toHaveBeenCalled();

    falhaMov = false;
    salvar();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(fake.escritas("obra_material").filter((c) => c.op === "insert")).toHaveLength(1);
    expect(fake.escritas("obra_material_mov").at(-1)?.payload).toEqual(
      expect.objectContaining({ obra_material_id: "mat-novo", quantidade: 4 })
    );
  });

  it("edição atualiza o movimento pelo id com o material fixo", async () => {
    montar({
      movInicial: {
        id: "mov-1",
        obra_material_id: "mat-1",
        tipo: "baixa",
        quantidade: 2,
        data: "2026-10-10",
        obra_frente_id: null,
        valor_unitario: null,
        observacoes: null,
      } as unknown as MovimentoRow,
    });
    expect(screen.getByDisplayValue("Cimento")).toBeDisabled();
    digitar("Quantidade *", "5");
    salvar();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Movimento atualizado"));
    const [update] = fake.escritas("obra_material_mov");
    expect(update.op).toBe("update");
    expect(update.filtros).toContainEqual(["eq", "id", "mov-1"]);
  });

  it("data no futuro é barrada pelo campo", async () => {
    montar({ materialIdInicial: "mat-1" });
    digitar("Quantidade *", "1");
    digitar("Data *", "2999-01-01");
    salvar();
    await act(async () => {});
    expect(screen.getByLabelText("Data *")).toBeInvalid();
    expect(fake.escritas()).toHaveLength(0);
  });
});

describe("CriarAcessoCampoDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fake.reset();
  });

  function montar() {
    const onOpenChange = vi.fn();
    render(<CriarAcessoCampoDialog open onOpenChange={onOpenChange} obraId="obra-1" />, { wrapper: wrapper() });
    return { onOpenChange };
  }
  const criar = () => fireEvent.click(screen.getByRole("button", { name: "Criar acesso" }));

  it("sem nome avisa e não chama a função", async () => {
    montar();
    digitar("Email (opcional)", "joao@email.com");
    criar();
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Informe o nome de quem vai usar o acesso"));
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("sem email: mostra email e senha gerados uma única vez", async () => {
    fake.invoke.mockResolvedValueOnce({
      data: { success: true, modo: "senha", email: "joao@campo.pilar", senha: "S3nh@" },
      error: null,
    });
    montar();
    digitar("Nome", "  João  ");
    criar();
    expect(await screen.findByText("S3nh@")).toBeInTheDocument();
    expect(fake.invoke).toHaveBeenCalledWith("invite-campo", {
      body: { obra_id: "obra-1", nome: "João", email: undefined },
    });
    expect(screen.getByText(/a senha só aparece uma vez/)).toBeInTheDocument();
  });

  it("com email: modo convite, sem senha na tela, e copia o texto", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    fake.invoke.mockResolvedValueOnce({
      data: { success: true, modo: "convite", email: "joao@email.com" },
      error: null,
    });
    montar();
    digitar("Nome", "João");
    digitar("Email (opcional)", "joao@email.com");
    criar();
    expect(await screen.findByText("pilarsoft.com.br/campo/convite")).toBeInTheDocument();
    expect(screen.queryByText("Senha")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Copiar" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(expect.stringContaining("joao@email.com")));
    expect(toast.success).toHaveBeenCalledWith("Copiado");
  });

  it("erro devolvido pela função vira toast e o formulário continua", async () => {
    fake.invoke.mockResolvedValueOnce({ data: { success: false, error: "Email já usado" }, error: null });
    montar();
    digitar("Nome", "João");
    criar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível criar o acesso", { description: "Email já usado" })
    );
    expect(screen.getByLabelText("Nome")).toHaveValue("João");
  });

  it("modo senha sem senha na resposta é tratado como falha", async () => {
    fake.invoke.mockResolvedValueOnce({ data: { success: true, modo: "senha", email: "x@y" }, error: null });
    montar();
    digitar("Nome", "João");
    criar();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Não foi possível criar o acesso", {
        description: "Falha ao criar o acesso",
      })
    );
  });
});
