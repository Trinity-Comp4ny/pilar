import { describe, it, expect, beforeEach, vi } from "vitest";

// Forçamos modo no-op (sem KEY).
vi.stubEnv("VITE_POSTHOG_KEY", "");

import { analytics } from "./analytics";

describe("analytics scrubber — no-op mode", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    try {
      localStorage.clear();
    } catch {
      /* posthog-js pode substituir localStorage */
    }
  });

  function lastArgs(): unknown[] {
    return consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1] ?? [];
  }

  it("mascara keys sensíveis no track", () => {
    analytics.track("user_signed_up", {
      email: "user@example.com",
      password: "hunter2",
      cpf: "12345678900",
      ok: "ok",
    });
    const args = lastArgs();
    const props = args[2] as Record<string, unknown>;
    expect(props.password).toBe("***");
    expect(props.cpf).toBe("***");
    expect(props.email).toBe("user@example.com");
    expect(props.ok).toBe("ok");
  });

  it("mascara CPF/CNPJ inline em strings no identify", () => {
    analytics.identify("user-1", {
      bio: "Cliente 123.456.789-00 e empresa 12.345.678/0001-90",
    });
    const args = lastArgs();
    const traits = args[2] as Record<string, unknown>;
    expect(traits.bio).toBe("Cliente [CPF] e empresa [CNPJ]");
  });

  it("garante anonId persistente entre chamadas", () => {
    const a = analytics.getAnonId();
    const b = analytics.getAnonId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("isFeatureEnabled retorna undefined em no-op", () => {
    expect(analytics.isFeatureEnabled("any")).toBeUndefined();
  });
});
