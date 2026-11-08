import type { ReactNode } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { format } from "date-fns";
import { LancarHorasDialog } from "./LancarHorasDialog";

const h = vi.hoisted(() => ({
  projetos: { data: [] as unknown[] | null, error: null as unknown },
  rpc: vi.fn(),
  lancar: vi.fn(),
  isPending: false,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ select: () => ({ order: async () => h.projetos }) }),
    rpc: h.rpc,
  },
}));
vi.mock("@/hooks/useTimesheet", () => ({
  useLancarHoras: () => ({ mutateAsync: h.lancar, isPending: h.isPending }),
}));
// Select do Radix depende de pointer capture que o jsdom não tem; um <select> nativo basta.
vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value: string;
    onValueChange: (v: string) => void;
    children: ReactNode;
  }) => (
    <select aria-label="Fase" value={value} onChange={(e) => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: ReactNode }) => <>{children}</>,
  SelectItem: ({ value, children }: { value: string; children: ReactNode }) => (
    <option value={value}>{children}</option>
  ),
}));

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
  Element.prototype.scrollIntoView ??= vi.fn();
});

const onOpenChange = vi.fn();

function renderDialog(projetoIdInicial?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <LancarHorasDialog open onOpenChange={onOpenChange} projetoIdInicial={projetoIdInicial} />
    </QueryClientProvider>
  );
  return userEvent.setup();
}

beforeEach(() => {
  vi.clearAllMocks();
  h.isPending = false;
  h.projetos = {
    data: [
      { id: "p1", nome: "Residencial Seed" },
      { id: "p2", nome: "Galpão Seed" },
    ],
    error: null,
  };
  h.rpc.mockResolvedValue({ data: [{ id: "f1", disciplina: "Estrutural" }], error: null });
  h.lancar.mockResolvedValue(undefined);
});

describe("LancarHorasDialog", () => {
  it("submit fica travado até preencher projeto, horas e descrição", () => {
    renderDialog();
    expect(screen.getByRole("button", { name: "Lançar horas" })).toBeDisabled();
    expect(screen.queryByLabelText("Fase")).not.toBeInTheDocument();
  });

  it("escolhe projeto, fase e lança as horas", async () => {
    const user = renderDialog();
    await user.click(screen.getByLabelText("Projeto *"));
    await user.click(await screen.findByText("Galpão Seed"));
    expect(screen.getByLabelText("Projeto *")).toHaveTextContent("Galpão Seed");
    await waitFor(() => expect(h.rpc).toHaveBeenCalledWith("fases_do_projeto", { p_projeto_id: "p2" }));
    const fase = await screen.findByLabelText("Fase");
    await screen.findByRole("option", { name: "Estrutural" });
    fireEvent.change(fase, { target: { value: "f1" } });

    await user.type(screen.getByLabelText("Horas *"), "2.5");
    await user.type(screen.getByLabelText("Descrição *"), "  Detalhamento de vigas  ");
    await user.click(screen.getByRole("button", { name: "Lançar horas" }));

    await waitFor(() =>
      expect(h.lancar).toHaveBeenCalledWith({
        projeto_id: "p2",
        fase_id: "f1",
        descricao: "Detalhamento de vigas",
        horas: 2.5,
        data: format(new Date(), "yyyy-MM-dd"),
      })
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("projeto inicial vem selecionado e 'Nenhuma fase' manda fase nula", async () => {
    const user = renderDialog("p1");
    expect(await screen.findByText("Residencial Seed")).toBeInTheDocument();
    const fase = await screen.findByLabelText("Fase");
    await screen.findByRole("option", { name: "Estrutural" });
    fireEvent.change(fase, { target: { value: "f1" } });
    fireEvent.change(fase, { target: { value: "__nenhuma__" } });
    await user.type(screen.getByLabelText("Horas *"), "1");
    await user.type(screen.getByLabelText("Descrição *"), "Reunião");
    await user.click(screen.getByRole("button", { name: "Lançar horas" }));
    await waitFor(() => expect(h.lancar).toHaveBeenCalledWith(expect.objectContaining({ fase_id: null })));
  });

  it("horas inválidas não enviam", async () => {
    renderDialog("p1");
    const form = screen.getByLabelText("Horas *").closest("form")!;
    fireEvent.change(screen.getByLabelText("Horas *"), { target: { value: "abc" } });
    fireEvent.change(screen.getByLabelText("Descrição *"), { target: { value: "algo" } });
    fireEvent.submit(form);
    expect(h.lancar).not.toHaveBeenCalled();
  });

  it("cancelar limpa e fecha", async () => {
    const user = renderDialog();
    await user.type(screen.getByLabelText("Descrição *"), "rascunho");
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Descrição *")).toHaveValue("");
  });

  it("Esc fecha pelo diálogo", async () => {
    const user = renderDialog();
    await user.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("erro ao listar projetos ou fases deixa listas vazias", async () => {
    h.projetos = { data: null, error: new Error("rls") };
    h.rpc.mockResolvedValue({ data: null, error: new Error("sem acesso") });
    const user = renderDialog("p9");
    await user.click(screen.getByLabelText("Projeto *"));
    expect(await screen.findByText("Nenhum projeto encontrado.")).toBeInTheDocument();
    await waitFor(() => expect(h.rpc).toHaveBeenCalled());
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("enquanto envia, o botão fica travado", () => {
    h.isPending = true;
    renderDialog("p1");
    expect(screen.getByRole("button", { name: /Lançar horas/ })).toBeDisabled();
  });
});
