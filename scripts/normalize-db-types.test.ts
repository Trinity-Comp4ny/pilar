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

  it("é idempotente e não mexe em arquivo sem o bloco", () => {
    const src = `export type Database = {\n  public: {\n    Tables: {};\n  };\n};`;
    expect(normalize(src)).toBe(src);
    expect(normalize(normalize(src))).toBe(normalize(src));
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
