import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

const { mfa, refreshSession, rpc } = vi.hoisted(() => ({
  mfa: {
    getAuthenticatorAssuranceLevel: vi.fn(),
    listFactors: vi.fn(),
    enroll: vi.fn(),
    challenge: vi.fn(),
    verify: vi.fn(),
    unenroll: vi.fn(),
  },
  refreshSession: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { mfa, refreshSession: (...a: unknown[]) => refreshSession(...a) },
    rpc: (...a: unknown[]) => rpc(...a),
  },
}));

import { useMfa } from "./useMfa";

const totp = (id: string, status: "verified" | "unverified") => ({ id, friendly_name: `F-${id}`, status });

beforeEach(() => {
  vi.clearAllMocks();
  mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" } });
  mfa.listFactors.mockResolvedValue({ data: { totp: [totp("f1", "verified")], phone: [] }, error: null });
  mfa.unenroll.mockResolvedValue({ error: null });
  refreshSession.mockResolvedValue({ error: null });
});

async function montar() {
  const hook = renderHook(() => useMfa());
  await waitFor(() => expect(hook.result.current.loading).toBe(false));
  return hook;
}

describe("useMfa: estado inicial", () => {
  it("carrega nível e fatores TOTP", async () => {
    const { result } = await montar();
    expect(result.current.currentLevel).toBe("aal1");
    expect(result.current.nextLevel).toBe("aal2");
    expect(result.current.factors).toEqual([
      { id: "f1", friendlyName: "F-f1", factorType: "totp", status: "verified" },
    ]);
    expect(result.current.hasVerifiedFactor).toBe(true);
    expect(result.current.mfaRequired).toBe(true);
  });

  it("sem dados: cai em aal1 e sem fatores", async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null });
    mfa.listFactors.mockResolvedValue({ data: null });
    const { result } = await montar();
    expect(result.current.currentLevel).toBe("aal1");
    expect(result.current.nextLevel).toBe("aal1");
    expect(result.current.factors).toEqual([]);
    expect(result.current.hasVerifiedFactor).toBe(false);
    expect(result.current.mfaRequired).toBe(false);
  });
});

describe("enrollTotp", () => {
  it("devolve QR e segredo", async () => {
    mfa.enroll.mockResolvedValue({ data: { id: "f2", totp: { qr_code: "qr", secret: "s" } }, error: null });
    const { result } = await montar();
    await expect(result.current.enrollTotp()).resolves.toEqual({ factorId: "f2", qrCode: "qr", secret: "s" });
    expect(mfa.enroll).toHaveBeenCalledWith({ factorType: "totp", friendlyName: "Authenticator" });
  });

  it("propaga erro do Supabase", async () => {
    const erro = new Error("factor exists");
    mfa.enroll.mockResolvedValue({ data: null, error: erro });
    const { result } = await montar();
    await expect(result.current.enrollTotp("X")).rejects.toBe(erro);
  });

  it("sem dados e sem erro: erro genérico", async () => {
    mfa.enroll.mockResolvedValue({ data: null, error: null });
    const { result } = await montar();
    await expect(result.current.enrollTotp()).rejects.toThrow("Falha ao iniciar enroll");
  });
});

describe("verifyTotp", () => {
  it("cria challenge, verifica e recarrega", async () => {
    mfa.challenge.mockResolvedValue({ data: { id: "ch1" }, error: null });
    mfa.verify.mockResolvedValue({ error: null });
    const { result } = await montar();
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal2", nextLevel: "aal2" } });
    await act(() => result.current.verifyTotp("f1", "123456"));
    expect(mfa.verify).toHaveBeenCalledWith({ factorId: "f1", challengeId: "ch1", code: "123456" });
    expect(result.current.currentLevel).toBe("aal2");
    expect(result.current.mfaRequired).toBe(false);
  });

  it("erro no challenge", async () => {
    const erro = new Error("challenge");
    mfa.challenge.mockResolvedValue({ data: null, error: erro });
    const { result } = await montar();
    await expect(result.current.verifyTotp("f1", "1")).rejects.toBe(erro);
    expect(mfa.verify).not.toHaveBeenCalled();
  });

  it("challenge vazio sem erro", async () => {
    mfa.challenge.mockResolvedValue({ data: null, error: null });
    const { result } = await montar();
    await expect(result.current.verifyTotp("f1", "1")).rejects.toThrow("Falha ao criar challenge");
  });

  it("código inválido", async () => {
    mfa.challenge.mockResolvedValue({ data: { id: "ch1" }, error: null });
    const erro = new Error("invalid code");
    mfa.verify.mockResolvedValue({ error: erro });
    const { result } = await montar();
    await expect(result.current.verifyTotp("f1", "000000")).rejects.toBe(erro);
  });
});

describe("unenroll", () => {
  it("remove e recarrega", async () => {
    const { result } = await montar();
    mfa.listFactors.mockResolvedValue({ data: { totp: [] } });
    await act(() => result.current.unenroll("f1"));
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "f1" });
    expect(result.current.factors).toEqual([]);
  });

  it("propaga erro", async () => {
    const erro = new Error("aal2 required");
    mfa.unenroll.mockResolvedValue({ error: erro });
    const { result } = await montar();
    await expect(result.current.unenroll("f1")).rejects.toBe(erro);
  });
});

describe("resetAllFactors", () => {
  it("remove TOTP e telefone", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [totp("t1", "verified")], phone: [{ id: "p1" }] } });
    const { result } = await montar();
    await act(() => result.current.resetAllFactors());
    expect(mfa.unenroll.mock.calls.map((c) => c[0].factorId)).toEqual(["t1", "p1"]);
  });

  it("lista sem dados: nada a remover", async () => {
    const { result } = await montar();
    mfa.listFactors.mockResolvedValue({ data: null, error: null });
    await act(() => result.current.resetAllFactors());
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });

  it("erro ao listar", async () => {
    const { result } = await montar();
    const erro = new Error("list");
    mfa.listFactors.mockResolvedValue({ data: null, error: erro });
    await expect(result.current.resetAllFactors()).rejects.toBe(erro);
  });

  it("erro ao remover", async () => {
    const { result } = await montar();
    const erro = new Error("unenroll");
    mfa.unenroll.mockResolvedValue({ error: erro });
    await expect(result.current.resetAllFactors()).rejects.toBe(erro);
  });
});

describe("unenrollPending", () => {
  it("remove só os não verificados", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [totp("v", "verified"), totp("u", "unverified")] } });
    const { result } = await montar();
    await act(() => result.current.unenrollPending());
    expect(mfa.unenroll).toHaveBeenCalledTimes(1);
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: "u" });
  });

  it("sem dados: nada a remover", async () => {
    const { result } = await montar();
    mfa.listFactors.mockResolvedValue({ data: null, error: null });
    await act(() => result.current.unenrollPending());
    expect(mfa.unenroll).not.toHaveBeenCalled();
  });

  it("erro ao listar", async () => {
    const { result } = await montar();
    const erro = new Error("list");
    mfa.listFactors.mockResolvedValue({ data: null, error: erro });
    await expect(result.current.unenrollPending()).rejects.toBe(erro);
  });

  it("erro ao remover", async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [totp("u", "unverified")] } });
    const { result } = await montar();
    const erro = new Error("unenroll");
    mfa.unenroll.mockResolvedValue({ error: erro });
    await expect(result.current.unenrollPending()).rejects.toBe(erro);
  });
});

describe("recoverWithBackupCode", () => {
  it("código válido: renova sessão e recarrega", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const { result } = await montar();
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.recoverWithBackupCode("ABCD-1234");
    });
    expect(ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("mfa_consume_backup_code", { p_code: "ABCD-1234" });
    expect(refreshSession).toHaveBeenCalled();
  });

  it("código inválido: false sem renovar sessão", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const { result } = await montar();
    await expect(result.current.recoverWithBackupCode("x")).resolves.toBe(false);
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("erro da RPC", async () => {
    const erro = { message: "rate limited" };
    rpc.mockResolvedValue({ data: null, error: erro });
    const { result } = await montar();
    await expect(result.current.recoverWithBackupCode("x")).rejects.toBe(erro);
  });

  it("erro ao renovar sessão", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const erro = new Error("refresh");
    refreshSession.mockResolvedValue({ error: erro });
    const { result } = await montar();
    await expect(result.current.recoverWithBackupCode("x")).rejects.toBe(erro);
  });
});
