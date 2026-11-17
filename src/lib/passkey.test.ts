import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  flag: "true" as string | undefined,
  signIn: vi.fn(),
  register: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: {
    get VITE_PASSKEY_ENABLED() {
      return h.flag;
    },
  },
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signInWithPasskey: h.signIn, registerPasskey: h.register } },
}));

import { cadastrarPasskey, entrarComPasskey, passkeyDisponivel } from "./passkey";

describe("passkey", () => {
  beforeEach(() => {
    h.flag = "true";
    h.signIn.mockReset();
    h.register.mockReset();
    (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential = function PublicKeyCredential() {};
  });

  it("só disponível com a flag ligada e suporte do navegador", () => {
    expect(passkeyDisponivel()).toBe(true);
    h.flag = undefined;
    expect(passkeyDisponivel()).toBe(false);
    h.flag = "true";
    delete (window as unknown as { PublicKeyCredential?: unknown }).PublicKeyCredential;
    expect(passkeyDisponivel()).toBe(false);
  });

  it("entrar e cadastrar com sucesso", async () => {
    h.signIn.mockResolvedValue({ error: null });
    h.register.mockResolvedValue({ error: null });
    expect(await entrarComPasskey()).toEqual({ ok: true });
    expect(await cadastrarPasskey()).toEqual({ ok: true });
  });

  it("erro do Auth volta com mensagem; cancelar do prompt é cancelado", async () => {
    h.signIn.mockResolvedValue({ error: { message: "falhou" } });
    expect(await entrarComPasskey()).toEqual({ ok: false, cancelado: false, mensagem: "falhou" });
    h.register.mockRejectedValue(Object.assign(new Error("fechou"), { name: "NotAllowedError" }));
    expect(await cadastrarPasskey()).toMatchObject({ ok: false, cancelado: true });
    h.signIn.mockRejectedValue({ code: "ERROR_CEREMONY_ABORTED" });
    expect(await entrarComPasskey()).toMatchObject({ ok: false, cancelado: true });
  });
});
