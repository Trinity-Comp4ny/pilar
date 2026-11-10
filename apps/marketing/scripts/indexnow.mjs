// Avisa Bing, Yandex, Seznam e Naver (protocolo IndexNow) que as páginas do
// sitemap mudaram, para entrarem no índice sem esperar o robô passar. O Bing
// alimenta a busca do ChatGPT e do Copilot. O Google não usa IndexNow: para ele,
// vale o sitemap enviado no Search Console.
//
// Rodar depois de cada deploy de produção que publica ou muda página:
//   npm run seo:indexnow --workspace=apps/marketing
//
// A chave é pública por desenho do protocolo: o arquivo public/<chave>.txt prova
// ao buscador que o pedido vem do dono do domínio. Trocar a chave = trocar os dois.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const CHAVE = "613ff39428e88696677951c3d0721901";
const HOST = "www.pilarsoft.com.br";

const sitemap = readFileSync(fileURLToPath(new URL("../public/sitemap.xml", import.meta.url)), "utf8");
// Só URLs do próprio domínio: o IndexNow recusa as de outro host, e nada além das
// páginas públicas do sitemap sai daqui.
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1])
  .filter((u) => u.startsWith(`https://${HOST}/`));

const resposta = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host: HOST, key: CHAVE, keyLocation: `https://${HOST}/${CHAVE}.txt`, urlList: urls }),
});

// 200 e 202 são sucesso (202 = recebido, chave ainda em validação).
console.log(`[indexnow] ${urls.length} URLs enviadas: HTTP ${resposta.status}`);
if (resposta.status !== 200 && resposta.status !== 202) process.exit(1);
