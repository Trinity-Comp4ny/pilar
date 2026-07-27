import { describe, expect, it } from "vitest";
import { normalize } from "./normalize-db-types.mjs";

describe("normalize-db-types", () => {
  it("remove o bloco __InternalSupabase com o comentário que o antecede", () => {
    const src = `export type Database = {
  public: {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
      PostgrestVersion: "14.5";
    };
    Tables: {};
  };
};`;
    const out = normalize(src);
    expect(out).not.toContain("__InternalSupabase");
    expect(out).not.toContain("PostgrestVersion");
    expect(out).not.toContain("Allows to automatically instantiate");
    expect(out).toContain("Tables: {};");
  });

  it("é idempotente", () => {
    const src = `export type Database = {\n  public: {\n    Tables: {};\n  };\n};\n`;
    expect(normalize(normalize(src))).toBe(normalize(src));
  });

  // Último resíduo real do gate: os dois lados diferiam só por uma linha vazia no fim.
  it("termina sempre com exatamente um newline", () => {
    const base = "export type Database = {};";
    for (const variant of [base, base + "\n", base + "\n\n", base + "\n\n\n", base + "  \n \n"]) {
      expect(normalize(variant)).toBe(base + "\n");
    }
  });

  it("dois arquivos que só diferem no PostgrestVersion normalizam para o mesmo texto", () => {
    const make = (v: string) => `export type Database = {
  public: {
    __InternalSupabase: {
      PostgrestVersion: "${v}";
    };
    Tables: { jobs: { Row: { id: string } } };
  };
};`;
    expect(normalize(make("14.5"))).toBe(normalize(make("13.0")));
  });

  it("não mascara diferença real de schema", () => {
    const withJobs = `export type Database = {
  public: {
    __InternalSupabase: { PostgrestVersion: "14.5"; };
    Tables: { jobs: { Row: { id: string } } };
  };
};`;
    const withoutJobs = `export type Database = {
  public: {
    __InternalSupabase: { PostgrestVersion: "14.5"; };
    Tables: {};
  };
};`;
    expect(normalize(withJobs)).not.toBe(normalize(withoutJobs));
    expect(normalize(withJobs)).toContain("jobs");
  });

  it("lida com o bloco em uma única linha", () => {
    const src = `a\n    __InternalSupabase: { PostgrestVersion: "14.5"; };\nb`;
    const out = normalize(src);
    expect(out).not.toContain("__InternalSupabase");
    expect(out).toContain("a");
    expect(out).toContain("b");
  });
});
