import { session, tabelas } from "./seed.mjs";

export const MOCK_PREFIX = "/__mock";
const CHAVE_SESSAO = "sb-localhost-auth-token";

/**
 * Plugin Vite que simula o Supabase (auth + PostgREST) no mesmo servidor do app,
 * sem Docker. Só para ver telas ao vivo com dado seed. Não valida RLS, triggers nem
 * gravação: isso é papel dos testes e do CI.
 *
 * Volume de leads: `?leads=N` na URL do app (padrão 12), guardado na sessão do navegador.
 */
export function supabaseMock() {
  let nLeads = 12;
  return {
    name: "pilar-supabase-mock",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(MOCK_PREFIX, (req, res) => {
        const url = new URL(req.url ?? "/", "http://mock");
        const cors = {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
          "content-type": "application/json",
        };
        if (req.method === "OPTIONS") {
          res.writeHead(204, cors).end();
          return;
        }
        const n = Number(url.searchParams.get("__leads"));
        if (Number.isFinite(n) && n >= 0 && url.searchParams.has("__leads")) nLeads = n;
        const send = (status, body, extra = {}) =>
          res.writeHead(status, { ...cors, ...extra }).end(JSON.stringify(body));

        if (url.pathname.startsWith("/auth/v1/user")) return send(200, session.user);
        if (url.pathname.startsWith("/auth/v1/")) return send(200, session);
        if (url.pathname.startsWith("/rest/v1/rpc/")) return send(200, null);

        const tabela = url.pathname.split("/").pop() ?? "";
        const dados = tabelas(nLeads)[tabela] ?? [];
        const unico = String(req.headers.accept ?? "").includes("vnd.pgrst.object");
        if (req.method !== "GET" && req.method !== "HEAD") return send(200, []);
        const faixa = { "content-range": `0-${Math.max(dados.length - 1, 0)}/${dados.length}` };
        if (unico) return dados.length ? send(200, dados[0], faixa) : send(406, null, faixa);
        return send(200, dados, faixa);
      });
    },
    transformIndexHtml() {
      // Sessão de mentira antes do app subir: o login do ambiente mock é automático.
      const script = `try{localStorage.setItem(${JSON.stringify(CHAVE_SESSAO)},${JSON.stringify(
        JSON.stringify(session)
      )});var q=new URLSearchParams(location.search).get("leads");if(q!==null)fetch("${MOCK_PREFIX}/__cfg?__leads="+encodeURIComponent(q))}catch(e){}`;
      return [{ tag: "script", children: script, injectTo: "head-prepend" }];
    },
  };
}
