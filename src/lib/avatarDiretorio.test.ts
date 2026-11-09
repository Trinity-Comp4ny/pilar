import { describe, expect, it } from "vitest";
import { chaveDeNome, montarDiretorioDeFotos } from "./avatarDiretorio";

describe("chaveDeNome", () => {
  it("ignora acento, caixa e espaço duplicado", () => {
    expect(chaveDeNome("  João   da Silva ")).toBe("joao da silva");
  });
});

describe("montarDiretorioDeFotos", () => {
  it("usa a foto do perfil vinculado à pessoa", () => {
    const mapa = montarDiretorioDeFotos([{ nome: "Ana Lima", profiles: { avatar_url: "https://x/ana.png" } }], []);
    expect(mapa.get(chaveDeNome("Ana Lima"))).toBe("https://x/ana.png");
  });

  it("cai para o perfil de mesmo nome quando a pessoa não está vinculada", () => {
    const mapa = montarDiretorioDeFotos(
      [{ nome: "Matheus Rezende", profiles: null }],
      [{ nome: null, first_name: "Matheus", last_name: "Rezende", avatar_url: "https://x/m.png" }]
    );
    expect(mapa.get(chaveDeNome("Matheus Rezende"))).toBe("https://x/m.png");
  });

  it("a foto da pessoa vinculada tem prioridade sobre a do perfil homônimo", () => {
    const mapa = montarDiretorioDeFotos(
      [{ nome: "Ana Lima", profiles: { avatar_url: "https://x/vinculada.png" } }],
      [{ nome: "Ana Lima", first_name: null, last_name: null, avatar_url: "https://x/outra.png" }]
    );
    expect(mapa.get(chaveDeNome("Ana Lima"))).toBe("https://x/vinculada.png");
  });

  it("sem foto em lugar nenhum, não cria entrada (cai nas iniciais)", () => {
    const mapa = montarDiretorioDeFotos(
      [{ nome: "Bruno", profiles: { avatar_url: null } }],
      [{ nome: "Bruno", first_name: null, last_name: null, avatar_url: null }]
    );
    expect(mapa.size).toBe(0);
  });
});
