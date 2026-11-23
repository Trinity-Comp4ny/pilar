import { describe, expect, it } from "vitest";
import { gerarPropostaPdf, nomeArquivoProposta } from "./propostaPdf";

describe("propostaPdf", () => {
  it("gera um PDF para proposta de projeto e de obra, com e sem logo", async () => {
    const base = {
      titulo: "Projeto estrutural",
      empresaNome: "Escritório Exemplo",
      cliente: { nome: "Ana Souza", email: "ana@exemplo.com", contato: "(11) 90000-0000" },
      localizacao: "São Paulo, SP",
      valor: 12000,
      prazoDias: 45,
      validade: "2026-12-31",
      observacao: "Inclui duas revisões.",
      itens: [
        { descricao: "Estrutural", valor: 8000 },
        { descricao: "Hidráulico", valor: 4000 },
      ],
    };
    const projeto = await gerarPropostaPdf({ ...base, tipo: "projeto", areaM2: 120 });
    const obra = await gerarPropostaPdf({ ...base, tipo: "obra", itens: [] });
    expect(projeto.size).toBeGreaterThan(1000);
    expect(obra.size).toBeGreaterThan(1000);
    expect(projeto.type).toBe("application/pdf");
  });

  it("monta o nome do arquivo sem acento nem símbolo", () => {
    expect(nomeArquivoProposta("Reforma da Cozinha — Ana")).toBe("proposta-reforma-da-cozinha-ana.pdf");
    expect(nomeArquivoProposta("???")).toBe("proposta-comercial.pdf");
  });
});
