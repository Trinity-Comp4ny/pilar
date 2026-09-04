import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useNovaVersao } from "./useNovaVersao";

const info = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { info } }));

const captureMessage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/monitoring", () => ({ monitoring: { captureMessage } }));

function resposta(headers: Record<string, string>, body: unknown) {
  return {
    ok: true,
    status: 200,
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    json: () => Promise.resolve(body),
  };
}

function servidorRespondendo(release: string) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta({ "content-type": "application/json" }, { release })));
}

beforeEach(() => {
  info.mockClear();
  captureMessage.mockClear();
  vi.stubGlobal("__SENTRY_RELEASE__", "sha-do-bundle");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useNovaVersao", () => {
  it("avisa quando o servidor já está servindo outro release", async () => {
    servidorRespondendo("sha-mais-nova");
    renderHook(() => useNovaVersao());

    await waitFor(() => expect(info).toHaveBeenCalledTimes(1));
    expect(info.mock.calls[0][0]).toBe("Nova versão disponível");
    // Sem duration finita o aviso desapareceria antes de a pessoa reagir.
    expect(info.mock.calls[0][1]).toMatchObject({ duration: Infinity });
  });

  it("fica calado quando o release do servidor é o mesmo do bundle", async () => {
    servidorRespondendo("sha-do-bundle");
    renderHook(() => useNovaVersao());

    await new Promise((r) => setTimeout(r, 20));
    expect(info).not.toHaveBeenCalled();
  });

  it("não checa nada em desenvolvimento", async () => {
    vi.stubGlobal("__SENTRY_RELEASE__", "dev");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    renderHook(() => useNovaVersao());

    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("reporta em vez de morrer calado quando vem HTML no lugar do JSON", async () => {
    // Foi o que um curl em produção devolveu: o rewrite do SPA responde o
    // index.html com 200 quando o arquivo não existe, e um JSON.parse quebrado
    // no catch deixaria o aviso morto sem ninguém saber.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(resposta({ "content-type": "text/html; charset=utf-8" }, {})));
    renderHook(() => useNovaVersao());

    await waitFor(() => expect(captureMessage).toHaveBeenCalledTimes(1));
    expect(captureMessage.mock.calls[0][0]).toContain("version.json");
    expect(captureMessage.mock.calls[0][1]).toBe("warning");
    expect(info).not.toHaveBeenCalled();
  });

  it("engole falha de rede sem avisar nada", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    renderHook(() => useNovaVersao());

    await new Promise((r) => setTimeout(r, 20));
    expect(info).not.toHaveBeenCalled();
  });

  it("avisa uma vez só, mesmo com a aba voltando várias vezes", async () => {
    servidorRespondendo("sha-mais-nova");
    renderHook(() => useNovaVersao());
    await waitFor(() => expect(info).toHaveBeenCalledTimes(1));

    document.dispatchEvent(new Event("visibilitychange"));
    document.dispatchEvent(new Event("visibilitychange"));

    await new Promise((r) => setTimeout(r, 20));
    expect(info).toHaveBeenCalledTimes(1);
  });
});
