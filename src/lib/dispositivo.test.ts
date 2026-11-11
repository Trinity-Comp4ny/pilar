import { describe, expect, it } from "vitest";
import { descricaoDoNavegador, idDoDispositivo } from "./dispositivo";

describe("dispositivo (SPEC 159)", () => {
  it("descreve navegador e sistema", () => {
    expect(
      descricaoDoNavegador(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
      )
    ).toBe("Chrome no Windows");
    expect(
      descricaoDoNavegador(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe("Safari no iPhone");
    expect(descricaoDoNavegador("Mozilla/5.0 (Macintosh) Edg/130.0")).toBe("Edge no Mac");
    expect(descricaoDoNavegador("curl/8")).toBe("Navegador");
  });

  it("guarda o mesmo id no navegador", () => {
    localStorage.clear();
    const id = idDoDispositivo();
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(idDoDispositivo()).toBe(id);
  });
});
