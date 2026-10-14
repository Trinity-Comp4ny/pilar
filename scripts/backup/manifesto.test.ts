import { describe, expect, it } from "vitest";
// @ts-expect-error script .mjs sem tipos
import { contarLinhas, essenciaisVazias } from "./manifesto.mjs";

const dump = `
SET statement_timeout = 0;
COPY "auth"."users" ("instance_id", "id", "email") FROM stdin;
00000000	a1	a@x.test
00000000	a2	b@x.test
\\.

COPY "public"."empresas" ("id", "nome") FROM stdin;
e1	Escritório com quebra\\nde linha escapada
\\.

COPY "public"."vazia" ("id") FROM stdin;
\\.
`.split("\n");

describe("manifesto do backup", () => {
  it("conta uma linha por registro em cada bloco COPY", async () => {
    const tabelas = await contarLinhas(dump);
    expect(tabelas).toEqual({ "auth.users": 2, "public.empresas": 1, "public.vazia": 0 });
  });

  it("aponta as tabelas essenciais vazias ou ausentes", async () => {
    const tabelas = await contarLinhas(dump);
    expect(essenciaisVazias(tabelas)).toEqual(["public.profiles"]);
  });

  it("dump só com schema (sem COPY) acusa as três essenciais", async () => {
    const tabelas = await contarLinhas(["CREATE TABLE public.empresas (id uuid);"]);
    expect(essenciaisVazias(tabelas)).toEqual(["auth.users", "public.empresas", "public.profiles"]);
  });
});
