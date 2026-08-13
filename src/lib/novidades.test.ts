import { describe, it, expect } from "vitest";
import pkg from "../../package.json";
import { NOVIDADES, ULTIMA_VERSAO } from "./novidades";

// Guarda a fonte de versão: a versão amigável mostrada ao usuário (ULTIMA_VERSAO,
// = release do topo) tem que bater com o "version" do package.json. Sem isso, os
// dois esquemas divergem em silêncio (o bug que motivou a spec 038).
describe("versionamento", () => {
  it("ULTIMA_VERSAO é o release do topo", () => {
    expect(ULTIMA_VERSAO).toBe(NOVIDADES[0].versao);
  });

  it("ULTIMA_VERSAO casa com a versão do package.json", () => {
    expect(ULTIMA_VERSAO).toBe(pkg.version);
  });

  it("toda versão segue SemVer (x.y.z)", () => {
    for (const release of NOVIDADES) {
      expect(release.versao).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("releases estão em ordem decrescente de versão", () => {
    const peso = (v: string) => v.split(".").reduce((acc, n) => acc * 1000 + Number(n), 0);
    for (let i = 1; i < NOVIDADES.length; i++) {
      expect(peso(NOVIDADES[i - 1].versao)).toBeGreaterThan(peso(NOVIDADES[i].versao));
    }
  });
});
