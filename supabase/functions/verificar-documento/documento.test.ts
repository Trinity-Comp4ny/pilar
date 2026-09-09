// Roda com: deno test --allow-env supabase/functions/verificar-documento

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  apenasDigitos,
  detectarTipoDocumento,
  validarDigitoCnpj,
  validarDigitoCpf,
  consultarCnpjBrasilApi,
  situacaoPermiteSubirNivel,
} from "./documento.ts";

function stubFetch(impl: (url: string) => Response | Promise<Response>) {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request) => impl(String(input))) as typeof fetch;
  return () => {
    globalThis.fetch = original;
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.test("apenasDigitos remove máscara", () => {
  assertEquals(apenasDigitos("11.222.333/0001-81"), "11222333000181");
  assertEquals(apenasDigitos("529.982.247-25"), "52998224725");
});

Deno.test("detectarTipoDocumento por tamanho", () => {
  assertEquals(detectarTipoDocumento("11222333000181"), "cnpj");
  assertEquals(detectarTipoDocumento("52998224725"), "cpf");
  assertEquals(detectarTipoDocumento("123"), null);
});

Deno.test("validarDigitoCnpj aceita CNPJ real com dígito correto", () => {
  assertEquals(validarDigitoCnpj("11222333000181"), true);
  assertEquals(validarDigitoCnpj("11444777000161"), true);
});

Deno.test("validarDigitoCnpj recusa dígito errado e sequência repetida", () => {
  assertEquals(validarDigitoCnpj("11222333000199"), false);
  assertEquals(validarDigitoCnpj("11111111111111"), false);
  assertEquals(validarDigitoCnpj("123"), false);
});

Deno.test("validarDigitoCpf aceita CPF real com dígito correto", () => {
  assertEquals(validarDigitoCpf("52998224725"), true);
});

Deno.test("validarDigitoCpf recusa dígito errado e sequência repetida", () => {
  assertEquals(validarDigitoCpf("52998224799"), false);
  assertEquals(validarDigitoCpf("11111111111"), false);
});

Deno.test("situacaoPermiteSubirNivel só ATIVA sobe, resto recusa", () => {
  assertEquals(situacaoPermiteSubirNivel("ATIVA"), true);
  assertEquals(situacaoPermiteSubirNivel("BAIXADA"), false);
  assertEquals(situacaoPermiteSubirNivel("INAPTA"), false);
  assertEquals(situacaoPermiteSubirNivel("SUSPENSA"), false);
});

Deno.test("consultarCnpjBrasilApi devolve razão social e situação quando a resposta bate com o schema", async () => {
  const restore = stubFetch(() =>
    jsonResponse({
      razao_social: "EMPRESA TESTE LTDA",
      descricao_situacao_cadastral: "ATIVA",
      cnae_fiscal: 7112000,
    })
  );
  try {
    const result = await consultarCnpjBrasilApi("11222333000181");
    assertEquals(result, {
      status: "ok",
      info: { razaoSocial: "EMPRESA TESTE LTDA", situacaoCadastral: "ATIVA", cnaePrincipal: "7112000" },
    });
  } finally {
    restore();
  }
});

Deno.test("consultarCnpjBrasilApi devolve indisponivel (não joga erro) no 404", async () => {
  const restore = stubFetch(() => new Response(null, { status: 404 }));
  try {
    assertEquals(await consultarCnpjBrasilApi("00000000000000"), { status: "indisponivel" });
  } finally {
    restore();
  }
});

Deno.test("consultarCnpjBrasilApi devolve indisponivel quando o provider muda o formato da resposta", async () => {
  const restore = stubFetch(() => jsonResponse({ unexpected: "shape" }));
  try {
    assertEquals(await consultarCnpjBrasilApi("11222333000181"), { status: "indisponivel" });
  } finally {
    restore();
  }
});

Deno.test("consultarCnpjBrasilApi devolve indisponivel quando o fetch lança (rede fora)", async () => {
  const restore = stubFetch(() => {
    throw new Error("network down");
  });
  try {
    assertEquals(await consultarCnpjBrasilApi("11222333000181"), { status: "indisponivel" });
  } finally {
    restore();
  }
});
