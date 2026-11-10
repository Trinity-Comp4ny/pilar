import { beforeEach, describe, expect, it, vi } from "vitest";
import { render as renderBase, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";
import userEvent from "@testing-library/user-event";
import { FaixaAvisos } from "./FaixaAvisos";
import type { Aviso } from "@/lib/avisosPlataforma";

function render(ui: ReactElement) {
  const client = new QueryClient();
  const embrulhar = (el: ReactElement) => (
    <QueryClientProvider client={client}>
      <MemoryRouter>{el}</MemoryRouter>
    </QueryClientProvider>
  );
  const r = renderBase(embrulhar(ui));
  return { ...r, rerender: (el: ReactElement) => r.rerender(embrulhar(el)) };
}

const h = vi.hoisted(() => ({ avisos: [] as Aviso[] }));
vi.mock("@/hooks/useAvisosPlataforma", () => ({
  AVISOS_PLATAFORMA_KEY: ["avisos-plataforma"],
  useAvisosPlataforma: () => h.avisos,
}));
vi.mock("@/lib/env", () => ({ env: { VITE_STATUS_URL: "https://status.exemplo.test" } }));
const rpc = vi.hoisted(() => vi.fn(() => Promise.resolve({ error: null })));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));

const incidente: Aviso = {
  chave: "incidente:i1:u1",
  tom: "attention",
  titulo: "Lentidão no Financeiro",
  texto: "Encontramos a causa e estamos corrigindo.",
  detalhe: "Afeta: Aplicação Pilar",
};

beforeEach(() => {
  sessionStorage.clear();
  h.avisos = [];
});

describe("FaixaAvisos (SPEC 153)", () => {
  it("sem aviso não renderiza nada", () => {
    const { container } = render(<FaixaAvisos />);
    expect(container).toBeEmptyDOMElement();
  });

  it("mostra o incidente com o link para a status page", () => {
    h.avisos = [incidente];
    render(<FaixaAvisos />);
    expect(screen.getByRole("status")).toHaveTextContent("Lentidão no Financeiro");
    expect(screen.getByText("Afeta: Aplicação Pilar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Acompanhar/ })).toHaveAttribute("href", "https://status.exemplo.test");
  });

  it("fora do ar usa alerta", () => {
    h.avisos = [{ ...incidente, tom: "danger" }];
    render(<FaixaAvisos />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("dispensar esconde o aviso; atualização nova (outra chave) mostra de novo", async () => {
    h.avisos = [incidente];
    const user = userEvent.setup();
    const { rerender } = render(<FaixaAvisos />);
    await user.click(screen.getByRole("button", { name: "Dispensar aviso" }));
    expect(screen.queryByText("Lentidão no Financeiro")).not.toBeInTheDocument();

    h.avisos = [{ ...incidente, chave: "incidente:i1:u2", texto: "Corrigido, monitorando." }];
    rerender(<FaixaAvisos />);
    expect(screen.getByText("Corrigido, monitorando.")).toBeInTheDocument();
  });

  it("Normalizado não tem link de acompanhar", () => {
    h.avisos = [
      { chave: "incidente:i1:resolvido", tom: "positive", titulo: "Normalizado: X", texto: "ok", detalhe: null },
    ];
    render(<FaixaAvisos />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("comunicado mostra o link e a dispensa vai para o banco", async () => {
    h.avisos = [
      {
        chave: "comunicado:c1",
        tom: "info",
        titulo: "Preço novo",
        texto: "A partir de dezembro",
        detalhe: null,
        link: { url: "/gestao/financeiro", rotulo: "Ver detalhes" },
        comunicadoId: "c1",
      },
    ];
    const user = userEvent.setup();
    render(<FaixaAvisos />);
    expect(screen.getByRole("link", { name: "Ver detalhes" })).toHaveAttribute("href", "/gestao/financeiro");
    expect(screen.queryByRole("link", { name: /Acompanhar/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Dispensar aviso" }));
    expect(rpc).toHaveBeenCalledWith("dispensar_comunicado", { p_comunicado_id: "c1" });
  });
});
