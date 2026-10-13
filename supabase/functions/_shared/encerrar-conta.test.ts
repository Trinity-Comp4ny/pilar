import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  anonimizarTitular,
  BLOQUEIO_PERMANENTE,
  desativarConta,
  emailNeutro,
  PERFIL_ANONIMO,
  TABELAS_APAGADAS,
  TABELAS_MANTIDAS,
} from "./encerrar-conta.ts";

const ID = "00000000-0000-0000-0000-0000000000aa";

/** Cliente falso que só anota o que foi pedido. `falhaEm` devolve erro naquela tabela. */
function falso(opts: { arquivos?: string[]; fatores?: string[]; falhaEm?: string } = {}) {
  const chamadas: string[] = [];
  const updates: Record<string, unknown>[] = [];
  const resposta = (alvo: string) => ({ error: opts.falhaEm === alvo ? { message: "falhou" } : null });
  const svc = {
    from: (tabela: string) => ({
      delete: () => ({
        eq: (coluna: string, valor: string) => {
          chamadas.push(`delete ${tabela}.${coluna}=${valor}`);
          return Promise.resolve(resposta(tabela));
        },
      }),
      update: (valores: Record<string, unknown>) => {
        updates.push(valores);
        const fim = { ...resposta(tabela), is: () => Promise.resolve(resposta(tabela)) };
        return { eq: () => Object.assign(Promise.resolve(resposta(tabela)), fim) };
      },
    }),
    storage: {
      from: (bucket: string) => ({
        list: () => Promise.resolve({ data: (opts.arquivos ?? []).map((name) => ({ name })), error: null }),
        remove: (caminhos: string[]) => {
          chamadas.push(`remove ${bucket} ${caminhos.join(",")}`);
          return Promise.resolve({ error: null });
        },
      }),
    },
    auth: {
      admin: {
        updateUserById: (id: string, attrs: Record<string, unknown>) => {
          chamadas.push(`auth ${id} ${Object.keys(attrs).sort().join(",")}`);
          updates.push(attrs);
          return Promise.resolve({ error: null });
        },
        mfa: {
          listFactors: () =>
            Promise.resolve({ data: { factors: (opts.fatores ?? []).map((id) => ({ id })) }, error: null }),
          deleteFactor: ({ id }: { id: string }) => {
            chamadas.push(`mfa ${id}`);
            return Promise.resolve({ error: null });
          },
        },
      },
    },
  };
  return { svc: svc as unknown as SupabaseClient, chamadas, updates };
}

Deno.test("nada que a lei manda guardar está na lista do que se apaga", () => {
  const apagadas = TABELAS_APAGADAS.map((t) => t.tabela as string);
  for (const mantida of TABELAS_MANTIDAS) assert(!apagadas.includes(mantida), `${mantida} não pode ser apagada`);
});

Deno.test("desativar bloqueia no Auth sem prazo e marca o perfil", async () => {
  const { svc, chamadas, updates } = falso();
  assertEquals(await desativarConta(svc, ID), { ok: true });
  assertEquals(chamadas, [`auth ${ID} ban_duration`]);
  assertEquals(updates[0], { ban_duration: BLOQUEIO_PERMANENTE });
  assert(typeof updates[1].desativado_em === "string");
});

Deno.test("exclusão apaga o dado pessoal, a pasta nos buckets e os fatores de 2FA", async () => {
  const { svc, chamadas } = falso({ arquivos: ["avatar"], fatores: ["f1"] });
  assertEquals(await anonimizarTitular(svc, ID), { ok: true });

  for (const { tabela, coluna } of TABELAS_APAGADAS) assert(chamadas.includes(`delete ${tabela}.${coluna}=${ID}`));
  assert(chamadas.includes(`remove user-avatars ${ID}/avatar`));
  assert(chamadas.includes(`remove lgpd-exportacoes ${ID}/avatar`));
  assert(chamadas.includes("mfa f1"));
});

Deno.test("exclusão troca nome e e-mail por valores neutros e bloqueia o login", async () => {
  const { svc, updates } = falso();
  await anonimizarTitular(svc, ID);

  const auth = updates.find((u) => "email" in u && "ban_duration" in u);
  assertEquals(auth?.email, emailNeutro(ID));
  assertEquals(auth?.user_metadata, {});
  assertEquals(
    updates.find((u) => "nome" in u),
    { ...PERFIL_ANONIMO, email: emailNeutro(ID) }
  );
  assert(updates.some((u) => "desativado_em" in u));
});

Deno.test("falha no meio para e diz onde, sem anonimizar o perfil", async () => {
  const { svc, updates } = falso({ falhaEm: "notificacoes" });
  assertEquals(await anonimizarTitular(svc, ID), { ok: false, erro: "notificacoes: falhou" });
  assert(!updates.some((u) => "nome" in u));
});

Deno.test("e-mail neutro usa domínio reservado e é único por usuário", () => {
  assertEquals(emailNeutro(ID), `removido-${ID}@usuarios.pilarsoft.invalid`);
});
