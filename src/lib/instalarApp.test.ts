import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./analytics", () => ({ analytics: { track: vi.fn() } }));

import {
  __reiniciarInstalacaoParaTeste,
  abrirInstalacaoNativa,
  conviteDispensado,
  detectarPlataforma,
  dispensarConvite,
  lerEstadoInstalacao,
  publicoDaRota,
  type BeforeInstallPromptEvent,
} from "./instalarApp";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_COMO_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const DESKTOP =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

afterEach(() => {
  localStorage.clear();
  __reiniciarInstalacaoParaTeste();
});

describe("detectarPlataforma", () => {
  it("reconhece iPhone, Android e computador", () => {
    expect(detectarPlataforma({ userAgent: IPHONE })).toBe("ios");
    expect(detectarPlataforma({ userAgent: ANDROID })).toBe("android");
    expect(detectarPlataforma({ userAgent: DESKTOP })).toBe("outro");
  });

  it("o iPad com iPadOS se apresenta como Mac: a tela de toque denuncia", () => {
    expect(detectarPlataforma({ userAgent: IPAD_COMO_MAC, maxTouchPoints: 5 })).toBe("ios");
    expect(detectarPlataforma({ userAgent: IPAD_COMO_MAC, maxTouchPoints: 0 })).toBe("outro");
  });

  it("aberto da tela inicial já é app instalado, em qualquer sistema", () => {
    expect(detectarPlataforma({ userAgent: IPHONE, iosStandalone: true })).toBe("instalado");
    expect(detectarPlataforma({ userAgent: ANDROID, standalone: true })).toBe("instalado");
  });
});

describe("instalação nativa (Android)", () => {
  it("abre a janela do navegador uma vez e devolve se a pessoa aceitou", async () => {
    const prompt = vi.fn().mockResolvedValue(undefined);
    const evento = {
      prompt,
      userChoice: Promise.resolve({ outcome: "accepted", platform: "web" }),
    } as unknown as BeforeInstallPromptEvent;
    __reiniciarInstalacaoParaTeste({ plataforma: "android", promptNativo: evento });

    await expect(abrirInstalacaoNativa()).resolves.toBe(true);
    expect(prompt).toHaveBeenCalledTimes(1);
    // O evento do navegador só vale uma vez.
    expect(lerEstadoInstalacao().promptNativo).toBeNull();
    await expect(abrirInstalacaoNativa()).resolves.toBe(false);
  });
});

describe("convite dispensado", () => {
  it("some por 60 dias e volta depois", () => {
    const agora = Date.UTC(2026, 10, 12);
    expect(conviteDispensado(agora)).toBe(false);
    dispensarConvite(agora);
    expect(conviteDispensado(agora + 59 * 86_400_000)).toBe(true);
    expect(conviteDispensado(agora + 61 * 86_400_000)).toBe(false);
  });
});

describe("publicoDaRota", () => {
  it("o portal do cliente tem manifest próprio; o resto é do escritório", () => {
    expect(publicoDaRota("/cliente")).toBe("portal");
    expect(publicoDaRota("/cliente/projeto/1")).toBe("portal");
    expect(publicoDaRota("/clientes")).toBe("escritorio");
    expect(publicoDaRota("/gestao/clientes")).toBe("escritorio");
    expect(publicoDaRota("/inicio")).toBe("escritorio");
  });
});
