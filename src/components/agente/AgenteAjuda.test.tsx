import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AgenteAjuda } from "./AgenteAjuda";
import { abrirAgenteAjuda } from "@/lib/agenteAjudaEvento";
import { act } from "react";

const h = vi.hoisted(() => ({ registrar: vi.fn(), navigate: vi.fn() }));
vi.mock("@/lib/ajudaLacunas", () => ({ registrarPerguntaSemResposta: h.registrar }));
vi.mock("@/components/FeedbackDialog", () => ({
  FeedbackDialog: ({ open, mensagemInicial }: { open: boolean; mensagemInicial?: string }) =>
    open ? <div data-testid="suporte">{mensagemInicial}</div> : null,
}));
vi.mock("react-router-dom", async (orig) => ({
  ...(await orig<typeof import("react-router-dom")>()),
  useNavigate: () => h.navigate,
}));

function montar(rota = "/gestao/leads") {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[rota]}>
        <AgenteAjuda />
      </MemoryRouter>
    </QueryClientProvider>
  );
  return userEvent.setup();
}

beforeEach(() => vi.clearAllMocks());

describe("AgenteAjuda (SPEC 155)", () => {
  it("abre pelo botão Dúvidas como chat, sem título, e sugere os artigos da tela", async () => {
    const user = montar();
    await user.click(screen.getByRole("button", { name: /Dúvidas/ }));
    const chat = screen.getByRole("dialog", { name: "Dúvidas sobre o Pilar" });
    expect(chat).toBeInTheDocument();
    expect(screen.queryByText("Agente do Pilar")).not.toBeInTheDocument();
    expect(screen.getByText("Nesta tela:")).toBeInTheDocument();
    expect(screen.getByLabelText("Sua pergunta")).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Criar um lead" }));
    // A sugestão vira mensagem da pessoa e a resposta chega no chat.
    expect(screen.getByText("Criar um lead", { selector: "p.bg-ink" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Ir para Leads/ })).toBeInTheDocument();
  });

  it("Enter envia, Esc fecha e o foco volta ao botão", async () => {
    const user = montar("/inicio");
    await user.click(screen.getByRole("button", { name: /Dúvidas/ }));
    await user.type(screen.getByLabelText("Sua pergunta"), "como eu crio um lead{Enter}");
    expect(await screen.findByRole("link", { name: /Ir para Leads/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Sua pergunta")).toHaveValue("");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Dúvidas/ })).toHaveFocus();
  });

  it("responde 'como eu crio um lead?' com o caminho e o botão para a tela", async () => {
    const user = montar("/inicio");
    act(() => abrirAgenteAjuda());
    await user.type(screen.getByLabelText("Sua pergunta"), "como eu crio um lead");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(await screen.findByText("Criar um lead", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ir para Leads/ })).toHaveAttribute("href", "/gestao/leads");
    expect(h.registrar).not.toHaveBeenCalled();
  });

  it("sem artigo, registra a lacuna e leva aos agentes com a pergunta", async () => {
    const user = montar("/inicio");
    act(() => abrirAgenteAjuda());
    await user.type(screen.getByLabelText("Sua pergunta"), "emitir nota fiscal eletrônica");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    expect(screen.getByText(/Ainda não tenho um passo a passo/)).toBeInTheDocument();
    expect(h.registrar).toHaveBeenCalledWith("emitir nota fiscal eletrônica", "/inicio", "agente");

    await user.click(screen.getByRole("button", { name: "Perguntar aos agentes" }));
    expect(h.navigate).toHaveBeenCalledWith("/agentes", { state: { prompt: "emitir nota fiscal eletrônica" } });
  });

  it("falar com o suporte abre o feedback com a dúvida", async () => {
    const user = montar("/inicio");
    act(() => abrirAgenteAjuda());
    await user.type(screen.getByLabelText("Sua pergunta"), "xyzw");
    await user.click(screen.getByRole("button", { name: "Enviar" }));
    await user.click(screen.getByRole("button", { name: "Falar com o suporte" }));
    expect(screen.getByTestId("suporte")).toHaveTextContent("Dúvida: xyzw");
  });

  it("some na tela dos agentes", () => {
    montar("/agentes");
    expect(screen.queryByRole("button", { name: /Dúvidas/ })).not.toBeInTheDocument();
  });
});
