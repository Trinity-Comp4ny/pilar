import { assert, assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  logAction,
  recordAndSaldo,
  REGRAS_RESPOSTA,
  respondFinal,
  respostaPrompt,
  respostaPromptStream,
  sseEvent,
  sseFinal,
  sseHeaders,
} from "./resposta.ts";
import { AGENTE_LABEL } from "./schemas.ts";

// Resposta do chat: o prompt de cada agente carrega as regras de forma (SPEC 147) e pede JSON
// ou texto puro conforme o modo; o SSE sai com cabeçalhos sem buffer; débito de tokens acontece
// uma vez por turno e o saldo é best-effort; log de passo nunca quebra o fluxo.

const req = () =>
  new Request("https://x.supabase.co/functions/v1/ai-chat", { headers: { Origin: "https://desconhecido.test" } });

Deno.test("respostaPrompt: JSON, regras de forma e o rótulo do agente", () => {
  const p = respostaPrompt("financeiro");
  assert(p.includes(AGENTE_LABEL.financeiro));
  assert(p.includes(REGRAS_RESPOSTA));
  assert(p.includes('{"resposta": "<texto>"}'));
  assert(!p.includes("Você pode ajudar com"));
});

Deno.test("respostaPrompt: agente geral orienta sobre os domínios", () => {
  assert(respostaPrompt("geral").includes("Você pode ajudar com: finanças"));
});

Deno.test("respostaPromptStream: texto puro, sem pedir JSON", () => {
  const p = respostaPromptStream("obras");
  assert(p.includes("TEXTO PURO"));
  assert(!p.includes('{"resposta"'));
  assert(p.includes(REGRAS_RESPOSTA));
  assert(respostaPromptStream("geral").includes("Você pode ajudar com"));
});

Deno.test("REGRAS_RESPOSTA: proíbe inventar números e links", () => {
  assert(REGRAS_RESPOSTA.includes("Não invente números"));
  assert(REGRAS_RESPOSTA.includes("Nunca invente um link"));
});

Deno.test("sseEvent: formato event/data com linha em branco no fim", () => {
  assertEquals(sseEvent("token", { text: "oi" }), 'event: token\ndata: {"text":"oi"}\n\n');
  assertEquals(sseEvent("final", null), "event: final\ndata: null\n\n");
});

Deno.test("sseHeaders: event-stream sem cache nem buffer, com CORS e segurança", () => {
  const h = sseHeaders(req());
  assertEquals(h["Content-Type"], "text/event-stream; charset=utf-8");
  assertEquals(h["Cache-Control"], "no-cache");
  assertEquals(h["X-Accel-Buffering"], "no");
  assertEquals(h["Access-Control-Allow-Origin"], "null");
});

Deno.test("sseFinal e respondFinal: stream vira um único evento final; sem stream vira JSON", async () => {
  const payload = { tipo: "resposta", resposta: "ok" };
  const s = sseFinal(payload, req());
  assertEquals(s.headers.get("Content-Type"), "text/event-stream; charset=utf-8");
  assertEquals(await s.text(), sseEvent("final", payload));

  const viaStream = respondFinal(payload, req(), true);
  assertEquals(await viaStream.text(), sseEvent("final", payload));

  const json = respondFinal(payload, req(), false);
  assertEquals(json.status, 200);
  assert(json.headers.get("Content-Type")?.includes("application/json"));
  assertEquals(await json.json(), payload);
});

type Chamada = { tipo: "rpc" | "from"; nome: string; args?: unknown };

function adminFalso(o: { rpcErro?: string; saldo?: unknown; saldoLanca?: boolean; insertLanca?: boolean } = {}) {
  const chamadas: Chamada[] = [];
  const admin = {
    rpc: (nome: string, args: unknown) => {
      chamadas.push({ tipo: "rpc", nome, args });
      return Promise.resolve(
        o.rpcErro ? { data: null, error: { message: o.rpcErro } } : { data: { ok: true }, error: null }
      );
    },
    from: (tabela: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => {
          chamadas.push({ tipo: "from", nome: tabela });
          if (o.saldoLanca) return Promise.reject(new Error("rede"));
          return Promise.resolve({ data: o.saldo ?? null, error: null });
        },
        insert: (linha: unknown) => {
          chamadas.push({ tipo: "from", nome: tabela, args: linha });
          if (o.insertLanca) throw new Error("tabela travada");
          return Promise.resolve({ error: null });
        },
      };
      return builder;
    },
  };
  return { admin: admin as unknown as SupabaseClient, chamadas };
}

Deno.test("recordAndSaldo: debita uma vez com os tokens do turno e devolve o saldo", async () => {
  const { admin, chamadas } = adminFalso({ saldo: { saldo_plano: 900, saldo_comprado: "100" } });
  const saldo = await recordAndSaldo(admin, "emp-1", "u1", "run-1", 120, 80, 2);
  assertEquals(saldo, { tokens_plano: 900, tokens_comprado: 100, tokens_restantes: 1000 });
  const rpc = chamadas.filter((c) => c.tipo === "rpc");
  assertEquals(rpc.length, 1);
  assertEquals(rpc[0].nome, "debitar_tokens");
  const args = rpc[0].args as Record<string, unknown>;
  assertEquals(args.p_empresa_id, "emp-1");
  assertEquals(args.p_agent_key, "ai_chat");
  assertEquals(args.p_agent_run_id, "run-1");
});

Deno.test("recordAndSaldo: sem run vai null; leitura do saldo que falha devolve null", async () => {
  const { admin, chamadas } = adminFalso({ saldoLanca: true });
  const saldo = await recordAndSaldo(admin, "emp-1", null, undefined, 1, 1, 1);
  assertEquals(saldo, null);
  assertEquals((chamadas[0].args as Record<string, unknown>).p_agent_run_id, null);
});

Deno.test("recordAndSaldo: débito que falha não derruba a resposta", async () => {
  const { admin } = adminFalso({ rpcErro: "ledger fora", saldo: null });
  const saldo = await recordAndSaldo(admin, "emp-1", "u1", "r", 1, 1, 1);
  assertEquals(saldo, { tokens_plano: 0, tokens_comprado: 0, tokens_restantes: 0 });
});

Deno.test("logAction: grava o passo do agente; sem run é no-op", async () => {
  const { admin, chamadas } = adminFalso();
  await logAction(admin, undefined, "buscar");
  assertEquals(chamadas.length, 0);
  await logAction(admin, "run-1", "buscar", { q: "x" });
  assertEquals(chamadas[0], {
    tipo: "from",
    nome: "agent_actions",
    args: { run_id: "run-1", tool_name: "buscar", args: { q: "x" }, result: null },
  });
});

Deno.test("logAction: falha ao gravar é engolida", async () => {
  const { admin } = adminFalso({ insertLanca: true });
  await logAction(admin, "run-1", "buscar", undefined, { ok: true });
});
