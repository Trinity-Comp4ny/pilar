import { describe, expect, it, vi } from "vitest";
import type { ErrorEvent as SentryError, BrowserOptions } from "@sentry/react";

const sdk = vi.hoisted(() => ({
  init: vi.fn<(options: BrowserOptions) => void>(),
  captureException: vi.fn(),
}));
vi.mock("@sentry/react", () => sdk);

describe("monitoring da landing", () => {
  it("mantém a falha de boot e remove mensagens, contexto e query do evento", async () => {
    vi.stubEnv("VITE_SENTRY_MARKETING_DSN", "https://public@example.invalid/1");
    vi.stubGlobal("__MARKETING_RELEASE__", "test-release");
    vi.stubGlobal("__MARKETING_SENTRY_ENV__", "test");
    try {
      const { initMonitoring } = await import("./monitoring");
      initMonitoring();
      expect(sdk.init).not.toHaveBeenCalled();
      const error = new Error("texto sensível");
      window.dispatchEvent(new ErrorEvent("error", { error }));
      await vi.dynamicImportSettled();

      expect(sdk.captureException).toHaveBeenCalledExactlyOnceWith(error);
      const beforeSend = sdk.init.mock.calls[0][0].beforeSend!;
      const original: SentryError = {
        type: undefined,
        message: "texto sensível",
        extra: { valor: "texto sensível" },
        request: { url: "https://example.invalid/?secreto=texto-sensível" },
        exception: {
          values: [
            {
              type: "TypeError",
              value: "texto sensível",
              stacktrace: { frames: [{ filename: "/assets/app.js?secreto=texto-sensível", lineno: 42 }] },
            },
          ],
        },
      };
      const result = await beforeSend(original, {});
      expect(result?.tags).toEqual({ surface: "marketing" });
      expect(result?.exception?.values?.[0].stacktrace?.frames?.[0]).toMatchObject({
        filename: "/assets/app.js",
        lineno: 42,
      });
      expect(JSON.stringify(result)).not.toMatch(/secreto|sensível/);
    } finally {
      vi.unstubAllGlobals();
      vi.unstubAllEnvs();
    }
  });
});
