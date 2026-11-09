import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { limparCookies, prepararAmbiente, renderNaRota } from "../test/ambiente";
import { getCookieConsent, requestCookieConsentReview, saveCookieConsent } from "../cookieConsent";
import { CookieConsentBanner } from "./CookieConsentBanner";

/**
 * O banner usa o `analytics.ts` de verdade; só o PostHog é trocado por um
 * dublê, para provar que nenhuma chamada sai sem consentimento.
 */
const posthog = vi.hoisted(() => ({
  init: vi.fn(),
  capture: vi.fn(),
  opt_out_capturing: vi.fn(),
  reset: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

beforeAll(() => prepararAmbiente());

async function montar() {
  vi.resetModules();
  vi.stubEnv("VITE_POSTHOG_KEY", "phc_teste");
  const { CookieConsentBanner: Banner } = await import("./CookieConsentBanner");
  const { trackCta } = await import("../analytics");
  renderNaRota(<Banner />);
  return { trackCta };
}

const banner = () => screen.queryByText(/Usamos cookies essenciais/);

describe("CookieConsentBanner", () => {
  beforeEach(() => {
    limparCookies();
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    limparCookies();
  });

  it("aparece para quem ainda não decidiu, com link para a política de privacidade", () => {
    renderNaRota(<CookieConsentBanner />);
    expect(banner()).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "política de privacidade" })).toHaveAttribute("href", "/privacidade");
  });

  it("não aparece para quem já decidiu", () => {
    saveCookieConsent(false);
    renderNaRota(<CookieConsentBanner />);
    expect(banner()).not.toBeInTheDocument();
  });

  it("aceitar todos grava o consentimento, some e liga o analytics", async () => {
    const { trackCta } = await montar();
    await userEvent.click(screen.getByRole("button", { name: "Aceitar todos" }));

    expect(getCookieConsent()?.analytics).toBe(true);
    expect(banner()).not.toBeInTheDocument();
    expect(posthog.init).toHaveBeenCalledTimes(1);

    trackCta("agende_demo", "hero");
    expect(posthog.capture).toHaveBeenCalledWith("landing_cta_clicked", { cta: "agende_demo", location: "hero" });
  });

  it("recusar grava a recusa, some e nenhum evento sai, nem no clique de CTA", async () => {
    const { trackCta } = await montar();
    await userEvent.click(screen.getByRole("button", { name: "Recusar não essenciais" }));

    expect(getCookieConsent()?.analytics).toBe(false);
    expect(banner()).not.toBeInTheDocument();

    trackCta("agende_demo", "hero");
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("personalizar: análise começa desligada e salvar assim equivale a recusar", async () => {
    await montar();
    await userEvent.click(screen.getByRole("button", { name: "Personalizar" }));

    expect(screen.getByText("Sempre ativo")).toBeInTheDocument();
    const analise = screen.getByRole("switch", { name: "Cookies de análise" });
    expect(analise).toHaveAttribute("aria-checked", "false");

    await userEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));
    expect(getCookieConsent()?.analytics).toBe(false);
    expect(posthog.init).not.toHaveBeenCalled();
  });

  it("personalizar: ligar a análise e salvar liga o analytics", async () => {
    await montar();
    await userEvent.click(screen.getByRole("button", { name: "Personalizar" }));
    const analise = screen.getByRole("switch", { name: "Cookies de análise" });
    await userEvent.click(analise);
    expect(analise).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));
    expect(getCookieConsent()?.analytics).toBe(true);
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it("'Preferências de cookies' reabre o banner expandido, com a escolha salva no alternador", async () => {
    saveCookieConsent(true);
    renderNaRota(<CookieConsentBanner />);
    expect(banner()).not.toBeInTheDocument();

    act(() => requestCookieConsentReview());

    expect(banner()).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Cookies de análise" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Salvar preferências" })).toBeInTheDocument();
  });

  it("revogar pelas preferências desliga a captura que estava ligada", async () => {
    await montar();
    await userEvent.click(screen.getByRole("button", { name: "Aceitar todos" }));
    expect(posthog.init).toHaveBeenCalledTimes(1);

    act(() => requestCookieConsentReview());
    await userEvent.click(screen.getByRole("switch", { name: "Cookies de análise" }));
    await userEvent.click(screen.getByRole("button", { name: "Salvar preferências" }));

    expect(getCookieConsent()?.analytics).toBe(false);
    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.reset).toHaveBeenCalledTimes(1);
  });
});
