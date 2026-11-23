import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { cnaeCompativel, enriquecer, escolherDecisor, normalizarCnpj } from "./cnpj.ts";

Deno.test("normalizarCnpj: formatado e inválido", () => {
  assertEquals(normalizarCnpj("11.222.333/0001-81"), "11222333000181");
  assertEquals(normalizarCnpj("123"), null);
  assertEquals(normalizarCnpj(null), null);
});

Deno.test("cnaeCompativel: por divisão", () => {
  assertEquals(cnaeCompativel("arquitetura", "7111100"), true);
  assertEquals(cnaeCompativel("arquitetura", "4711301"), false);
  assertEquals(cnaeCompativel("construtoras", "4120400"), true);
  assertEquals(cnaeCompativel("desconhecido", "7111100"), null);
  assertEquals(cnaeCompativel("arquitetura", null), null);
});

Deno.test("escolherDecisor: empresário individual usa a razão sem o número", () => {
  assertEquals(
    escolherDecisor({ codigo_natureza_juridica: "213-5", razao_social: "MARIA TESTE 12345678901" }),
    "MARIA TESTE"
  );
});

Deno.test("escolherDecisor: sócio-administrador, não o outro sócio", () => {
  assertEquals(
    escolherDecisor({
      codigo_natureza_juridica: 2062,
      qsa: [
        { nome_socio: "FULANO SOCIO", qualificacao_socio: "Sócio" },
        { nome_socio: "BELTRANA ADM", qualificacao_socio: "Sócio-Administrador" },
      ],
    }),
    "BELTRANA ADM"
  );
  assertEquals(escolherDecisor({ codigo_natureza_juridica: 2062, qsa: [] }), null);
});

Deno.test("enriquecer: ajusta a nota pelo CNAE", () => {
  assertEquals(enriquecer("arquitetura", { razao_social: " Studio Teste ", cnae_fiscal: 7111100 }).ajuste_nota, 10);
  assertEquals(enriquecer("arquitetura", { cnae_fiscal: 4711301 }).ajuste_nota, -25);
  assertEquals(enriquecer("arquitetura", {}).ajuste_nota, 0);
});
