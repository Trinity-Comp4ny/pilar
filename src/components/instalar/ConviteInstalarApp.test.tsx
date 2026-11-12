import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { __reiniciarInstalacaoParaTeste, type BeforeInstallPromptEvent } from "@/lib/instalarApp";
import { ConviteInstalarApp } from "./ConviteInstalarApp";

const h = vi.hoisted(() => ({ mobile: true, track: vi.fn() }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => h.mobile }));
vi.mock("@/lib/analytics", () => ({ analytics: { track: h.track } }));

beforeEach(() => {
  h.mobile = true;
  h.track.mockClear();
  localStorage.clear();
});
afterEach(() => __reiniciarInstalacaoParaTeste());

describe("ConviteInstalarApp", () => {
  it("no iPhone, mostra os passos pelo Compartilhar", async () => {
    __reiniciarInstalacaoParaTeste({ plataforma: "ios" });
    render(<ConviteInstalarApp publico="portal" />);

    expect(screen.getByText("Instale o Pilar no celular")).toBeInTheDocument();
    expect(screen.getByText(/Seus projetos a um toque/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Como instalar" }));

    expect(await screen.findByRole("dialog", { name: "Instalar no iPhone" })).toBeInTheDocument();
    expect(screen.getByText("Adicionar à Tela de Início")).toBeInTheDocument();
    expect(h.track).toHaveBeenCalledWith("app_instalar_acao", expect.objectContaining({ modo: "passos" }));
  });

  it("no Android com o evento do navegador, abre a instalação nativa", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    __reiniciarInstalacaoParaTeste({
      plataforma: "android",
      promptNativo: {
        prompt,
        userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
      } as unknown as BeforeInstallPromptEvent,
    });
    render(<ConviteInstalarApp publico="escritorio" />);

    await userEvent.click(screen.getByRole("button", { name: "Instalar" }));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("no Android sem o evento, cai nos passos pelo menu", async () => {
    __reiniciarInstalacaoParaTeste({ plataforma: "android" });
    render(<ConviteInstalarApp publico="escritorio" />);

    await userEvent.click(screen.getByRole("button", { name: "Como instalar" }));
    expect(await screen.findByRole("dialog", { name: "Instalar no Android" })).toBeInTheDocument();
  });

  it("não aparece no app já instalado, no computador nem depois de fechado", async () => {
    __reiniciarInstalacaoParaTeste({ plataforma: "instalado" });
    const { unmount } = render(<ConviteInstalarApp publico="escritorio" />);
    expect(screen.queryByText("Instale o Pilar no celular")).not.toBeInTheDocument();
    unmount();

    __reiniciarInstalacaoParaTeste({ plataforma: "ios" });
    h.mobile = false;
    const desk = render(<ConviteInstalarApp publico="escritorio" />);
    expect(screen.queryByText("Instale o Pilar no celular")).not.toBeInTheDocument();
    desk.unmount();

    h.mobile = true;
    const cel = render(<ConviteInstalarApp publico="escritorio" />);
    await userEvent.click(screen.getByRole("button", { name: "Fechar convite para instalar" }));
    expect(screen.queryByText("Instale o Pilar no celular")).not.toBeInTheDocument();
    cel.unmount();
    render(<ConviteInstalarApp publico="escritorio" />);
    expect(screen.queryByText("Instale o Pilar no celular")).not.toBeInTheDocument();
  });
});
