import { describe, expect, it } from "vitest";
import { erroDoForm, localParaIso } from "./manutencaoForm";

const AGORA = new Date("2026-11-12T12:00:00").getTime();

describe("formulário de manutenção (SPEC 153)", () => {
  it("valida título, datas, ordem e janela passada", () => {
    const base = { titulo: "Banco", mensagem: "", inicio: "2026-11-12T22:00", fim: "2026-11-12T23:00" };
    expect(erroDoForm(base, AGORA)).toBeNull();
    expect(erroDoForm({ ...base, titulo: " " }, AGORA)).toMatch(/título/);
    expect(erroDoForm({ ...base, fim: "" }, AGORA)).toMatch(/início e fim/);
    expect(erroDoForm({ ...base, fim: "2026-11-12T21:00" }, AGORA)).toMatch(/depois do início/);
    expect(erroDoForm({ ...base, inicio: "2026-11-11T22:00", fim: "2026-11-11T23:00" }, AGORA)).toMatch(/já passou/);
  });

  it("converte o valor do campo para ISO", () => {
    expect(localParaIso("")).toBeNull();
    expect(localParaIso("não é data")).toBeNull();
    expect(localParaIso("2026-11-12T22:00")).toBe(new Date("2026-11-12T22:00").toISOString());
  });
});
