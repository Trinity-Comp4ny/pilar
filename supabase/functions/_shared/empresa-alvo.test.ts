import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { resolverEmpresaAlvo } from "./empresa-alvo.ts";

const PROPRIA = "aaaaaaaa-0000-4000-8000-000000000001";
const OUTRA = "bbbbbbbb-0000-4000-8000-000000000002";

// deno-lint-ignore no-explicit-any
function cliente(opts: { ultra?: boolean; auditErro?: boolean }, chamadas: string[]): any {
  return {
    rpc: (nome: string) => {
      chamadas.push(nome);
      if (nome === "is_ultra_admin") return Promise.resolve({ data: opts.ultra ?? false, error: null });
      return Promise.resolve({ data: null, error: opts.auditErro ? { message: "falhou" } : null });
    },
  };
}

const alvo = { tipo: "obra", id: "o1" };

Deno.test("sem empresa_id pedida usa a empresa própria, sem auditar", async () => {
  const chamadas: string[] = [];
  const r = await resolverEmpresaAlvo(
    cliente({}, chamadas),
    { empresa_id: PROPRIA, role: "admin" },
    undefined,
    "x",
    alvo
  );
  assertEquals(r, { ok: true, empresaId: PROPRIA });
  assertEquals(chamadas, []);
});

Deno.test("sem empresa própria e sem empresa pedida é recusado", async () => {
  const r = await resolverEmpresaAlvo(cliente({}, []), { empresa_id: null, role: "admin" }, undefined, "x", alvo);
  assertEquals(r.ok, false);
});

Deno.test("admin comum não age em outra empresa", async () => {
  const r = await resolverEmpresaAlvo(cliente({}, []), { empresa_id: PROPRIA, role: "admin" }, OUTRA, "x", alvo);
  assertEquals(r.ok, false);
  assertEquals(!r.ok && r.status, 403);
});

Deno.test("ultra_admin sem MFA (is_ultra_admin falso) é recusado", async () => {
  const r = await resolverEmpresaAlvo(
    cliente({ ultra: false }, []),
    { empresa_id: PROPRIA, role: "ultra_admin" },
    OUTRA,
    "x",
    alvo
  );
  assertEquals(!r.ok && r.status, 403);
});

Deno.test("ultra_admin em outra empresa audita antes de seguir", async () => {
  const chamadas: string[] = [];
  const r = await resolverEmpresaAlvo(
    cliente({ ultra: true }, chamadas),
    { empresa_id: PROPRIA, role: "ultra_admin" },
    OUTRA,
    "campo_invite",
    alvo
  );
  assertEquals(r, { ok: true, empresaId: OUTRA });
  assertEquals(chamadas, ["is_ultra_admin", "registrar_acesso_ultra_admin"]);
});

Deno.test("falha ao registrar a auditoria recusa a chamada (fail-closed)", async () => {
  const r = await resolverEmpresaAlvo(
    cliente({ ultra: true, auditErro: true }, []),
    { empresa_id: PROPRIA, role: "ultra_admin" },
    OUTRA,
    "x",
    alvo
  );
  assertEquals(!r.ok && r.status, 503);
});
