import { describe, expect, it } from "vitest";
import { parcelasDoForm } from "./parcelasDoForm";

describe("parcelasDoForm", () => {
  it("gera parcelas com número e dia válidos", () => {
    expect(parcelasDoForm({ parcelas: "3", dia_pagamento: "10", cliente_id: "c1" })).toEqual({
      numParcelas: 3,
      diaFixo: 10,
      geraParcelas: true,
      faltaCliente: false,
    });
  });

  it("aponta falta de cliente só quando vai gerar parcelas", () => {
    expect(parcelasDoForm({ parcelas: "2", dia_pagamento: "5", cliente_id: "" }).faltaCliente).toBe(true);
    expect(parcelasDoForm({ parcelas: "", dia_pagamento: "", cliente_id: "" }).faltaCliente).toBe(false);
  });

  it("não gera com dia fora de 1 a 31 nem sem número", () => {
    expect(parcelasDoForm({ parcelas: "2", dia_pagamento: "32" }).geraParcelas).toBe(false);
    expect(parcelasDoForm({ parcelas: "0", dia_pagamento: "10" }).geraParcelas).toBe(false);
  });
});
