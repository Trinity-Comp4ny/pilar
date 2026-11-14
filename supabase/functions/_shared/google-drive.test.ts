import { assert, assertEquals, assertRejects } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  cifrar,
  decifrar,
  emailDoIdToken,
  ErroGoogle,
  hashDoEstado,
  idDriveValido,
  iniciarUpload,
  listarFilhos,
  nomeLimpo,
  novoEstado,
  tokenDeAcesso,
  urlDeAutorizacao,
} from "./google-drive.ts";

const cfg = {
  clientId: "cid",
  clientSecret: "seg",
  redirectUri: "https://x.supabase.co/functions/v1/google-drive-oauth",
};
const chave = btoa(String.fromCharCode(...new Uint8Array(32).fill(7)));

Deno.test("cifra do refresh token: ida e volta, IV novo a cada vez, chave errada falha", async () => {
  const a = await cifrar("1//refresh", chave);
  const b = await cifrar("1//refresh", chave);
  assert(a.startsWith("v1:") && a !== b);
  assertEquals(await decifrar(a, chave), "1//refresh");
  const outra = btoa(String.fromCharCode(...new Uint8Array(32).fill(9)));
  await assertRejects(() => decifrar(a, outra));
  await assertRejects(() => cifrar("x", btoa("curta")));
});

Deno.test("URL de consentimento pede drive.file, offline e consent, com o state", () => {
  const u = new URL(urlDeAutorizacao(cfg, "st4te", "ana@vrz.com"));
  assertEquals(u.origin, "https://accounts.google.com");
  assertEquals(u.searchParams.get("scope"), "openid email https://www.googleapis.com/auth/drive.file");
  assertEquals(u.searchParams.get("access_type"), "offline");
  assertEquals(u.searchParams.get("prompt"), "consent");
  assertEquals(u.searchParams.get("state"), "st4te");
  assertEquals(u.searchParams.get("login_hint"), "ana@vrz.com");
  assertEquals(u.searchParams.get("redirect_uri"), cfg.redirectUri);
});

Deno.test("state: aleatório e o hash é estável", async () => {
  const a = await novoEstado();
  const b = await novoEstado();
  assert(a.estado !== b.estado);
  assertEquals(await hashDoEstado(a.estado), a.hash);
  assert(!a.hash.includes("=") && !a.hash.includes("+"));
});

Deno.test("e-mail sai do id_token; token malformado vira null", () => {
  const corpo = btoa(JSON.stringify({ email: "drive@vrz.com.br" })).replace(/=+$/, "");
  assertEquals(emailDoIdToken(`h.${corpo}.s`), "drive@vrz.com.br");
  assertEquals(emailDoIdToken("lixo"), null);
  assertEquals(emailDoIdToken(undefined), null);
});

Deno.test("id do Drive e nome limpo barram injeção e lixo", () => {
  assert(idDriveValido("1AbC-dEf_ghIJkl"));
  assert(!idDriveValido("abc' or '1'='1"));
  assert(!idDriveValido("curto"));
  assertEquals(nomeLimpo("  Elétrica\n  rev 2\u0007 "), "Elétrica rev 2");
});

Deno.test("refresh token revogado vira 401 (a tela pede para reconectar)", async () => {
  const f = () => Promise.resolve(new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }));
  const e = await assertRejects(() => tokenDeAcesso(cfg, "r", f), ErroGoogle);
  assertEquals((e as ErroGoogle).status, 401);
});

Deno.test("listar pagina, filtra lixeira e não aceita id inválido", async () => {
  const urls: string[] = [];
  const paginas = [
    { files: [{ id: "a", name: "A", mimeType: "x" }], nextPageToken: "p2" },
    { files: [{ id: "b", name: "B", mimeType: "x" }] },
  ];
  const f = (u: string | URL | Request) => {
    urls.push(String(u));
    return Promise.resolve(new Response(JSON.stringify(paginas.shift())));
  };
  const itens = await listarFilhos("tok", "1AbCdEfGhIjK", f);
  assertEquals(
    itens.map((i) => i.id),
    ["a", "b"]
  );
  assertEquals(new URL(urls[0]).searchParams.get("q"), "'1AbCdEfGhIjK' in parents and trashed = false");
  assert(urls[1].includes("pageToken=p2"));
  await assertRejects(() => listarFilhos("tok", "x' or '1", f), ErroGoogle);
});

Deno.test("upload retomável manda Origin e devolve a URL da sessão", async () => {
  let headers: Headers | undefined;
  const f = (_u: string | URL | Request, init?: RequestInit) => {
    headers = new Headers(init?.headers);
    return Promise.resolve(new Response(null, { status: 200, headers: { Location: "https://upload/sessao" } }));
  };
  const url = await iniciarUpload(
    "tok",
    { nome: "planta.dwg", mime: "", tamanho: 10, paiId: "1AbCdEfGhIjK", origin: "https://app.pilarsoft.com.br" },
    f
  );
  assertEquals(url, "https://upload/sessao");
  assertEquals(headers?.get("Origin"), "https://app.pilarsoft.com.br");
  assertEquals(headers?.get("X-Upload-Content-Type"), "application/octet-stream");
  assertEquals(headers?.get("X-Upload-Content-Length"), "10");
});
