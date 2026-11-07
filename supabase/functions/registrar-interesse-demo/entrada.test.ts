import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { lerInteresseDemo } from "./entrada.ts";

Deno.test("aceita canal, só as chaves de origem conhecidas e a página", () => {
  const r = lerInteresseDemo(
    JSON.stringify({
      canal: "ChatGPT",
      origem: { utm_source: "chatgpt.com", email: "x@y.com", ref: "chatgpt.com" },
      pagina: "/planos#hero",
    })
  );
  assertEquals(r, {
    canal: "chatgpt",
    origem: { utm_source: "chatgpt.com", ref: "chatgpt.com" },
    pagina: "/planos#hero",
  });
});

Deno.test("recusa corpo inválido ou canal fora do formato", () => {
  assertEquals(lerInteresseDemo("nao-e-json"), null);
  assertEquals(lerInteresseDemo(JSON.stringify({ canal: "" })), null);
  assertEquals(lerInteresseDemo(JSON.stringify({ canal: "<script>" })), null);
});

Deno.test("corta valores longos", () => {
  const r = lerInteresseDemo(JSON.stringify({ canal: "google", origem: { utm_campaign: "x".repeat(500) } }));
  assertEquals(r?.origem.utm_campaign.length, 200);
});
