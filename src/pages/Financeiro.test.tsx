import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// Casca do Financeiro: aba e período vêm da URL (inclusive links antigos), a URL
// acompanha a troca de aba preservando outros filtros, o título segue a aba e o
// "Novo lançamento" global abre o formulário certo e invalida todas as queries.

vi.mock("@/hooks/useRecentes", () => ({ useRegistrarPagina: vi.fn() }));
const perm = vi.hoisted(() => ({ podeCriar: true }));
vi.mock("@/hooks/usePermissions", () => ({ usePermissions: () => ({ can: () => perm.podeCriar }) }));
const titulo = vi.hoisted(() => ({ atual: "" }));
vi.mock("@/hooks/usePageTitle", () => ({ usePageTitle: (t: string) => (titulo.atual = t) }));
vi.mock("@/components/PageLayout", () => ({
  PageLayout: ({
    header,
    toolbar,
    tabs,
    children,
  }: {
    header: ReactNode;
    toolbar?: ReactNode;
    tabs: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      {header}
      {toolbar && <div data-testid="toolbar">{toolbar}</div>}
      {tabs}
      {children}
    </div>
  ),
}));
vi.mock("@/components/PageHeader", () => ({
  PageHeader: ({
    title,
    breadcrumbs,
    primaryAction,
  }: {
    title: string;
    breadcrumbs?: { label: string; onClick: () => void }[];
    primaryAction: { label: string; onClick: () => void };
  }) => (
    <header>
      <h1>{title}</h1>
      {breadcrumbs?.map((b) => (
        <button key={b.label} type="button" onClick={b.onClick}>
          voltar:{b.label}
        </button>
      ))}
      <button type="button" onClick={primaryAction.onClick}>
        {primaryAction.label}
      </button>
    </header>
  ),
}));
vi.mock("@/components/SectionTabs", () => ({
  SectionTabs: ({
    tabs,
    onValueChange,
  }: {
    tabs: { id: string; label: string }[];
    onValueChange: (v: string) => void;
  }) => (
    <nav>
      {tabs.map((t) => (
        <button key={t.id} type="button" onClick={() => onValueChange(t.id)}>
          aba:{t.label}
        </button>
      ))}
    </nav>
  ),
}));
const tela = { celular: false };
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => tela.celular }));
vi.mock("./financeiro/components/PeriodoPopover", () => ({ PeriodoPopover: () => <span>periodo</span> }));
vi.mock("./financeiro/tabs/VisaoGeral", () => ({
  default: ({
    onNavigateTab,
    onNovoLancamento,
  }: {
    onNavigateTab: (t: string) => void;
    onNovoLancamento: () => void;
  }) => (
    <div>
      conteudo:visao
      <button type="button" onClick={() => onNavigateTab("carteira")}>
        ir-carteira
      </button>
      <button type="button" onClick={onNovoLancamento}>
        novo-da-visao
      </button>
    </div>
  ),
}));
vi.mock("./financeiro/tabs/Lancamentos", () => ({ default: () => <div>conteudo:lancamentos</div> }));
vi.mock("./financeiro/tabs/FolhaPagamento", () => ({ default: () => <div>conteudo:folha</div> }));
vi.mock("./financeiro/tabs/Carteira", () => ({ default: () => <div>conteudo:carteira</div> }));
vi.mock("./Relatorios", () => ({ default: () => <div>conteudo:relatorios</div> }));
vi.mock("./financeiro/components/NovoLancamentoDialog", () => ({
  NovoLancamentoDialog: ({ open, onEscolher }: { open: boolean; onEscolher: (e: string) => void }) =>
    open ? (
      <div>
        {["receita", "despesa", "transferencia"].map((e) => (
          <button key={e} type="button" onClick={() => onEscolher(e)}>
            escolher:{e}
          </button>
        ))}
      </div>
    ) : null,
}));
vi.mock("./financeiro/components/LancamentoFormDialog", () => ({
  LancamentoFormDialog: ({
    tipo,
    onSaved,
    onOpenChange,
  }: {
    tipo: string;
    onSaved: () => void;
    onOpenChange: (v: boolean) => void;
  }) => (
    <div>
      form:{tipo}
      <button type="button" onClick={onSaved}>
        form-salvar
      </button>
      <button type="button" onClick={() => onOpenChange(false)}>
        form-fechar
      </button>
    </div>
  ),
}));
vi.mock("./financeiro/components/TransferenciaFormDialog", () => ({
  TransferenciaFormDialog: ({ open, onSaved }: { open: boolean; onSaved: () => void }) =>
    open ? (
      <button type="button" onClick={onSaved}>
        transf-salvar
      </button>
    ) : null,
}));

import Financeiro from "./Financeiro";

function Url() {
  return <span data-testid="url">{useLocation().search}</span>;
}

function abrir(url = "/financeiro") {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Financeiro />
        <Url />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { invalidate };
}

const url = () => new URLSearchParams(screen.getByTestId("url").textContent ?? "");

beforeEach(() => {
  vi.clearAllMocks();
  perm.podeCriar = true;
  tela.celular = false;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 10, 10, 12, 0));
});
afterEach(() => vi.useRealTimers());

describe("Financeiro", () => {
  it("no celular o período continua na barra, abaixo das abas", async () => {
    tela.celular = true;
    abrir();
    expect(await screen.findByText("conteudo:visao")).toBeInTheDocument();
    expect(screen.getByTestId("toolbar")).toHaveTextContent("periodo");
  });

  it("abre na Visão Geral com o mês atual na URL e o filtro de período", async () => {
    abrir();
    expect(await screen.findByText("conteudo:visao")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Financeiro" })).toBeInTheDocument();
    // Desktop: o período fica no fim da linha das abas, sem uma linha de barra só para ele.
    expect(screen.queryByTestId("toolbar")).not.toBeInTheDocument();
    expect(screen.getByText("periodo")).toBeInTheDocument();
    expect(titulo.atual).toBe("Financeiro");
    expect(url().get("tab")).toBe("visao-geral");
    expect(url().get("from")).toBe("2026-11-01");
    expect(url().get("to")).toBe("2026-11-30");
    expect(url().get("viz")).toBeNull();
  });

  it.each([
    ["importar", "conteudo:lancamentos"],
    ["fluxo-caixa", "conteudo:visao"],
    ["faturas", "conteudo:carteira"],
    ["contas", "conteudo:carteira"],
    ["folha-pagamento", "conteudo:folha"],
    ["relatorios", "conteudo:relatorios"],
  ])("link antigo ou direto ?tab=%s abre a aba certa", async (tab, conteudo) => {
    abrir(`/financeiro?tab=${tab}`);
    expect(await screen.findByText(conteudo)).toBeInTheDocument();
  });

  it("período e visualização da URL são mantidos; data inválida cai no mês atual", async () => {
    abrir("/financeiro?from=2026-01-01&to=xx&viz=ano&fq=aluguel");
    await screen.findByText("conteudo:visao");
    expect(url().get("from")).toBe("2026-01-01");
    expect(url().get("to")).toBe("2026-11-30");
    expect(url().get("viz")).toBe("ano");
    expect(url().get("fq")).toBe("aluguel");
  });

  it("trocar de aba muda título, URL e mostra o caminho de volta", async () => {
    abrir();
    await screen.findByText("conteudo:visao");
    fireEvent.click(screen.getByRole("button", { name: "aba:Lançamentos" }));
    expect(await screen.findByText("conteudo:lancamentos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Lançamentos" })).toBeInTheDocument();
    expect(titulo.atual).toBe("Financeiro · Lançamentos");
    expect(url().get("tab")).toBe("lancamentos");
    expect(screen.queryByTestId("toolbar")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "voltar:Financeiro" }));
    expect(await screen.findByText("conteudo:visao")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ir-carteira" }));
    expect(await screen.findByText("conteudo:carteira")).toBeInTheDocument();
  });

  it("aba desconhecida mostra o rótulo genérico", async () => {
    abrir("/financeiro?tab=xyz");
    expect(screen.getByRole("heading", { name: "Financeiro" })).toBeInTheDocument();
    expect(titulo.atual).toBe("Financeiro · Financeiro");
  });

  it("novo lançamento: receita/despesa abrem o formulário e salvar invalida todo o financeiro", async () => {
    const { invalidate } = abrir();
    await screen.findByText("conteudo:visao");
    fireEvent.click(screen.getByRole("button", { name: "Novo lançamento" }));
    fireEvent.click(screen.getByRole("button", { name: "escolher:despesa" }));
    expect(screen.getByText("form:despesa")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "form-salvar" }));
    });
    expect(screen.queryByText("form:despesa")).not.toBeInTheDocument();
    expect(invalidate.mock.calls.map((c) => c[0]?.queryKey?.[0])).toEqual([
      "lancamentos-pagina",
      "lancamentos-resumo",
      "grupos-parcela-resumo",
      "finance-data",
      "lancamentos-recentes",
      "dashboard-v2",
    ]);

    fireEvent.click(screen.getByRole("button", { name: "novo-da-visao" }));
    fireEvent.click(screen.getByRole("button", { name: "escolher:receita" }));
    fireEvent.click(screen.getByRole("button", { name: "form-fechar" }));
    expect(screen.queryByText("form:receita")).not.toBeInTheDocument();
  });

  it("novo lançamento de transferência abre o formulário de transferência", async () => {
    const { invalidate } = abrir();
    await screen.findByText("conteudo:visao");
    fireEvent.click(screen.getByRole("button", { name: "Novo lançamento" }));
    fireEvent.click(screen.getByRole("button", { name: "escolher:transferencia" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "transf-salvar" }));
    });
    expect(screen.queryByRole("button", { name: "transf-salvar" })).not.toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledTimes(6);
  });

  it.each(["receita", "despesa"])(
    "busca rápida: ?new=%s abre o formulário já no tipo e sai da URL mantendo aba e período",
    async (tipo) => {
      abrir(`/financeiro?tab=lancamentos&new=${tipo}`);
      expect(await screen.findByText("conteudo:lancamentos")).toBeInTheDocument();
      expect(screen.getByText(`form:${tipo}`)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "escolher:receita" })).not.toBeInTheDocument();
      expect(url().get("new")).toBeNull();
      expect(url().get("tab")).toBe("lancamentos");
      expect(url().get("from")).toBe("2026-11-01");
    }
  );

  it("busca rápida: ?new= sem tipo conhecido abre a escolha de tipo", async () => {
    abrir("/financeiro?new=1");
    await screen.findByText("conteudo:visao");
    expect(screen.getByRole("button", { name: "escolher:receita" })).toBeInTheDocument();
    expect(url().get("new")).toBeNull();
  });

  it("busca rápida: sem permissão de criar não abre o formulário", async () => {
    perm.podeCriar = false;
    abrir("/financeiro?tab=lancamentos&new=despesa");
    await screen.findByText("conteudo:lancamentos");
    expect(screen.queryByText("form:despesa")).not.toBeInTheDocument();
    expect(url().get("new")).toBeNull();
  });
});
