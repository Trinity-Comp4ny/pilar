import { describe, expect, it } from "vitest";
import type { UserIdentity } from "@supabase/supabase-js";
import { emailJaTemConta } from "./signupResultado";

describe("emailJaTemConta", () => {
  it("usuário sem identidades = e-mail já cadastrado (Supabase não envia nada)", () => {
    expect(emailJaTemConta({ identities: [] })).toBe(true);
  });

  it("cadastro novo traz a identidade de e-mail", () => {
    expect(emailJaTemConta({ identities: [{ provider: "email" } as UserIdentity] })).toBe(false);
  });

  it("sem usuário na resposta não conclui nada", () => {
    expect(emailJaTemConta(null)).toBe(false);
    expect(emailJaTemConta({ identities: undefined })).toBe(false);
  });
});
