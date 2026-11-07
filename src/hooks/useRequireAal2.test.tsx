import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

const h = vi.hoisted(() => ({
  auth: { mfaCurrentLevel: "aal1", mfaNextLevel: "aal1" },
  bypass: false,
  navigate: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => h.auth }));
vi.mock("@/lib/mfaDevBypass", () => ({ mfaDevBypass: () => h.bypass }));
vi.mock("react-router-dom", () => ({ useNavigate: () => h.navigate }));
vi.mock("sonner", () => ({ toast: { error: h.toastError } }));

import { useRequireAal2 } from "./useRequireAal2";

beforeEach(() => {
  vi.clearAllMocks();
  h.bypass = false;
  h.auth = { mfaCurrentLevel: "aal1", mfaNextLevel: "aal1" };
});

describe("useRequireAal2", () => {
  it("bypass de dev libera", async () => {
    h.bypass = true;
    h.auth = { mfaCurrentLevel: "aal1", mfaNextLevel: "aal2" };
    const { result } = renderHook(() => useRequireAal2());
    await expect(result.current()).resolves.toBe(true);
  });

  it("sessão já em aal2 libera", async () => {
    h.auth = { mfaCurrentLevel: "aal2", mfaNextLevel: "aal2" };
    const { result } = renderHook(() => useRequireAal2());
    await expect(result.current()).resolves.toBe(true);
  });

  it("sem fator enrolado (MFA opcional) libera", async () => {
    const { result } = renderHook(() => useRequireAal2());
    await expect(result.current()).resolves.toBe(true);
    expect(h.navigate).not.toHaveBeenCalled();
  });

  it("fator enrolado em sessão aal1: bloqueia, avisa e manda para /mfa", async () => {
    h.auth = { mfaCurrentLevel: "aal1", mfaNextLevel: "aal2" };
    const { result } = renderHook(() => useRequireAal2());
    await expect(result.current()).resolves.toBe(false);
    expect(h.toastError).toHaveBeenCalledWith("Confirme o código de verificação", expect.anything());
    expect(h.navigate).toHaveBeenCalledWith("/mfa", {
      state: { reason: "aal2-required", returnTo: window.location.pathname },
    });
  });
});
