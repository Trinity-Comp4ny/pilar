import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  cabecalhoNaoAutorizado,
  type ContextoMcp,
  ERRO_METODO_DESCONHECIDO,
  ERRO_PARAMETROS_INVALIDOS,
  ERRO_PARSE,
  ERRO_REQUISICAO_INVALIDA,
  metadadosDoRecurso,
  negociarVersao,
  processarCorpo,
  processarMensagem,
  resultadoOk,
  VERSOES_SUPORTADAS,
} from "./protocolo.ts";

const chamadas: { nome: string; argumentos: Record<string, unknown> }[] = [];
const ctx: ContextoMcp = {
  ferramentas: [
    {
      name: "buscar_projetos",
      title: "Buscar projetos",
      description: "Lista projetos",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true },
    },
  ],
  executar(nome, argumentos) {
    chamadas.push({ nome, argumentos });
    return Promise.resolve(nome === "buscar_projetos" ? resultadoOk({ quantidade: 0 }) : null);
  },
};

const enderecos = {
  recurso: "https://mcp.pilarsoft.com.br",
  servidorDeAutorizacao: "https://api.pilarsoft.com.br/auth/v1",
};

Deno.test("initialize devolve a versão pedida quando a conhecemos e anuncia ferramentas", async () => {
  const r = await processarMensagem(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
    ctx
  );
  const result = r?.result as Record<string, unknown>;
  assertEquals(result.protocolVersion, "2025-06-18");
  assertEquals(result.capabilities, { tools: { listChanged: false } });
  assertEquals((result.serverInfo as Record<string, unknown>).name, "pilar");
});

Deno.test("versão desconhecida cai na mais nova suportada", () => {
  assertEquals(negociarVersao("1999-01-01"), VERSOES_SUPORTADAS[0]);
  assertEquals(negociarVersao(undefined), VERSOES_SUPORTADAS[0]);
  assertEquals(negociarVersao("2024-11-05"), "2024-11-05");
});

Deno.test("notificação não tem resposta", async () => {
  assertEquals(await processarMensagem({ jsonrpc: "2.0", method: "notifications/initialized" }, ctx), null);
  assertEquals(await processarCorpo([{ jsonrpc: "2.0", method: "notifications/initialized" }], ctx), null);
});

Deno.test("ping responde vazio e tools/list devolve as ferramentas", async () => {
  assertEquals(await processarMensagem({ jsonrpc: "2.0", id: "a", method: "ping" }, ctx), {
    jsonrpc: "2.0",
    id: "a",
    result: {},
  });
  const lista = await processarMensagem({ jsonrpc: "2.0", id: 2, method: "tools/list" }, ctx);
  assertEquals((lista?.result as { tools: unknown[] }).tools, ctx.ferramentas);
});

Deno.test("tools/call repassa nome e argumentos (argumentos ausentes viram objeto vazio)", async () => {
  chamadas.length = 0;
  const r = await processarMensagem(
    { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "buscar_projetos" } },
    ctx
  );
  assertEquals(chamadas, [{ nome: "buscar_projetos", argumentos: {} }]);
  assertEquals((r?.result as Record<string, unknown>).structuredContent, { quantidade: 0 });
});

Deno.test("tools/call com ferramenta desconhecida ou argumento que não é objeto é erro de parâmetro", async () => {
  const desconhecida = await processarMensagem(
    { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "apagar_tudo" } },
    ctx
  );
  assertEquals(desconhecida?.error?.code, ERRO_PARAMETROS_INVALIDOS);
  const semNome = await processarMensagem({ jsonrpc: "2.0", id: 5, method: "tools/call", params: {} }, ctx);
  assertEquals(semNome?.error?.code, ERRO_PARAMETROS_INVALIDOS);
  const lista = await processarMensagem(
    { jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "buscar_projetos", arguments: [1] } },
    ctx
  );
  assertEquals(lista?.error?.code, ERRO_PARAMETROS_INVALIDOS);
});

Deno.test("método desconhecido e mensagem malformada", async () => {
  const metodo = await processarMensagem({ jsonrpc: "2.0", id: 7, method: "resources/list" }, ctx);
  assertEquals(metodo?.error?.code, ERRO_METODO_DESCONHECIDO);
  const semVersao = await processarMensagem({ id: 8, method: "ping" }, ctx);
  assertEquals(semVersao, {
    jsonrpc: "2.0",
    id: 8,
    error: { code: ERRO_REQUISICAO_INVALIDA, message: "Requisição JSON-RPC inválida" },
  });
  const idObjeto = await processarMensagem({ jsonrpc: "2.0", id: { x: 1 }, method: "ping" }, ctx);
  assertEquals(idObjeto?.error?.code, ERRO_REQUISICAO_INVALIDA);
});

Deno.test("corpo nulo é erro de parse; lote responde só o que tem id", async () => {
  const parse = await processarCorpo(null, ctx);
  assertEquals(!Array.isArray(parse) && parse?.error?.code, ERRO_PARSE);
  const lote = await processarCorpo(
    [
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 9, method: "ping" },
    ],
    ctx
  );
  assertEquals(lote, [{ jsonrpc: "2.0", id: 9, result: {} }]);
  const vazio = await processarCorpo([], ctx);
  assertEquals(!Array.isArray(vazio) && vazio?.error?.code, ERRO_REQUISICAO_INVALIDA);
});

Deno.test("metadados do recurso apontam para o servidor de autorização do domínio próprio", () => {
  const meta = metadadosDoRecurso(enderecos);
  assertEquals(meta.resource, "https://mcp.pilarsoft.com.br");
  assertEquals(meta.authorization_servers, ["https://api.pilarsoft.com.br/auth/v1"]);
});

Deno.test("WWW-Authenticate do 401 leva aos metadados e marca token inválido", () => {
  assertEquals(
    cabecalhoNaoAutorizado(enderecos, false),
    'Bearer resource_metadata="https://mcp.pilarsoft.com.br/.well-known/oauth-protected-resource"'
  );
  assertEquals(
    cabecalhoNaoAutorizado({ ...enderecos, recurso: "https://mcp.pilarsoft.com.br/" }, true),
    'Bearer resource_metadata="https://mcp.pilarsoft.com.br/.well-known/oauth-protected-resource", error="invalid_token"'
  );
});
