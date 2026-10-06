import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { checkUserLimit, deliverInvite } from "./delivery.ts";

type Client = Parameters<typeof deliverInvite>[0];
function client(
  options: {
    inviteError?: unknown;
    profile?: unknown;
    lookupError?: unknown;
    otpError?: unknown;
    count?: number;
    countError?: unknown;
  } = {}
) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = {
    select: (...args: unknown[]) => {
      calls.push({ method: "select", args });
      return chain;
    },
    ilike: (...args: unknown[]) => {
      calls.push({ method: "ilike", args });
      return chain;
    },
    limit: () => chain,
    maybeSingle: () => Promise.resolve({ data: options.profile ?? null, error: options.lookupError ?? null }),
    eq: (...args: unknown[]) => {
      calls.push({ method: "eq", args });
      return Promise.resolve({ count: options.count ?? 0, error: options.countError ?? null });
    },
  };
  const svc = {
    from: (...args: unknown[]) => {
      calls.push({ method: "from", args });
      return chain;
    },
    auth: {
      admin: {
        inviteUserByEmail: (...args: unknown[]) => {
          calls.push({ method: "invite", args });
          return Promise.resolve({ error: options.inviteError ?? null });
        },
      },
      signInWithOtp: (...args: unknown[]) => {
        calls.push({ method: "otp", args });
        return Promise.resolve({ error: options.otpError ?? null });
      },
    },
  } as unknown as Client;
  return { svc, calls };
}

for (const token of ["initial-token", "resend-token"]) {
  Deno.test(`conta órfã recebe link sem criação de conta (${token})`, async () => {
    const { svc, calls } = client({ inviteError: { code: "email_exists" } });
    const result = await deliverInvite(svc, " BIA_Test%name@Example.com ", token, "Bia", "https://app.test");
    assertEquals(result, { ok: true, conta_existente: true });
    assertEquals(calls.find((c) => c.method === "ilike")?.args, ["email", "bia\\_test\\%name@example.com"]);
    assertEquals(calls.find((c) => c.method === "otp")?.args, [
      {
        email: "bia_test%name@example.com",
        options: { shouldCreateUser: false, emailRedirectTo: "https://app.test/auth/callback" },
      },
    ]);
  });
}
Deno.test("conta com profile é recusada sem enviar OTP", async () => {
  const { svc, calls } = client({ inviteError: { code: "email_exists" }, profile: { id: "existing" } });
  const result = await deliverInvite(svc, "bia@test.com", "token", "Bia", "https://app.test");
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.preservePending, false);
  assertEquals(
    calls.some((c) => c.method === "otp"),
    false
  );
});
for (const failure of ["lookupError", "otpError"] as const) {
  Deno.test(`${failure} conserva convite reenviável e não retorna sucesso`, async () => {
    const { svc } = client({ inviteError: { code: "email_exists" }, [failure]: { message: "network failure" } });
    const result = await deliverInvite(svc, "bia@test.com", "token", "Bia", "https://app.test");
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.preservePending, true);
  });
}
Deno.test("convite novo segue fluxo original", async () => {
  const { svc, calls } = client();
  assertEquals(await deliverInvite(svc, "bia@test.com", "token", "Bia", "https://app.test"), {
    ok: true,
    conta_existente: false,
  });
  assertEquals(calls.find((c) => c.method === "invite")?.args[1], {
    redirectTo: "https://app.test/profile-setup",
    data: { invite_token: "token", nome: "Bia" },
  });
  assertEquals(
    calls.some((c) => c.method === "from"),
    false
  );
});
Deno.test("falha comum de envio mantém cleanup original", async () => {
  const { svc } = client({ inviteError: { code: "unexpected_failure" } });
  const result = await deliverInvite(svc, "bia@test.com", "token", "Bia", "https://app.test");
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.preservePending, false);
});
Deno.test("limite conta profiles por empresa sem deleted_at", async () => {
  for (const [count, expected] of [
    [1, false],
    [2, true],
    [3, true],
  ] as const) {
    const { svc, calls } = client({ count });
    assertEquals(await checkUserLimit(svc, "vrz", 2), { reached: expected, error: null });
    assertEquals(
      calls.map((c) => c.method),
      ["from", "select", "eq"]
    );
    assertEquals(calls.find((c) => c.method === "eq")?.args, ["empresa_id", "vrz"]);
  }
});
Deno.test("empresa sem teto não consulta contagem", async () => {
  const { svc, calls } = client();
  assertEquals(await checkUserLimit(svc, "vrz", null), { reached: false, error: null });
  assertEquals(calls.length, 0);
});
Deno.test("falha de contagem é propagada", async () => {
  const error = { code: "connection_error" };
  const { svc } = client({ countError: error });
  assertEquals((await checkUserLimit(svc, "vrz", 2)).error, error);
});
