import { describe, expect, it } from "vitest";
import { janelaManutencao, montarAvisos, type IncidenteAviso, type ManutencaoAviso } from "./avisosPlataforma";

const AGORA = new Date("2026-11-12T15:00:00Z"); // 12:00 em Brasília
const min = (m: number) => new Date(AGORA.getTime() + m * 60_000).toISOString();

const incidente = (over: Partial<IncidenteAviso> = {}): IncidenteAviso => ({
  id: "i1",
  titulo: "Lentidão no Financeiro",
  severidade: "parcial",
  status: "investigando",
  resolvidoEm: null,
  componentes: ["Aplicação Pilar"],
  ultimaAtualizacao: { id: "u1", mensagem: "Encontramos a causa e estamos corrigindo." },
  ...over,
});

const manutencao = (over: Partial<ManutencaoAviso> = {}): ManutencaoAviso => ({
  id: "m1",
  titulo: "Atualização do banco",
  mensagem: null,
  inicio: min(5 * 60),
  fim: min(6 * 60),
  canceladaEm: null,
  ...over,
});

describe("montarAvisos (SPEC 153)", () => {
  it("incidente aberto vira faixa com a cor da severidade, componentes e última atualização", () => {
    const [aviso] = montarAvisos([incidente()], [], AGORA);
    expect(aviso).toEqual({
      chave: "incidente:i1:u1",
      tom: "attention",
      titulo: "Lentidão no Financeiro",
      texto: "Encontramos a causa e estamos corrigindo.",
      detalhe: "Afeta: Aplicação Pilar",
    });
  });

  it("atualização nova troca a chave (a faixa dispensada volta)", () => {
    const antes = montarAvisos([incidente()], [], AGORA)[0].chave;
    const depois = montarAvisos(
      [incidente({ ultimaAtualizacao: { id: "u2", mensagem: "Corrigido, monitorando." } })],
      [],
      AGORA
    )[0].chave;
    expect(depois).not.toBe(antes);
  });

  it("mais grave primeiro", () => {
    const avisos = montarAvisos(
      [incidente({ id: "a", severidade: "degradado" }), incidente({ id: "b", severidade: "outage" })],
      [],
      AGORA
    );
    expect(avisos.map((a) => a.tom)).toEqual(["danger", "warning"]);
  });

  it("resolvido há 10 min mostra Normalizado; há 40 min some", () => {
    const recente = montarAvisos([incidente({ status: "resolvido", resolvidoEm: min(-10) })], [], AGORA);
    expect(recente).toHaveLength(1);
    expect(recente[0].tom).toBe("positive");
    expect(recente[0].titulo).toBe("Normalizado: Lentidão no Financeiro");
    expect(montarAvisos([incidente({ status: "resolvido", resolvidoEm: min(-40) })], [], AGORA)).toEqual([]);
  });

  it("manutenção: nada com 30 h de antecedência, programada com 5 h, em andamento durante, nada se cancelada", () => {
    expect(montarAvisos([], [manutencao({ inicio: min(30 * 60), fim: min(31 * 60) })], AGORA)).toEqual([]);

    const [programada] = montarAvisos([], [manutencao()], AGORA);
    expect(programada.tom).toBe("info");
    expect(programada.titulo).toBe("Manutenção programada: Atualização do banco");
    expect(programada.detalhe).toBe("Previsto em 12/11, das 17:00 às 18:00");

    const [andamento] = montarAvisos([], [manutencao({ inicio: min(-10), fim: min(50) })], AGORA);
    expect(andamento.tom).toBe("warning");
    expect(andamento.texto).toContain("Até 12:50");

    expect(montarAvisos([], [manutencao({ canceladaEm: min(-1) })], AGORA)).toEqual([]);
    expect(montarAvisos([], [manutencao({ inicio: min(-60), fim: min(-1) })], AGORA)).toEqual([]);
  });

  it("incidente vem antes de manutenção, e Normalizado por último", () => {
    const avisos = montarAvisos(
      [incidente({ id: "r", status: "resolvido", resolvidoEm: min(-5) }), incidente({ id: "a" })],
      [manutencao()],
      AGORA
    );
    expect(avisos.map((a) => a.tom)).toEqual(["attention", "info", "positive"]);
  });
});

describe("janelaManutencao", () => {
  it("janela que vira o dia mostra as duas datas", () => {
    expect(janelaManutencao(new Date("2026-11-13T01:00:00Z"), new Date("2026-11-13T05:00:00Z"))).toBe(
      "de 12/11 22:00 a 13/11 02:00"
    );
  });
});

describe("comunicados na faixa (SPEC 157)", () => {
  it("só formato faixa entra, depois de incidente e antes de Normalizado", () => {
    const avisos = montarAvisos(
      [incidente({ id: "r", status: "resolvido", resolvidoEm: min(-5) }), incidente({ id: "a" })],
      [],
      AGORA,
      [
        { id: "c1", titulo: "Preço", mensagem: "Dezembro", formato: "faixa", link_url: null, link_rotulo: null },
        { id: "c2", titulo: "Modal", mensagem: "x", formato: "modal", link_url: null, link_rotulo: null },
      ]
    );
    expect(avisos.map((a) => a.chave)).toEqual(["incidente:a:u1", "comunicado:c1", "incidente:r:resolvido"]);
    expect(avisos[1].comunicadoId).toBe("c1");
  });
});
