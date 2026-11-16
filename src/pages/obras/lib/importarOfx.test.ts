import { describe, expect, it } from "vitest";
import { lerOfx, planejarOfx } from "./importarOfx";

const SGML = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261105120000[-3:BRT]
<TRNAMT>5000.00
<FITID>A1
<NAME>PIX CLIENTE
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261106
<TRNAMT>-1234.56
<FITID>A2
<NAME>CASA DO CONSTRUTOR
<MEMO>Cimento &amp; areia
</STMTTRN>
</BANKTRANLIST>
</OFX>`;

describe("lerOfx", () => {
  it("lê OFX SGML sem tag de fechamento", () => {
    const t = lerOfx(SGML);
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ fitid: "A1", data: "2026-11-05", valor: 5000 });
    expect(t[1]).toMatchObject({ data: "2026-11-06", valor: -1234.56, descricao: "CASA DO CONSTRUTOR - Cimento & areia" });
  });

  it("lê OFX XML", () => {
    const xml = `<OFX><STMTTRN><DTPOSTED>20261001</DTPOSTED><TRNAMT>-10.5</TRNAMT><FITID>X</FITID><MEMO>Tinta</MEMO></STMTTRN></OFX>`;
    expect(lerOfx(xml)).toEqual([{ fitid: "X", data: "2026-10-01", valor: -10.5, descricao: "Tinta" }]);
  });
});

describe("planejarOfx", () => {
  it("crédito é aporte e débito é despesa", () => {
    const p = planejarOfx(SGML, []);
    expect(p.linhas.map((l) => [l.tipo, l.valorAbs])).toEqual([
      ["aporte", 5000],
      ["despesa", 1234.56],
    ]);
  });

  it("marca duplicada o que já está na conta", () => {
    const p = planejarOfx(SGML, [{ tipo: "aporte", data: "2026-11-05", valor: "5000.00" }]);
    expect(p.linhas.map((l) => l.duplicada)).toEqual([true, false]);
  });

  it("recusa arquivo que não é OFX", () => {
    expect(planejarOfx("a;b;c", []).erro).toMatch(/OFX/);
  });

  it("avisa extrato sem movimentação", () => {
    expect(planejarOfx("<OFX></OFX>", []).erro).toMatch(/nenhuma/);
  });
});
